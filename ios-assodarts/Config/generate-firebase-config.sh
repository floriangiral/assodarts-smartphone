#!/bin/sh
# Writes Config/Firebase/<Environment>/FirebaseConfig.plist from environment
# variables, so Firebase client identifiers never live in the repository.
#
# Usage: sh Config/generate-firebase-config.sh Staging
#        sh Config/generate-firebase-config.sh Production
#
# Reads FIREBASE_API_KEY_<SUFFIX>, FIREBASE_APP_ID_<SUFFIX>,
# FIREBASE_PROJECT_ID_<SUFFIX>, FIREBASE_GCM_SENDER_ID_<SUFFIX> and
# FIREBASE_STORAGE_BUCKET_<SUFFIX>, where <SUFFIX> is the upper-cased
# environment name (STAGING or PRODUCTION).
set -eu

environment="${1:-}"
if [ -z "$environment" ]; then
    echo "error: missing environment argument (Staging or Production)" >&2
    exit 1
fi

case "$environment" in
    Staging) suffix=STAGING ;;
    Production) suffix=PRODUCTION ;;
    *)
        echo "error: unsupported environment '$environment' (expected Staging or Production)" >&2
        exit 1
        ;;
esac

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
destination_dir="$script_dir/Firebase/$environment"
destination="$destination_dir/FirebaseConfig.plist"

keys="FIREBASE_API_KEY FIREBASE_APP_ID FIREBASE_PROJECT_ID FIREBASE_GCM_SENDER_ID FIREBASE_STORAGE_BUCKET"

missing=""
for key in $keys; do
    eval "value=\${${key}_${suffix}:-}"
    if [ -z "$value" ]; then
        missing="$missing ${key}_${suffix}"
    fi
done

if [ -n "$missing" ]; then
    echo "error: missing environment variables:$missing" >&2
    exit 1
fi

mkdir -p "$destination_dir"

{
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    echo '<plist version="1.0">'
    echo '<dict>'
    for key in $keys; do
        eval "value=\${${key}_${suffix}}"
        printf '\t<key>%s</key>\n' "$key"
        printf '\t<string>%s</string>\n' "$value"
    done
    echo '</dict>'
    echo '</plist>'
} > "$destination"

echo "Wrote $destination"
