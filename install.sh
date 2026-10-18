#!/bin/sh
# shellcheck disable=SC2034 # every script carries the whole PRODUCT block; not all use every value
# Install a Phygital Key product on macOS or Linux (the PRODUCT block below says
# which). Generated from the template in Phygital-Key/phygital-key.
#
#   curl -fsSL https://github.com/<product repo>/releases/latest/download/install.sh | sh
#
# Downloads the latest release for this machine from GitHub, checks that its
# release list is signed by a pinned release key and that the SHA-256 matches, and puts the program in ~/.local/bin (or $PHYGITAL_KEY_BIN_DIR).
# Set PHYGITAL_KEY_VERSION=v0.3.0 (or later: earlier releases have no signed list) to pin a version. Nothing else is touched.
set -eu

# BEGIN PRODUCT
P_NAME="Phygital Key MCP"
P_BIN=phygital-key-mcp
P_ID=mcp
P_REPO=Phygital-Key/phygital-key-mcp
P_PORT=7468
P_VERSION=v0.6.0
# END PRODUCT
REPO="$P_REPO"
BIN_DIR="${PHYGITAL_KEY_BIN_DIR:-$HOME/.local/bin}"

say() { printf '%s\n' "$*" >&2; }
fail() { say "$P_BIN install: $*"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "needs $1"; }
need curl
need tar
need uname

case "$(uname -s)" in
  Darwin) os=apple-darwin ;;
  Linux) os=unknown-linux-gnu ;;
  *) fail "unsupported system $(uname -s). On Windows use Scoop or the .zip from the Releases page." ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=aarch64 ;;
  x86_64 | amd64) arch=x86_64 ;;
  *) fail "unsupported CPU $(uname -m)" ;;
esac
target="$arch-$os"

# Pinned release keys (P-256), the same block as in the secure installer.
# BEGIN RELEASE KEYS
RELEASE_KEYS='
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEE8WoszUg4wbYZWgi7WhGv8KIWI2o
HJM6yWfA8bUBKMSkp2kCKG17/0qIXPVRIgUw208Zo1+ClVJeigJZZgS3ag==
-----END PUBLIC KEY-----
-----BEGIN ML-DSA-65 PUBLIC KEY-----
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
-----END ML-DSA-65 PUBLIC KEY-----
'
# END RELEASE KEYS

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

version="${PHYGITAL_KEY_VERSION:-}"
if [ -n "$version" ]; then
  case "$version" in v[0-9]*.[0-9]*.[0-9]*) ;; *) fail "bad version $version" ;; esac
  base="https://github.com/$REPO/releases/download/$version"
else
  base="https://github.com/$REPO/releases/latest/download"
fi

# The release list (file names and SHA-256) must be signed by a pinned release key.
# release2.txt (newer releases) also says when it was signed and until when it is
# trusted; an older release named with PHYGITAL_KEY_VERSION may only have release.txt.
list=release2.txt
if ! curl -q -fsSL "$base/release2.txt" -o "$tmp/list" 2>/dev/null; then
  [ -n "$version" ] || fail "could not download the signed release list"
  list=release.txt
  curl -q -fsSL "$base/release.txt" -o "$tmp/list" || fail "could not download the signed release list"
fi
curl -q -fsSL "$base/$list.sig" -o "$tmp/list.sig" || fail "could not download the release signature"
need openssl
printf '%s\n' "$RELEASE_KEYS" | awk -v dir="$tmp" '
  /-----BEGIN PUBLIC KEY-----/ { n++; f = dir "/key-" n ".pem" }
  f { print > f }
  /-----END PUBLIC KEY-----/ { close(f); f = "" }'
signed=no
for k in "$tmp"/key-*.pem; do
  [ -f "$k" ] || continue
  openssl dgst -sha256 -verify "$k" -signature "$tmp/list.sig" "$tmp/list" >/dev/null 2>&1 && signed=yes
done
[ "$signed" = yes ] || fail "the release list is not signed by a pinned release key. Nothing was installed."
first=5
if [ "$list" = release2.txt ]; then
  [ "$(sed -n 1p "$tmp/list")" = "phygital-key release manifest v2" ] || fail "unknown release list format"
  signed_at="$(sed -n 3p "$tmp/list" | sed -n 's/^signed \([1-9][0-9]*\)$/\1/p')"
  expires="$(sed -n 4p "$tmp/list" | sed -n 's/^expires \([1-9][0-9]*\)$/\1/p')"
  [ -n "$signed_at" ] && [ -n "$expires" ] || fail "bad release list"
  now="$(date +%s)"
  [ "$now" -lt "$expires" ] || fail "the latest signed release list has expired. Check the Releases page: https://github.com/$REPO/releases"
  [ "$signed_at" -le $((now + 86400)) ] || fail "the release list says it was signed in the future (check this computer's clock)"
else
  [ "$(sed -n 1p "$tmp/list")" = "phygital-key release manifest v1" ] || fail "unknown release list format"
  first=3
fi
got="$(sed -n 2p "$tmp/list" | sed -n 's/^version \(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$/\1/p')"
[ -n "$got" ] || fail "bad release list"
[ -z "$version" ] || [ "$got" = "$version" ] || fail "the signed release list is for $got, not $version"
version="$got"
sed -n "$first,\$p" "$tmp/list" > "$tmp/files"

name="$P_BIN-$version-$target"
expected="$(awk -v n="$name.tar.gz" '$2 == n && length($1) == 64 { print $1 }' "$tmp/files")"
[ -n "$expected" ] || fail "the signed release list has no $name.tar.gz"

say "Downloading $name (signed release list checked)"
curl -q -fsSL "https://github.com/$REPO/releases/download/$version/$name.tar.gz" -o "$tmp/$name.tar.gz" || fail "download failed"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$name.tar.gz" | cut -d ' ' -f 1)"
else
  actual="$(shasum -a 256 "$tmp/$name.tar.gz" | cut -d ' ' -f 1)"
fi
[ "$expected" = "$actual" ] || fail "the download does not match its signed SHA-256. Nothing was installed."

tar --no-same-owner -xzf "$tmp/$name.tar.gz" -C "$tmp"
mkdir -p "$BIN_DIR"
install -m 0755 "$tmp/$name/$P_BIN" "$BIN_DIR/$P_BIN"
say "Installed $BIN_DIR/$P_BIN ($version)"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) say "Add it to your PATH: export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
say "Try it: $P_BIN demo"
say "Update later with: $P_BIN update"
