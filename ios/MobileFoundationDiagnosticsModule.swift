import ExpoModulesCore
import Foundation
#if canImport(sqlite3)
import sqlite3
#else
import SQLite3
#endif

public final class MobileFoundationDiagnosticsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MobileFoundationDiagnostics")

    AsyncFunction("getExpoUpdatesDatabaseDiagnosticsAsync") {
      ExpoUpdatesDatabaseDiagnostics.collect()
    }
  }
}

private enum ExpoUpdatesDatabaseDiagnostics {
  private static let databaseFilename = "expo-v11.db"
  private static let updateLimit: Int32 = 20

  static func collect() -> [String: Any] {
    let fileManager = FileManager.default
    guard let documentsDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
      return [
        "ok": false,
        "databaseFilename": databaseFilename,
        "error": "Application documents directory is unavailable"
      ]
    }

    let updatesDirectory = documentsDirectory.appendingPathComponent(".expo-internal", isDirectory: true)
    let databaseURL = updatesDirectory.appendingPathComponent(databaseFilename)
    var result: [String: Any] = [
      "ok": false,
      "databaseFilename": databaseFilename,
      "databaseFiles": databaseFileMetadata(databaseURL: databaseURL, fileManager: fileManager)
    ]

    guard fileManager.fileExists(atPath: databaseURL.path) else {
      result["error"] = "Expo Updates database does not exist"
      return result
    }

    var database: OpaquePointer?
    let openResult = sqlite3_open_v2(
      databaseURL.path,
      &database,
      SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX,
      nil
    )
    guard openResult == SQLITE_OK, let database else {
      result["sqliteCode"] = openResult
      result["error"] = sqliteMessage(database) ?? "Unable to open Expo Updates database"
      if database != nil {
        sqlite3_close(database)
      }
      return result
    }
    defer { sqlite3_close(database) }

    sqlite3_busy_timeout(database, 250)
    result["sqliteVersion"] = String(cString: sqlite3_libversion())
    result["schemaVersion"] = jsonValue(firstInteger(database: database, sql: "PRAGMA user_version;"))
    result["journalMode"] = jsonValue(firstText(database: database, sql: "PRAGMA journal_mode;"))
    result["quickCheck"] = jsonValue(firstText(database: database, sql: "PRAGMA quick_check(1);"))

    do {
      let updates = try readUpdates(database: database, updatesDirectory: updatesDirectory, fileManager: fileManager)
      result["updates"] = updates
      result["updateCount"] = jsonValue(firstInteger(database: database, sql: "SELECT COUNT(*) FROM updates;"))
      result["launchableCandidateCount"] = updates.filter { ($0["isLaunchableCandidate"] as? Bool) == true }.count
      result["jsonData"] = try readJSONDataMetadata(database: database)
      result["ok"] = true
    } catch {
      result["sqliteCode"] = sqlite3_errcode(database)
      result["error"] = error.localizedDescription
    }

    return result
  }

  private static func databaseFileMetadata(databaseURL: URL, fileManager: FileManager) -> [[String: Any]] {
    return ["database", "wal", "sharedMemory"].enumerated().map { index, kind in
      let suffixes = ["", "-wal", "-shm"]
      let url = URL(fileURLWithPath: databaseURL.path + suffixes[index])
      guard let attributes = try? fileManager.attributesOfItem(atPath: url.path) else {
        return ["kind": kind, "exists": false]
      }
      return [
        "kind": kind,
        "exists": true,
        "size": (attributes[.size] as? NSNumber)?.int64Value ?? 0,
        "modifiedAt": jsonValue((attributes[.modificationDate] as? Date)?.timeIntervalSince1970)
      ]
    }
  }

  private static func readUpdates(
    database: OpaquePointer,
    updatesDirectory: URL,
    fileManager: FileManager
  ) throws -> [[String: Any]] {
    let sql = """
      SELECT
        lower(hex(u.id)),
        u.scope_key,
        u.commit_time,
        u.runtime_version,
        u.status,
        u.keep,
        u.last_accessed,
        u.successful_launch_count,
        u.failed_launch_count,
        u.launch_asset_id,
        (SELECT COUNT(*) FROM updates_assets ua WHERE ua.update_id = u.id),
        (SELECT COUNT(*) FROM updates_assets ua JOIN assets a ON a.id = ua.asset_id
          WHERE ua.update_id = u.id AND a.marked_for_deletion != 0),
        (SELECT relative_path FROM assets a WHERE a.id = u.launch_asset_id)
      FROM updates u
      ORDER BY u.commit_time DESC
      LIMIT \(updateLimit);
      """

    var statement: OpaquePointer?
    let prepareResult = sqlite3_prepare_v2(database, sql, -1, &statement, nil)
    guard prepareResult == SQLITE_OK, let statement else {
      throw diagnosticError(database: database, operation: "prepare update diagnostics query")
    }
    defer { sqlite3_finalize(statement) }

    var updates: [[String: Any]] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      let idHex = text(statement: statement, column: 0) ?? ""
      let status = Int(sqlite3_column_int(statement, 4))
      let successfulLaunchCount = Int(sqlite3_column_int(statement, 7))
      let failedLaunchCount = Int(sqlite3_column_int(statement, 8))
      let launchAssetId = nullableInteger(statement: statement, column: 9)
      let launchAssetRelativePath = text(statement: statement, column: 12)
      let hasLaunchableStatus = status == 1 || status == 5 || status == 6
      let passesLaunchCountCheck = successfulLaunchCount > 0 || failedLaunchCount < 1
      let readyWithoutLaunchAsset = status == 1 && launchAssetId == nil
      let exclusionReasons = exclusionReasons(
        hasLaunchableStatus: hasLaunchableStatus,
        passesLaunchCountCheck: passesLaunchCountCheck,
        readyWithoutLaunchAsset: readyWithoutLaunchAsset
      )

      var update: [String: Any] = [
        "id": formatUUID(hex: idHex),
        "idHex": idHex,
        "scopeKey": jsonValue(text(statement: statement, column: 1)),
        "commitTime": sqlite3_column_int64(statement, 2),
        "runtimeVersion": jsonValue(text(statement: statement, column: 3)),
        "status": status,
        "statusName": statusName(status),
        "keep": sqlite3_column_int(statement, 5) != 0,
        "lastAccessed": sqlite3_column_int64(statement, 6),
        "successfulLaunchCount": successfulLaunchCount,
        "failedLaunchCount": failedLaunchCount,
        "launchAssetId": jsonValue(launchAssetId),
        "assetCount": Int(sqlite3_column_int(statement, 10)),
        "assetsMarkedForDeletion": Int(sqlite3_column_int(statement, 11)),
        "isLaunchableCandidate": hasLaunchableStatus && passesLaunchCountCheck && !readyWithoutLaunchAsset,
        "exclusionReasons": exclusionReasons
      ]
      if let launchAssetRelativePath {
        let launchAssetURL = updatesDirectory.appendingPathComponent(launchAssetRelativePath)
        update["launchAssetFileExists"] = fileManager.fileExists(atPath: launchAssetURL.path)
      } else {
        update["launchAssetFileExists"] = NSNull()
      }
      updates.append(update)
    }

    let stepResult = sqlite3_errcode(database)
    guard stepResult == SQLITE_OK || stepResult == SQLITE_DONE else {
      throw diagnosticError(database: database, operation: "read update diagnostics rows")
    }
    return updates
  }

  private static func readJSONDataMetadata(database: OpaquePointer) throws -> [[String: Any]] {
    let sql = "SELECT key, scope_key, last_updated FROM json_data ORDER BY last_updated DESC;"
    var statement: OpaquePointer?
    let prepareResult = sqlite3_prepare_v2(database, sql, -1, &statement, nil)
    guard prepareResult == SQLITE_OK, let statement else {
      throw diagnosticError(database: database, operation: "prepare metadata diagnostics query")
    }
    defer { sqlite3_finalize(statement) }

    var rows: [[String: Any]] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      rows.append([
        "key": jsonValue(text(statement: statement, column: 0)),
        "scopeKey": jsonValue(text(statement: statement, column: 1)),
        "lastUpdated": sqlite3_column_int64(statement, 2)
      ])
    }
    let stepResult = sqlite3_errcode(database)
    guard stepResult == SQLITE_OK || stepResult == SQLITE_DONE else {
      throw diagnosticError(database: database, operation: "read metadata diagnostics rows")
    }
    return rows
  }

  private static func jsonValue<T>(_ value: T?) -> Any {
    guard let value else { return NSNull() }
    return value
  }

  private static func exclusionReasons(
    hasLaunchableStatus: Bool,
    passesLaunchCountCheck: Bool,
    readyWithoutLaunchAsset: Bool
  ) -> [String] {
    var reasons: [String] = []
    if !hasLaunchableStatus {
      reasons.append("statusNotLaunchable")
    }
    if !passesLaunchCountCheck {
      reasons.append("failedWithoutSuccessfulLaunch")
    }
    if readyWithoutLaunchAsset {
      reasons.append("readyWithoutLaunchAsset")
    }
    return reasons
  }

  private static func statusName(_ status: Int) -> String {
    switch status {
    case 1: return "ready"
    case 3: return "pending"
    case 5: return "embedded"
    case 6: return "development"
    default: return "unknown"
    }
  }

  private static func formatUUID(hex: String) -> String {
    guard hex.count == 32 else { return hex }
    let offsets = [8, 12, 16, 20]
    var value = hex
    for offset in offsets.reversed() {
      let index = value.index(value.startIndex, offsetBy: offset)
      value.insert("-", at: index)
    }
    return value
  }

  private static func text(statement: OpaquePointer, column: Int32) -> String? {
    guard sqlite3_column_type(statement, column) != SQLITE_NULL,
      let value = sqlite3_column_text(statement, column) else {
      return nil
    }
    return String(cString: value)
  }

  private static func nullableInteger(statement: OpaquePointer, column: Int32) -> Int64? {
    guard sqlite3_column_type(statement, column) != SQLITE_NULL else { return nil }
    return sqlite3_column_int64(statement, column)
  }

  private static func firstInteger(database: OpaquePointer, sql: String) -> Int64? {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return nil
    }
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
    return sqlite3_column_int64(statement, 0)
  }

  private static func firstText(database: OpaquePointer, sql: String) -> String? {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return nil
    }
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
    return text(statement: statement, column: 0)
  }

  private static func diagnosticError(database: OpaquePointer, operation: String) -> NSError {
    let message = sqliteMessage(database) ?? "Unknown SQLite error"
    return NSError(
      domain: "MobileFoundationDiagnostics",
      code: Int(sqlite3_errcode(database)),
      userInfo: [NSLocalizedDescriptionKey: "Failed to \(operation): \(message)"]
    )
  }

  private static func sqliteMessage(_ database: OpaquePointer?) -> String? {
    guard let database, let message = sqlite3_errmsg(database) else { return nil }
    return String(cString: message)
  }
}
