#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
printf '%s\n' "LUMICAP Ubuntu dependencies are being installed..."
npm ci
printf '%s\n' "Building AppImage and deb..."
npm run dist:linux
printf '%s\n' "Completed. Files are available in: $(pwd)/release"

