#!/usr/bin/env bash
set -euo pipefail

# Run integration tests from the parent library
cd "$(dirname "$0")/../.."
echo "==> Running integration tests..."
yarn test:integration "$@"
