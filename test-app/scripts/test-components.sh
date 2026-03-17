#!/usr/bin/env bash
set -euo pipefail

# Run component & hook tests from the parent library
cd "$(dirname "$0")/../.."
echo "==> Running component & hook tests..."
yarn test:components "$@"
