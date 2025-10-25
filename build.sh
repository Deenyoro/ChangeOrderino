#!/bin/bash
set -e

# Get git commit hash (short version)
VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "Building ChangeOrderino with version: $VERSION"

# Build with version
docker compose build \
  --build-arg VERSION="$VERSION" \
  "$@"

echo "Build complete! Version: $VERSION"
