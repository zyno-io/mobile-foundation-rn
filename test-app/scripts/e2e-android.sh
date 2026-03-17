#!/usr/bin/env bash
set -euo pipefail

# Build and run Detox E2E tests on Android Emulator
# Usage:
#   ./scripts/e2e-android.sh                # build + test (debug)
#   ./scripts/e2e-android.sh --no-build     # test only (skip build)
#   ./scripts/e2e-android.sh --release      # build + test (release)
#   DETOX_ANDROID_AVD="Pixel_7_API_34" ./scripts/e2e-android.sh   # override AVD
#
# Prerequisites:
#   - Android emulator AVD must exist (default: Galaxy_S23_API_34)
#   - Metro bundler should be running for debug builds: yarn start

cd "$(dirname "$0")/.."

NO_BUILD=false
RELEASE=false

for arg in "$@"; do
    case $arg in
        --no-build) NO_BUILD=true; shift ;;
        --release)  RELEASE=true; shift ;;
    esac
done

if [ "$RELEASE" = true ]; then
    CONFIG="android.emu.release"
else
    CONFIG="android.emu.debug"
fi

if [ "$NO_BUILD" = false ]; then
    echo "==> Building Android app for Detox ($CONFIG)..."
    yarn detox build -c "$CONFIG"
fi

echo "==> Running E2E tests on Android ($CONFIG)..."
yarn detox test -c "$CONFIG" "$@"
