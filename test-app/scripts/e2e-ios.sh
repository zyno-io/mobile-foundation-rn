#!/usr/bin/env bash
set -euo pipefail

# Build and run Detox E2E tests on iOS Simulator
# Usage:
#   ./scripts/e2e-ios.sh                    # build + test (debug)
#   ./scripts/e2e-ios.sh --no-build         # test only (skip build)
#   ./scripts/e2e-ios.sh --release          # build + test (release, headless)
#   DETOX_IOS_DEVICE="iPhone 16" ./scripts/e2e-ios.sh   # override simulator

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
    CONFIG="ios.sim.release"
    EXTRA_ARGS="--headless"
else
    CONFIG="ios.sim.debug"
    EXTRA_ARGS=""
fi

if [ "$NO_BUILD" = false ]; then
    echo "==> Generating iOS project..."
    yarn expo prebuild --clean --no-install --platform ios
    bundle install
    LANG=en_US.UTF-8 bundle exec pod install --project-directory=ios

    echo "==> Building iOS app for Detox ($CONFIG)..."
    yarn detox build -c "$CONFIG"
fi

echo "==> Running E2E tests on iOS ($CONFIG)..."
yarn detox test -c "$CONFIG" $EXTRA_ARGS "$@"
