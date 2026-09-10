#!/usr/bin/env bash
set -euo pipefail

API='https://api.cloudflareclient.com/v0a737/reg'
DNS="${WARP_DNS:-1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001}"
MTU="${WARP_MTU:-1280}"
ALLOWED="${WARP_ALLOWED_IPS:-0.0.0.0/0, ::/0}"
KEEPALIVE="${WARP_KEEPALIVE:-25}"
INCLUDE_IPV6="${WARP_INCLUDE_IPV6:-1}"
DEVICE_TYPE="${WARP_DEVICE_TYPE:-Android}"
LOCALE="${WARP_LOCALE:-en_US}"
OUTPUT="${WARP_OUTPUT:-warp-amnezia.conf}"
ENDPOINT_IP="${WARP_ENDPOINT_IP:-162.159.192.1}"
ENDPOINT_PORT="${WARP_ENDPOINT_PORT:-2408}"

for cmd in curl jq wg; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing dependency: $cmd" >&2; exit 1; }
done

PRIVATE_KEY="$(wg genkey)"
PUBLIC_KEY="$(printf '%s' "$PRIVATE_KEY" | wg pubkey)"
TOS="$(date -u +'%Y-%m-%dT%H:%M:%S.000+00:00')"

PAYLOAD="$(jq -n \
  --arg key "$PUBLIC_KEY" \
  --arg tos "$TOS" \
  --arg type "$DEVICE_TYPE" \
  --arg locale "$LOCALE" \
  '{key:$key,install_id:"",warp_enabled:true,tos:$tos,type:$type,locale:$locale}')"

RESP="$(curl --fail-with-body -sS -X POST -H 'Content-Type: application/json' -d "$PAYLOAD" "$API")"
PEER_KEY="$(jq -er '.config.peers[0].public_key' <<<"$RESP")"
IPV4="$(jq -er '.config.interface.addresses.v4' <<<"$RESP")"
IPV6="$(jq -r '.config.interface.addresses.v6 // empty' <<<"$RESP")"

{
  echo '[Interface]'
  echo "PrivateKey = $PRIVATE_KEY"
  if [[ "$INCLUDE_IPV6" == "1" && -n "$IPV6" ]]; then
    echo "Address = $IPV4/32, $IPV6/128"
  else
    echo "Address = $IPV4/32"
  fi
  echo "DNS = $DNS"
  echo "MTU = $MTU"
  echo
  echo '[Peer]'
  echo "PublicKey = $PEER_KEY"
  echo "AllowedIPs = $ALLOWED"
  echo "Endpoint = $ENDPOINT_IP:$ENDPOINT_PORT"
  [[ "$KEEPALIVE" == "0" ]] || echo "PersistentKeepalive = $KEEPALIVE"
} > "$OUTPUT"

chmod 600 "$OUTPUT" || true
printf 'Generated %s using endpoint %s:%s\n' "$OUTPUT" "$ENDPOINT_IP" "$ENDPOINT_PORT"
