#!/bin/sh
set -eu

source_dir="${SRCROOT}/Config/Firebase/${FIREBASE_ENVIRONMENT}"
destination_dir="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"

mkdir -p "$destination_dir"

# Both files are always produced so the build phase has deterministic outputs.
# An empty plist leaves every Firebase value blank, which keeps the app in demo
# mode instead of failing at launch.
for plist in GoogleService-Info.plist FirebaseConfig.plist; do
    if [ -f "$source_dir/$plist" ]; then
        cp "$source_dir/$plist" "$destination_dir/$plist"
    else
        echo "warning: $plist not found in $source_dir; the app will start in demo mode"
        cat > "$destination_dir/$plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
EOF
    fi
done
