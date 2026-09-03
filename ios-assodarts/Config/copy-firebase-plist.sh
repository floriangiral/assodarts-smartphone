#!/bin/sh
set -eu

source_plist="${SRCROOT}/Config/Firebase/${FIREBASE_ENVIRONMENT}/GoogleService-Info.plist"
destination_plist="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"

if [ -f "$source_plist" ]; then
    mkdir -p "$(dirname "$destination_plist")"
    cp "$source_plist" "$destination_plist"
else
    echo "warning: Firebase plist not found at $source_plist; using compile-time fallback configuration"
fi
