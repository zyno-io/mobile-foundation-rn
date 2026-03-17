#!/usr/bin/env bash
set -uo pipefail

# Run all non-E2E tests (typecheck, unit, component, integration)
# For E2E, use e2e-ios.sh or e2e-android.sh separately
# Runs all suites and reports failures at the end.

SCRIPT_DIR="$(dirname "$0")"
FAILED=()

run_step() {
    local name="$1"
    shift
    echo ""
    echo "==============================="
    echo "  $name"
    echo "==============================="
    if "$@"; then
        echo "  ✓ $name passed"
    else
        FAILED+=("$name")
        echo "  ✗ $name failed"
    fi
}

run_step "Typecheck"            "$SCRIPT_DIR/test-typecheck.sh"
run_step "Unit Tests"           "$SCRIPT_DIR/test-unit.sh"
run_step "Component & Hook Tests" "$SCRIPT_DIR/test-components.sh"
run_step "Integration Tests"    "$SCRIPT_DIR/test-integration.sh"

echo ""
echo "==============================="
if [ ${#FAILED[@]} -eq 0 ]; then
    echo "  All tests passed!"
    echo "==============================="
    exit 0
else
    echo "  ${#FAILED[@]} suite(s) failed:"
    for f in "${FAILED[@]}"; do
        echo "    - $f"
    done
    echo "==============================="
    exit 1
fi
