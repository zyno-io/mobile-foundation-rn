import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { autorun, observable, runInAction } from "mobx";
import { useEffect, useState } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";

import { getFoundationConfig } from "../config";
import { LoaderState } from "../helpers/observable";
import { useAppActivatedEffect } from "../hooks/useAppStateEffect";
import { AppMeta } from "./AppMeta";
import { createLogger } from "./Logger";

const logger = createLogger("Updater");

function fetchedUpdateId(result: Updates.UpdateFetchResult): string | null {
  if (!result.isNew || result.isRollBackToEmbedded) return null;
  const id = result.manifest?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Native (app-store) update status returned by the MUS `native-status` endpoint. */
export interface INativeUpdateStatus {
  platform: "ios" | "android";
  channelName: string;
  nativeUpdateRequiredAt: string;
  nativeUpdateRequired: boolean;
  latestStoreVersion: string;
  latestStoreVersionDetectedAt: string;
  storeUrl: string;
}

const _statusText = observable.box<string | null>(null);
/** Current updater status before user-facing deferral masking is applied. */
const _unmaskedStatusText = observable.box<string | null>(null);
const _nativeStatus = observable.box<INativeUpdateStatus | null>(null);

function compareVersions(a: string, b: string): number {
  const ap = a.split(".").map((n) => parseInt(n, 10) || 0);
  const bp = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

let _nativeAlertShown = false;
let _nativeWatchStarted = false;
let _nativeAppStateListenerStarted = false;
let _headersSyncPromise: Promise<void> | null = null;
let _installDeferralDisposer: (() => void) | null = null;

// --- Auto-install safety / downgrade-loop hardening -------------------------
// `reloadAsync()` called too early in a launch can crash (expo/expo#21347), and
// if a downloaded update keeps failing to launch, expo-updates rolls back to the
// embedded bundle on each cold start. Naively re-downloading + reloading into
// that update produces a relaunch/downgrade loop. These guards let a FIRST
// install proceed (after a short settle) while breaking the loop everywhere
// else. See Updater._evaluateInstallCircuit / _recordInstallAttempt.

/** How long to let the JS runtime settle before reloading to install an update. */
const INSTALL_SETTLE_MS = 1500;
/** Downloading gets its own deadline; entering the phase always starts a fresh timer. */
const DOWNLOAD_STATUS_TIMEOUT_MS = 10_000;
/** Consecutive install attempts (within the window) that revert to the embedded
 *  bundle before we stop auto-installing and leave the user on what works. */
const INSTALL_LOOP_MAX = 3;
const INSTALL_LOOP_WINDOW_MS = 10 * 60 * 1000;
const INSTALL_LOOP_STORAGE_KEY = "mf:updater:installLoop";
/** High-water mark (ms) of the newest native expo-updates log entry already shipped,
 *  so the same entries aren't re-emitted on every launch within the read window. */
const NATIVE_LOG_TS_KEY = "mf:updater:lastNativeLogTs";

type UpdaterStatusPhase =
  | "idle"
  | "startup"
  | "checking"
  | "downloading"
  | "installing"
  | "restarting";

function setUpdaterStatusText(text: string | null) {
  runInAction(() => {
    _unmaskedStatusText.set(text);
    _statusText.set(Updater.shouldDeferUpdate() ? null : text);
  });
}

export const Updater = {
  // ===================================================================
  // OTA updates
  // ===================================================================

  get statusText(): string | null {
    return _statusText.get();
  },

  _updateCheckPromise: null as Promise<boolean> | null,
  _shouldDeferUpdate: null as (() => boolean) | null,
  _installTimeout: null as ReturnType<typeof setTimeout> | null,
  _reloadInFlight: false,
  /** Resolves once _evaluateInstallCircuit has read persisted loop state, so
   *  installUpdate never acts on a stale suppression decision. */
  _installCircuitReady: null as Promise<void> | null,
  /** True once a downgrade loop has been detected this session. Distinct from
   *  _suppressedUpdateId, which is null when the looping update id is unknown. */
  _circuitOpen: false,
  /** Update id the install-loop circuit is suppressing; null means "unknown id"
   *  (rollback / legacy state) → suppress all installs while the circuit is open. */
  _suppressedUpdateId: null as string | null,
  /** Last recorded install attempt observed during an embedded/recovery launch.
   *  Used to recognize a fix-forward before the loop circuit fully opens. */
  _lastFailedUpdateId: null as string | null,
  /** Consecutive reloadAsync() failures this session (e.g. "appContext not set"
   *  when reloading too early). Bounds the in-session reload retry storm. */
  _reloadFailures: 0,
  /** Mirrors useUpdates().isStartupProcedureRunning so every automatic install
   *  path can avoid reloadAsync() while Expo is still completing startup. */
  _isStartupProcedureRunning: false,
  /** Set by useSetupFoundation once fonts, AppMeta, AppStorage, and app-specific
   *  readiness have completed. Default true preserves direct/test installs that
   *  do not mount the foundation hook. */
  _appReady: true,
  /** Last pending update observed from useUpdates(); used to retry deferred
   *  installs when the app returns to the foreground. */
  _pendingInstallUpdateId: undefined as string | null | undefined,
  /** Last update id returned by fetchUpdateAsync(); lets documented no-arg install
   *  calls make the same recovery/fix-forward decision as hook-driven installs. */
  _lastDownloadedUpdateId: undefined as string | null | undefined,

  /**
   * Register a predicate that, while it returns true, defers BOTH an OTA reload
   * and the required-native-update alert (e.g. during an active call or in-progress
   * transaction). Read reactively, so if it reads observables the deferred work
   * re-evaluates when they change.
   */
  setUpdateDeferralListener(listener: (() => boolean) | null) {
    Updater._shouldDeferUpdate = listener;
    Updater._startInstallDeferralAutorun();
    Updater._maybeShowNativeUpdateAlert();
  },

  shouldDeferUpdate() {
    return Updater._shouldDeferUpdate?.() ?? false;
  },

  /** @internal Called by useSetupFoundation */
  _useHook(appReady = true) {
    useEffect(() => {
      Updater._appReady = appReady;
      Updater._trySchedulePendingInstall();
    }, [appReady]);

    useEffect(() => {
      logger.info("Runtime info", {
        createdAt: Updates.createdAt,
        isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        isEmergencyLaunch: Updates.isEmergencyLaunch,
        emergencyLaunchReason: Updates.emergencyLaunchReason,
        launchDuration: Updates.launchDuration,
        runtimeVersion: Updates.runtimeVersion,
        updateId: Updates.updateId,
      });

      // Native (app-store) update status is independent of OTA and must run in all
      // builds (incl. dev / E2E), so it runs before the dev gate. It self-skips when
      // MUS config is absent.
      Updater.loadNativeStatus();

      if (AppMeta.isDevelopment) return;

      // Decide up front whether we're stuck in an install/downgrade loop.
      // installUpdate awaits this before acting on the suppression decision.
      Updater._installCircuitReady = Updater._evaluateInstallCircuit();
      Updater._startInstallDeferralAutorun();

      // Ship expo-updates' native log so the previous launch's failure
      // chain (the error that rolled us back to the embedded bundle) is
      // captured — it never reaches the JS logger otherwise.
      void Updater._logNativeUpdateLog();

      // Device-targeted OTA request headers (OTA-only -> after the dev gate). Register
      // before the first check so AppMeta.load() applies headers first.
      Updater._startHeadersSync();

      AppMeta.load()
        .then(() => Updater._startHeadersSync())
        .then(() => {
          Updater.downloadUpdate();
        });
    }, []);

    if (!AppMeta.isDevelopment) {
      useAppActivatedEffect(() => {
        Updater.downloadUpdate();
        Updater._trySchedulePendingInstall();
      });

      const updates = Updates.useUpdates();
      useEffect(() => {
        Updater._isStartupProcedureRunning = updates.isStartupProcedureRunning;
        if (!updates.isStartupProcedureRunning) Updater._trySchedulePendingInstall();
      }, [updates.isStartupProcedureRunning]);

      const checkingTimeoutMs = getFoundationConfig().updaterTimeout;
      // Expo's startup flag is an envelope around startup checking/downloading,
      // not a mutually exclusive phase. Prefer the concrete operation so each
      // transition receives the correct status and timeout.
      const statusPhase: UpdaterStatusPhase = updates.isRestarting
        ? "restarting"
        : updates.isDownloading
          ? "downloading"
          : updates.isUpdatePending
            ? "installing"
            : updates.isChecking
              ? "checking"
              : updates.isStartupProcedureRunning
                ? "startup"
                : "idle";
      const phaseTimeoutMs =
        statusPhase === "downloading"
          ? DOWNLOAD_STATUS_TIMEOUT_MS
          : statusPhase === "startup" || statusPhase === "checking"
            ? checkingTimeoutMs
            : undefined;
      const [timedOutPhase, setTimedOutPhase] = useState<UpdaterStatusPhase | null>(null);

      useEffect(() => {
        // A timeout belongs only to the phase that created it. Moving to a new
        // phase immediately makes that phase visible and starts its full timeout.
        setTimedOutPhase(null);
        if (!phaseTimeoutMs) return;
        const phase = statusPhase;
        const t = setTimeout(() => setTimedOutPhase(phase), phaseTimeoutMs);
        return () => clearTimeout(t);
      }, [statusPhase, phaseTimeoutMs]);

      useEffect(() => {
        let text: string | null = null;
        const phaseTimedOut = timedOutPhase === statusPhase;
        if (statusPhase === "startup" && !phaseTimedOut) {
          text = "Starting up...";
        } else if (statusPhase === "restarting") {
          text = "Restarting to install update...";
        } else if (statusPhase === "downloading" && !phaseTimedOut) {
          text = "Downloading update...";
        } else if (statusPhase === "installing") {
          const pendingId = updates.downloadedUpdate?.updateId ?? null;
          Updater._pendingInstallUpdateId = pendingId;
          // Retain the pending status internally while user-facing updates are
          // deferred, so it can reappear and install as soon as deferral clears.
          if (Updater._canAutoInstallPendingUpdate(pendingId, true, true)) {
            text = "Installing update...";
            if (!Updater.shouldDeferUpdate() && !Updater._isStartupProcedureRunning) {
              Updater.scheduleInstallUpdate(pendingId);
            }
          }
        } else if (statusPhase === "checking" && !phaseTimedOut) {
          text = "Checking for updates...";
        } else {
          Updater._pendingInstallUpdateId = undefined;
        }
        setUpdaterStatusText(text);
      }, [updates, statusPhase, timedOutPhase, appReady]);
    }
  },

  async downloadUpdate() {
    if (Updater._updateCheckPromise) return Updater._updateCheckPromise;
    Updater._updateCheckPromise = Updater._downloadUpdate().finally(() => {
      Updater._updateCheckPromise = null;
    });
    return Updater._updateCheckPromise;
  },

  async _downloadUpdate() {
    if (Updater.shouldDeferUpdate()) {
      logger.info("Skipping update check (deferred)");
      return false;
    }

    try {
      logger.info("Performing update check");
      const result = await Updates.checkForUpdateAsync();
      logger.info("Update check result", result);
      if (!result.isAvailable) return false;
    } catch (err) {
      logger.error("Failed to check for updates", err);
      return false;
    }

    try {
      const result = await Updates.fetchUpdateAsync();
      logger.info("Update fetch result", result);
      Updater._lastDownloadedUpdateId = fetchedUpdateId(result);
      if (!Updater._lastDownloadedUpdateId) return false;
    } catch (err) {
      logger.error("Failed to download update", err);
      return false;
    }

    return true;
  },

  scheduleInstallUpdate(
    pendingUpdateIdOrDelayMs?: string | number | null,
    delayMs = INSTALL_SETTLE_MS,
  ) {
    const pendingUpdateId =
      typeof pendingUpdateIdOrDelayMs === "number" ? undefined : pendingUpdateIdOrDelayMs;
    const installDelayMs =
      typeof pendingUpdateIdOrDelayMs === "number" ? pendingUpdateIdOrDelayMs : delayMs;
    if (Updater._reloadInFlight) return;
    if (Updater._installTimeout) return;
    logger.info("Scheduling update install", { delayMs: installDelayMs, pendingUpdateId });
    Updater._installTimeout = setTimeout(() => {
      Updater._installTimeout = null;
      void Updater.installUpdate(pendingUpdateId);
    }, installDelayMs);
  },

  _cancelScheduledInstall(): boolean {
    if (!Updater._installTimeout) return false;
    clearTimeout(Updater._installTimeout);
    Updater._installTimeout = null;
    return true;
  },

  async installUpdate(pendingUpdateId?: string | null) {
    const resolvedPendingUpdateId = Updater._resolvePendingInstallUpdateId(pendingUpdateId);

    // Synchronous re-entrancy guard: set before any await so a second call
    // (e.g. a re-scheduled timeout) bails out immediately.
    if (Updater._reloadInFlight) return;
    Updater._reloadInFlight = true;

    // Wait for persisted loop state to be read so we don't act on a stale decision.
    if (Updater._installCircuitReady) await Updater._installCircuitReady;

    if (Updater._isInstallSuppressed(resolvedPendingUpdateId)) {
      logger.warn("Skipping auto-install: install-loop circuit is open", {
        pendingUpdateId: resolvedPendingUpdateId,
      });
      Updater._reloadInFlight = false;
      return;
    }
    // On a recovery launch, only auto-install a known different update id. That
    // lets a fix-forward OTA apply without reloading straight back into the same
    // failed update.
    if (Updates.isEmergencyLaunch && !Updater._isKnownFixForwardUpdate(resolvedPendingUpdateId)) {
      logger.warn("Skipping auto-install on emergency/recovery launch", {
        pendingUpdateId: resolvedPendingUpdateId,
        suppressedUpdateId: Updater._suppressedUpdateId,
      });
      Updater._reloadInFlight = false;
      return;
    }
    if (Updater._reloadFailures >= INSTALL_LOOP_MAX) {
      logger.warn("Skipping auto-install: too many reload failures this session", {
        failures: Updater._reloadFailures,
      });
      Updater._reloadInFlight = false;
      return;
    }
    if (Updater.shouldDeferUpdate()) {
      logger.info("Deferring update install");
      Updater._reloadInFlight = false;
      return;
    }
    if (!Updater._appReady) {
      logger.info("Deferring update install until app is ready");
      Updater._reloadInFlight = false;
      return;
    }
    if (AppState.currentState !== "active") {
      logger.info("Deferring update install until app is active", {
        appState: AppState.currentState,
      });
      Updater._reloadInFlight = false;
      return;
    }

    // Persist the attempt BEFORE reloading — reloadAsync tears down the JS
    // runtime, so a fire-and-forget write could be lost mid-flight.
    await Updater._recordInstallAttempt(resolvedPendingUpdateId);

    if (Updater.shouldDeferUpdate()) {
      logger.info("Deferring update install");
      await Updater._undoInstallAttempt(resolvedPendingUpdateId);
      Updater._reloadInFlight = false;
      return;
    }
    if (!Updater._appReady) {
      logger.info("Deferring update install until app is ready");
      await Updater._undoInstallAttempt(resolvedPendingUpdateId);
      Updater._reloadInFlight = false;
      return;
    }
    if (AppState.currentState !== "active") {
      logger.info("Deferring update install until app is active", {
        appState: AppState.currentState,
      });
      await Updater._undoInstallAttempt(resolvedPendingUpdateId);
      Updater._reloadInFlight = false;
      return;
    }

    logger.info("Installing update", { pendingUpdateId: resolvedPendingUpdateId });
    try {
      await Updates.reloadAsync();
      // reloadAsync resolves immediately before the reload is dispatched; no
      // meaningful JS runs after this, so we intentionally stay _reloadInFlight.
    } catch (err) {
      Updater._reloadInFlight = false;
      Updater._reloadFailures++;
      // The reload didn't happen, so don't let it inflate the loop counter.
      await Updater._undoInstallAttempt(resolvedPendingUpdateId);
      logger.error("Failed to install update", err);
    }
  },

  _canAutoInstallPendingUpdate(
    pendingUpdateId: string | null,
    ignoreDeferral = false,
    ignoreStartupProcedure = false,
  ): boolean {
    const resolvedPendingUpdateId = Updater._resolvePendingInstallUpdateId(pendingUpdateId);
    if (!Updater._appReady) return false;
    if (AppState.currentState !== "active") return false;
    if (Updater._reloadInFlight) return false;
    if (Updater._reloadFailures >= INSTALL_LOOP_MAX) return false;
    if (!ignoreDeferral && Updater.shouldDeferUpdate()) return false;
    if (!ignoreStartupProcedure && Updater._isStartupProcedureRunning) return false;
    if (Updater._isInstallSuppressed(resolvedPendingUpdateId)) return false;
    if (Updates.isEmergencyLaunch && !Updater._isKnownFixForwardUpdate(resolvedPendingUpdateId)) {
      return false;
    }
    return true;
  },

  _trySchedulePendingInstall() {
    if (Updater._pendingInstallUpdateId === undefined) return;
    if (!Updater._canAutoInstallPendingUpdate(Updater._pendingInstallUpdateId)) return;
    Updater.scheduleInstallUpdate(Updater._pendingInstallUpdateId);
  },

  _startInstallDeferralAutorun() {
    _installDeferralDisposer?.();
    _installDeferralDisposer = autorun(() => {
      const deferred = Updater.shouldDeferUpdate();
      runInAction(() => {
        _statusText.set(deferred ? null : _unmaskedStatusText.get());
      });
      if (deferred) {
        Updater._cancelScheduledInstall();
        return;
      }
      Updater._trySchedulePendingInstall();
    });
  },

  _resolvePendingInstallUpdateId(pendingUpdateId: string | null | undefined): string | null {
    if (pendingUpdateId !== undefined) return pendingUpdateId;
    if (Updater._pendingInstallUpdateId !== undefined && Updater._pendingInstallUpdateId !== null) {
      return Updater._pendingInstallUpdateId;
    }
    if (Updater._lastDownloadedUpdateId !== undefined) return Updater._lastDownloadedUpdateId;
    if (Updater._pendingInstallUpdateId !== undefined) return Updater._pendingInstallUpdateId;
    return null;
  },

  _isKnownFixForwardUpdate(pendingUpdateId: string | null): boolean {
    const failedUpdateId = Updater._lastFailedUpdateId ?? Updater._suppressedUpdateId;
    if (pendingUpdateId === null) return false;
    return failedUpdateId !== null && pendingUpdateId !== failedUpdateId;
  },

  /** True when `pendingUpdateId` is the update the circuit is suppressing (or the
   *  pending id is unknown while a suppression is active). A different update id
   *  — e.g. a newly published fix-forward — is allowed through. */
  _isInstallSuppressed(pendingUpdateId: string | null): boolean {
    if (!Updater._circuitOpen) return false;
    // Circuit open: block the looping id — or everything if the looping id or the
    // pending id is unknown. A different, known id (e.g. a fix-forward) passes.
    return (
      Updater._suppressedUpdateId === null ||
      pendingUpdateId === null ||
      pendingUpdateId === Updater._suppressedUpdateId
    );
  },

  /**
   * On launch, decide whether auto-install should be held back because the app is
   * stuck reinstalling an update that keeps reverting to the embedded bundle (a
   * downgrade loop). A normal OTA launch means the last install stuck → clear the
   * tracking. An embedded/recovery launch with a recent run of attempts (same
   * update id, within the window) opens the circuit for that id and we stop
   * auto-installing it. A FIRST install (embedded, non-emergency, no prior record)
   * is unaffected and still auto-installs.
   */
  async _evaluateInstallCircuit() {
    try {
      if (!Updates.isEmbeddedLaunch && !Updates.isEmergencyLaunch) {
        // A downloaded update launched normally — the last install stuck.
        Updater._circuitOpen = false;
        Updater._suppressedUpdateId = null;
        Updater._lastFailedUpdateId = null;
        await AsyncStorage.removeItem(INSTALL_LOOP_STORAGE_KEY);
        return;
      }
      const state = await Updater._readLoopState();
      Updater._lastFailedUpdateId = state?.updateId ?? null;
      if (state && state.count >= INSTALL_LOOP_MAX) {
        Updater._circuitOpen = true;
        Updater._suppressedUpdateId = state.updateId;
        // Cancel any install the hook optimistically scheduled, and clear a
        // stale "Installing update..." status so it can't gate the splash.
        Updater._cancelScheduledInstall();
        if (_unmaskedStatusText.get() === "Installing update...") {
          setUpdaterStatusText(null);
        }
        logger.warn(
          "Auto-install suppressed: update keeps reverting to the embedded bundle",
          state,
        );
      }
      Updater._trySchedulePendingInstall();
    } catch (err) {
      logger.warn("Failed to evaluate install circuit", err);
    }
  },

  /** Read + validate the persisted loop record. Discards corrupt/stale state
   *  (bad shape, outside the window, or a backwards clock). */
  async _readLoopState(): Promise<{
    updateId: string | null;
    count: number;
    firstAt: number;
  } | null> {
    const raw = await AsyncStorage.getItem(INSTALL_LOOP_STORAGE_KEY);
    if (!raw) return null;
    let parsed: { updateId?: string | null; count?: number; firstAt?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      await AsyncStorage.removeItem(INSTALL_LOOP_STORAGE_KEY);
      return null;
    }
    if (typeof parsed.count !== "number" || typeof parsed.firstAt !== "number") {
      await AsyncStorage.removeItem(INSTALL_LOOP_STORAGE_KEY);
      return null;
    }
    const elapsed = Date.now() - parsed.firstAt;
    if (elapsed < 0 || elapsed >= INSTALL_LOOP_WINDOW_MS) {
      await AsyncStorage.removeItem(INSTALL_LOOP_STORAGE_KEY);
      return null;
    }
    return { updateId: parsed.updateId ?? null, count: parsed.count, firstAt: parsed.firstAt };
  },

  /** Record an install attempt (keyed by update id) so a revert-to-embedded on the
   *  next launch is detectable as a loop. A different update id starts fresh — only
   *  one update is pending at a time (the latest for the channel/runtime), so
   *  replacing a prior id's record is correct; an already-detected loop stays
   *  suppressed this session via _circuitOpen regardless of storage. Best-effort. */
  async _recordInstallAttempt(updateId: string | null) {
    try {
      const prev = await Updater._readLoopState();
      const next =
        prev && prev.updateId === updateId
          ? { updateId, count: prev.count + 1, firstAt: prev.firstAt }
          : { updateId, count: 1, firstAt: Date.now() };
      await AsyncStorage.setItem(INSTALL_LOOP_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort; loop protection is advisory
    }
  },

  /** Roll back the most recent attempt when a reload did not actually happen, so
   *  transient reloadAsync failures don't open the loop circuit. Best-effort. */
  async _undoInstallAttempt(updateId: string | null) {
    try {
      const prev = await Updater._readLoopState();
      if (!prev || prev.updateId !== updateId) return;
      if (prev.count <= 1) {
        await AsyncStorage.removeItem(INSTALL_LOOP_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(
          INSTALL_LOOP_STORAGE_KEY,
          JSON.stringify({ ...prev, count: prev.count - 1 }),
        );
      }
    } catch {
      // best-effort
    }
  },

  /**
   * Ship expo-updates' on-device native log to our logger. That log carries the
   * failure chain (UpdateFailedToLoad / JSRuntimeError / AssetsFailedToLoad /
   * NoUpdatesAvailable, with native stack traces) that the JS logger never sees —
   * e.g. when an OTA is marked a failed launch before first render and the
   * launcher rolls back to the embedded bundle. We read a recent window on every
   * launch so the *previous* failed launch's entries are captured, and emit the
   * full set on a recovery (emergency) launch.
   */
  async _logNativeUpdateLog() {
    try {
      const entries = await Updates.readLogEntriesAsync(5 * 60 * 1000);
      if (!entries.length) return;

      // De-dupe across launches: only consider entries newer than the last one
      // we shipped, then advance the high-water mark across all read entries.
      let lastTs = 0;
      try {
        const raw = await AsyncStorage.getItem(NATIVE_LOG_TS_KEY);
        if (raw) lastTs = Number(raw) || 0;
      } catch {
        // treat as no watermark
      }
      const fresh = entries.filter((e) => typeof e.timestamp === "number" && e.timestamp > lastTs);
      const maxTs = entries.reduce(
        (m, e) => (typeof e.timestamp === "number" && e.timestamp > m ? e.timestamp : m),
        lastTs,
      );
      if (maxTs > lastTs) {
        try {
          await AsyncStorage.setItem(NATIVE_LOG_TS_KEY, String(maxTs));
        } catch {
          // best-effort
        }
      }
      if (!fresh.length) return;

      // Failure codes worth surfacing; healthy chatter (None / NoUpdatesAvailable)
      // is excluded outside emergency launches to avoid noise on every launch.
      const FAILURE_CODES = new Set([
        "UpdateFailedToLoad",
        "AssetsFailedToLoad",
        "JSRuntimeError",
        "UpdateServerUnreachable",
        "UpdateHasInvalidSignature",
        "UpdateCodeSigningError",
        "InitializationError",
        "UpdateAssetsNotAvailable",
        "Unknown",
      ]);
      const isNotable = (e: { level: unknown; code: unknown }) => {
        const level = String(e.level);
        return (
          level === "error" ||
          level === "fatal" ||
          level === "warn" ||
          FAILURE_CODES.has(String(e.code))
        );
      };
      // On a recovery launch the whole recent (fresh) log is diagnostic; otherwise
      // only ship failures. Capped in count and per-entry size to bound payloads.
      const selected = (Updates.isEmergencyLaunch ? fresh : fresh.filter(isNotable)).slice(-25);
      if (!selected.length) return;
      logger.warn("expo-updates native log", {
        isEmergencyLaunch: Updates.isEmergencyLaunch,
        emergencyLaunchReason: Updates.emergencyLaunchReason,
        total: entries.length,
        entries: selected.map((e) => ({
          timestamp: e.timestamp,
          level: e.level,
          code: e.code,
          message: typeof e.message === "string" ? e.message.slice(0, 500) : e.message,
          updateId: e.updateId,
          assetId: e.assetId,
          stacktrace: Array.isArray(e.stacktrace) ? e.stacktrace.slice(0, 8) : e.stacktrace,
        })),
      });
    } catch (err) {
      logger.warn("Failed to read expo-updates native log", err);
    }
  },

  // ===================================================================
  // Device-targeted OTA request headers (channel / device)
  // ===================================================================

  _startHeadersSync(): Promise<void> {
    if (AppMeta.isDevelopment) return Promise.resolve();
    if (_headersSyncPromise) return _headersSyncPromise;
    if (!getFoundationConfig().env.MUS_CHANNEL) return Promise.resolve();
    if (!Updates.isEmbeddedLaunch || Updates.isEmergencyLaunch) {
      logger.info("Preserving existing update request headers on OTA launch");
      _headersSyncPromise = Promise.resolve();
      return _headersSyncPromise;
    }

    _headersSyncPromise = AppMeta.load()
      .then(() => Updater._applyRequestHeaders())
      .catch((err) => {
        logger.warn("Failed to initialize updater headers", err);
      });
    return _headersSyncPromise;
  },

  _applyRequestHeaders() {
    const env = getFoundationConfig().env;
    const headers: Record<string, string> = {
      "expo-channel-name": env.MUS_CHANNEL ?? "",
      "mus-device-id": AppMeta.deviceId,
    };
    try {
      Updates.setUpdateRequestHeadersOverride(headers);
    } catch (err) {
      logger.warn("Failed to set update request headers", err);
    }
  },

  // ===================================================================
  // Native (app-store) updates — required/available status via MUS
  // ===================================================================

  get nativeStatus(): INativeUpdateStatus | null {
    return _nativeStatus.get();
  },

  get hasNativeUpdate(): boolean {
    const s = _nativeStatus.get();
    if (!s?.latestStoreVersion) return false;
    return compareVersions(AppMeta.baseAppVersion, s.latestStoreVersion) < 0;
  },

  get nativeUpdateDeadline(): Date | null {
    const s = _nativeStatus.get();
    if (!s?.nativeUpdateRequiredAt) return null;
    const d = new Date(s.nativeUpdateRequiredAt);
    return isNaN(d.getTime()) ? null : d;
  },

  get isNativeUpdateRequired(): boolean {
    return _nativeStatus.get()?.nativeUpdateRequired === true;
  },

  get nativeUpdateDaysUntilRequired(): number | null {
    const d = Updater.nativeUpdateDeadline;
    if (!d) return null;
    const ms = d.getTime() - Date.now();
    if (ms <= 0) return null;
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  },

  get nativeDeadlineText(): string | null {
    if (Updater.isNativeUpdateRequired) return "An update is required to continue.";
    const d = Updater.nativeUpdateDeadline;
    if (!d) return null;
    const days = Updater.nativeUpdateDaysUntilRequired;
    if (days !== null)
      return `This version will stop working in ${days} ${days === 1 ? "day" : "days"}.`;
    return "This version will stop working in the near future.";
  },

  async loadNativeStatus() {
    const env = getFoundationConfig().env;
    if (!env.MUS_URL || !env.MUS_APP_ID || !env.MUS_CHANNEL) {
      logger.info("Native update status disabled (missing MUS_* config)");
      return;
    }
    if (!_nativeWatchStarted) {
      _nativeWatchStarted = true;
      autorun(() => {
        Updater._maybeShowNativeUpdateAlert();
      });
    }
    if (!_nativeAppStateListenerStarted) {
      _nativeAppStateListenerStarted = true;
      let lastAppState: string = AppState.currentState;
      AppState.addEventListener("change", (state) => {
        if (state === "active" && lastAppState !== "active") {
          void Updater._fetchNativeStatus();
        }
        lastAppState = state;
      });
    }
    await Updater._fetchNativeStatus();
  },

  async _fetchNativeStatus() {
    const env = getFoundationConfig().env;
    if (!env.MUS_URL || !env.MUS_APP_ID || !env.MUS_CHANNEL) return;
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const url = `${env.MUS_URL}/api/manifest/${env.MUS_APP_ID}/native-status?channelId=${encodeURIComponent(env.MUS_CHANNEL)}&platform=${platform}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn("Native status fetch failed", { status: res.status });
        return;
      }
      const data = (await res.json()) as INativeUpdateStatus;
      logger.info("Native status received", data);
      runInAction(() => _nativeStatus.set(data));
      Updater._maybeShowNativeUpdateAlert();
    } catch (err) {
      logger.error("Native status fetch error", err);
    }
  },

  openStore() {
    const s = _nativeStatus.get();
    if (!s?.storeUrl) return;
    Linking.openURL(s.storeUrl).catch((err) => logger.error("Failed to open store URL", err));
  },

  /** Show the global loader and never dismiss it — used after the user taps OK on
   *  the required-update alert so the app appears locked while they install from the store. */
  lockUiPermanently() {
    runInAction(() => {
      LoaderState.loaderCount++;
    });
  },

  _maybeShowNativeUpdateAlert() {
    if (_nativeAlertShown) return;
    if (!Updater.hasNativeUpdate) return;
    if (!Updater.isNativeUpdateRequired) return;
    if (Updater.shouldDeferUpdate()) {
      logger.info("Deferring required-update alert (deferral listener)");
      return;
    }
    _nativeAlertShown = true;
    Alert.alert(
      "Update Required",
      `This version of the app is obsolete and requires an update. Tap OK to launch the ${Platform.OS === "ios" ? "App Store" : "Play Store"}.`,
      [
        {
          text: "OK",
          onPress: () => {
            Updater.openStore();
            Updater.lockUiPermanently();
          },
        },
      ],
      { cancelable: false },
    );
  },

  /** Reset native-update state (test helper). */
  _resetNative() {
    runInAction(() => _nativeStatus.set(null));
    _nativeAlertShown = false;
  },
};
