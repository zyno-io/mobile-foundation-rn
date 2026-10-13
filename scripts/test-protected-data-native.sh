#!/usr/bin/env bash
set -euo pipefail
TASK_REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TASK_TEST_DIR"' EXIT
swiftc -swift-version 5 "$TASK_REPO_ROOT/ios/ProtectedDataAvailability.swift" \
  "$TASK_REPO_ROOT/__tests__/native/ProtectedDataAvailability/main.swift" \
  -o "$TASK_TEST_DIR/protected-data-tests"
"$TASK_TEST_DIR/protected-data-tests"
