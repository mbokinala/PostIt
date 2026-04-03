#!/usr/bin/env bash
set -euo pipefail

REPO="mbokinala/PostIt"
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
ZIP_NAME="post-it-darwin-arm64-${VERSION}.zip"
ZIP_PATH="out/make/zip/darwin/arm64/${ZIP_NAME}"

echo "==> Building v${VERSION}..."
npm run make

if [ ! -f "$ZIP_PATH" ]; then
  echo "ERROR: Expected zip not found at ${ZIP_PATH}"
  exit 1
fi

echo "==> Generating latest-mac.yml..."
SHA512=$(shasum -a 512 "$ZIP_PATH" | awk '{print $1}' | xxd -r -p | base64)
SIZE=$(stat -f%z "$ZIP_PATH")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > latest-mac.yml <<EOF
version: ${VERSION}
files:
  - url: ${ZIP_NAME}
    sha512: ${SHA512}
    size: ${SIZE}
path: ${ZIP_NAME}
sha512: ${SHA512}
releaseDate: '${DATE}'
EOF

echo "==> Creating GitHub release ${TAG}..."
gh release create "$TAG" \
  --repo "$REPO" \
  --title "$TAG" \
  --draft \
  "$ZIP_PATH" \
  latest-mac.yml

echo "==> Done! Draft release ${TAG} created."
echo "    Review and publish at: https://github.com/${REPO}/releases/tag/${TAG}"
