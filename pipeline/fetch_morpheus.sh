#!/usr/bin/env bash
# Fetch the native libmorpheus runtime (v0.3.2, the version the PyPI binding 0.1.0 targets) and
# the Perseids stemlib from the same tag into pipeline/raw/morpheus (git-ignored).
# Morpheus is AGPL-3.0 and only used for cross-checking; nothing from it is shipped.
set -euo pipefail
cd "$(dirname "$0")"
DEST=raw/morpheus
TAG=v0.3.2
ARCHIVE=libmorpheus-0.3.2-Linux-x86_64-glibc.tar.gz
mkdir -p "$DEST"
cd "$DEST"
if [ ! -f "$ARCHIVE" ]; then
  curl -fsSLO "https://github.com/defense-humanites/libmorpheus/releases/download/$TAG/$ARCHIVE"
  curl -fsSLO "https://github.com/defense-humanites/libmorpheus/releases/download/$TAG/$ARCHIVE.sha256"
fi
sha256sum -c "$ARCHIVE.sha256"
tar xzf "$ARCHIVE"
if [ ! -d stemlib ]; then
  git clone -q --depth 1 --branch "$TAG" https://github.com/defense-humanites/libmorpheus.git src-$TAG
  cp -r "src-$TAG/stemlib" stemlib
fi
echo "Morpheus ready in pipeline/$DEST"
