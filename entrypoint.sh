#!/bin/sh
set -e
# Execute the container's main process (what's set as CMD in the Dockerfile).
exec "$@"
