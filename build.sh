#!/bin/bash
# ChangeOrderino Build Script
# Captures git commit hash and passes to docker-compose

set -e

# Get git commit hash (short 7 characters like Tagistry)
GIT_COMMIT=$(git log -1 --format=%H 2>/dev/null || echo "unknown")
GIT_COMMIT_SHORT=$(echo $GIT_COMMIT | cut -c1-7)

echo "=================================="
echo "Building ChangeOrderino"
echo "=================================="
echo "Git Commit: $GIT_COMMIT"
echo "Short Hash: $GIT_COMMIT_SHORT"
echo "=================================="

# Export for docker-compose
export GIT_COMMIT
export VERSION=$GIT_COMMIT_SHORT

# Build with docker-compose
if [ "$1" == "--no-cache" ]; then
    echo "Building with --no-cache..."
    docker compose build --no-cache
else
    docker compose build "$@"
fi

echo "=================================="
echo "Build complete!"
echo "Version: $VERSION"
echo "=================================="
