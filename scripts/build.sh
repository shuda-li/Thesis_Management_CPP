#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
if [ ! -f build/sqlite3.o ] || [ third_party/sqlite3.c -nt build/sqlite3.o ]; then
  "${CC:-gcc}" -O2 -DSQLITE_THREADSAFE=1 -DSQLITE_DQS=0 -c third_party/sqlite3.c -o build/sqlite3.o
fi
"${CXX:-g++}" -std=c++17 -O2 -Wall -Wextra -Wpedantic -pthread -Iinclude -Ithird_party src/main.cpp src/app.cpp build/sqlite3.o -ldl -o build/thesis_manager
echo "Built: build/thesis_manager"
