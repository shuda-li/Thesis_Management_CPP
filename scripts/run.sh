#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x build/thesis_manager ]; then bash scripts/build.sh; fi
exec ./build/thesis_manager "$@"
