#!/usr/bin/env bash
set -euo pipefail

# Run TypeScript type checking on the parent library
cd "$(dirname "$0")/../.."
echo "==> Running typecheck..."
yarn typecheck
