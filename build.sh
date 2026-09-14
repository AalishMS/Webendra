#!/usr/bin/env bash
# Builds the wasm client and drops its output where the server serves it
# from (static/pkg/), then builds the server binary.
set -euo pipefail
cd "$(dirname "$0")"

cargo build -p webendra-web --release --target wasm32-unknown-unknown

wasm-bindgen \
  --target web \
  --out-dir static/pkg \
  --out-name app \
  --no-typescript \
  target/wasm32-unknown-unknown/release/webendra_web.wasm

cargo build -p webendra-server --release

echo "Built. Run with: ./target/release/webendra-server"
