#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build.sh
"${CXX:-g++}" -std=c++17 -O2 -Wall -Wextra -Iinclude -Ithird_party tests/security_test.cpp -o build/security_test
./build/security_test | tee docs/security-test-results.txt
"${PYTHON:-python3}" tests/integration_test.py
