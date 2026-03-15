#!/usr/bin/env bash
set -euo pipefail

FLUTTER_VERSION="3.38.6"
FLUTTER_ROOT="${HOME}/flutter-sdk"
FLUTTER_BIN="${FLUTTER_ROOT}/bin/flutter"
FLUTTER_ARCHIVE="flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
FLUTTER_URL="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/${FLUTTER_ARCHIVE}"

mark_flutter_safe() {
  git config --global --add safe.directory "${FLUTTER_ROOT}" || true
}

if [[ -x "${FLUTTER_BIN}" ]]; then
  echo "Flutter ${FLUTTER_VERSION} already installed."
  mark_flutter_safe
  exit 0
fi

echo "Installing Flutter ${FLUTTER_VERSION} for Vercel build..."
rm -rf "${FLUTTER_ROOT}" "${HOME}/flutter"
curl -L "${FLUTTER_URL}" -o "/tmp/${FLUTTER_ARCHIVE}"
tar -xJf "/tmp/${FLUTTER_ARCHIVE}" -C "${HOME}"
mv "${HOME}/flutter" "${FLUTTER_ROOT}"
mark_flutter_safe
