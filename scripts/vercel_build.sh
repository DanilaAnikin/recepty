#!/usr/bin/env bash
set -euo pipefail

FLUTTER_VERSION="3.38.6"
FLUTTER_ROOT="${HOME}/flutter-sdk"
FLUTTER_BIN="${FLUTTER_ROOT}/bin/flutter"
FLUTTER_ARCHIVE="flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
FLUTTER_URL="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/${FLUTTER_ARCHIVE}"

if [[ ! -x "${FLUTTER_BIN}" ]]; then
  bash scripts/vercel_install_flutter.sh
fi

git config --global --add safe.directory "${FLUTTER_ROOT}" || true

export PATH="${FLUTTER_ROOT}/bin:${PATH}"

flutter config --enable-web
flutter pub get
flutter build web --release
