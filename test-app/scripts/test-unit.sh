#!/usr/bin/env bash
set -euo pipefail

# Run unit tests (helpers, services, config) from the parent library
cd "$(dirname "$0")/../.."
echo "==> Running unit tests..."
yarn test:unit "$@"
