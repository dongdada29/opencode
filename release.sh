#!/bin/bash

# Release Workflow Script for NuwaxCode
# Usage: ./release.sh <new_version> [otp_code]
# Example: ./release.sh 1.1.52
# Example with OTP: ./release.sh 1.1.52 123456

set -e

NEW_VERSION=$1
OTP_CODE=$2

if [ -z "$NEW_VERSION" ]; then
  echo "Error: Please provide a version number."
  echo "Usage: ./release.sh <new_version> [otp_code]"
  exit 1
fi

echo "🚀 Starting release process for version $NEW_VERSION..."

# Ensure we are in the project root
if [ ! -f "packages/opencode/package.json" ]; then
    echo "Error: Could not find packages/opencode/package.json. Are you in the project root?"
    exit 1
fi

# Update package.json version and sync optionalDependencies
echo "📦 Updating package.json versions..."
PACKAGE_JSON="packages/opencode/package.json"

# Use Bun to update the JSON file in place (cleaner than sed for JSON)
bun -e "
  const fs = require('fs');
  const pkg = require('./$PACKAGE_JSON');
  pkg.version = '$NEW_VERSION';
  if (pkg.optionalDependencies) {
    for (const key in pkg.optionalDependencies) {
      if (key.startsWith('nuwaxcode-')) {
        pkg.optionalDependencies[key] = '$NEW_VERSION';
      }
    }
  }
  fs.writeFileSync('./$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"

echo "✅ Updated $PACKAGE_JSON to version $NEW_VERSION"

# Remind about Changelog
echo "📝 Please ensure you have updated CHANGELOG-nuwaxcode.md"
read -p "Press Enter to continue if changelog is updated (or Ctrl+C to abort)..."

# Run publish
echo "🚀 Publishing to NPM..."
cd packages/opencode

PUBLISH_CMD="bun run publish --latest"

if [ ! -z "$OTP_CODE" ]; then
    PUBLISH_CMD="$PUBLISH_CMD --otp=$OTP_CODE"
    echo "Using provided OTP."
else
    # If no OTP provided, checking if we should use --no-otp or let it prompt
    # The publish script handles --no-otp if user wants to bypass, or interactive if not provided
    # Let's just run it. If user didn't provide OTP arg, they will be prompted by the script if needed.
    # The publish script logic: if no otp arg and no --no-otp, it prompts.
    :
fi

# Execute publish
eval $PUBLISH_CMD

echo "✅ Release $NEW_VERSION completed successfully!"
