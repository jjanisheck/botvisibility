#!/usr/bin/env bash
# demo-x402.sh — BotVisibility x402 testnet demo
# Tests the full HTTP 402 challenge → mock payment → scan flow.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCAN_URL="https://botvisibility.com"
TIER="detailed"

PASS=0
FAIL=0

ok()   { echo "  [PASS] $*"; ((PASS++)); }
fail() { echo "  [FAIL] $*"; ((FAIL++)); }

echo "================================================"
echo "  BotVisibility x402 Demo"
echo "  Target: $BASE_URL"
echo "================================================"
echo ""

# ── Step 1: GET without payment → expect 402 ────────────────────────────────
echo "Step 1: Request paid scan without payment proof (expect 402)"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "$BASE_URL/api/scan/paid?url=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("'"$SCAN_URL"'"))')&tier=$TIER")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "402" ]; then
  ok "Got HTTP 402 Payment Required"
else
  fail "Expected 402, got $HTTP_CODE"
  echo "  Body: $BODY"
fi

# ── Step 2: Extract paymentId ────────────────────────────────────────────────
echo ""
echo "Step 2: Extract paymentId from 402 response"

PAYMENT_ID=$(echo "$BODY" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    pid = data.get('challenge', {}).get('paymentId', '')
    print(pid)
except Exception as e:
    print('')
" 2>/dev/null)

if [ -n "$PAYMENT_ID" ]; then
  ok "paymentId extracted: $PAYMENT_ID"
else
  fail "Could not extract paymentId from response"
  echo "  Body: $BODY"
  echo ""
  echo "Summary: $PASS passed, $FAIL failed"
  exit 1
fi

# ── Step 3: Build mock payment proof ────────────────────────────────────────
echo ""
echo "Step 3: Build mock payment proof"

MOCK_TX_HASH="0x$(python3 -c 'import os; print(os.urandom(32).hex())')"
MOCK_SENDER="0x$(python3 -c 'import os; print(os.urandom(20).hex())')"

PROOF_JSON=$(python3 -c "
import json, base64
proof = {
  'paymentId': '$PAYMENT_ID',
  'network': 'testnet',
  'transactionHash': '$MOCK_TX_HASH',
  'sender': '$MOCK_SENDER'
}
print(base64.b64encode(json.dumps(proof).encode()).decode())
")

ok "Mock proof created (tx: ${MOCK_TX_HASH:0:18}...)"

# ── Step 4: Submit proof → expect 200 with scan results ─────────────────────
echo ""
echo "Step 4: Submit payment proof (expect 200 with scan results)"

RESPONSE2=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: X402 $PROOF_JSON" \
  "$BASE_URL/api/scan/paid?url=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("'"$SCAN_URL"'"))')&tier=$TIER")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | head -n -1)

if [ "$HTTP_CODE2" = "200" ]; then
  ok "Got HTTP 200 with scan results"

  SUCCESS=$(echo "$BODY2" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print('yes' if data.get('success') else 'no')
except:
    print('no')
" 2>/dev/null)

  if [ "$SUCCESS" = "yes" ]; then
    ok "Response contains success:true"
  else
    fail "Response missing success:true"
    echo "  Body snippet: ${BODY2:0:300}"
  fi
else
  fail "Expected 200, got $HTTP_CODE2"
  echo "  Body: ${BODY2:0:500}"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "================================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
