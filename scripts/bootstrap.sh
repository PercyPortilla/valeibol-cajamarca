#!/usr/bin/env bash
set -euo pipefail

if [ -f app/page.tsx ] && [ -f lib/availability.ts ]; then
  echo "Valeibol source already restored."
  exit 0
fi

echo "Restoring Valeibol Phase 7 source from checkpoint archive..."
parts=(
  .bootstrap/part-00
  .bootstrap/part-01
  .bootstrap/part-02
  .bootstrap/part-03
  .bootstrap/part-04
  .bootstrap/part-05
  .bootstrap/part-06
  .bootstrap/part-07
  .bootstrap/part-08
)

for part in "${parts[@]}"; do
  test -f "$part" || { echo "Missing bootstrap part: $part" >&2; exit 1; }
done

cat "${parts[@]}" | tr -d '\r\n' | base64 -d > /tmp/valeibol-phase7.tar.gz
tar -xzf /tmp/valeibol-phase7.tar.gz -C .
echo "Valeibol source restored."
