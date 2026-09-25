#!/bin/bash
set -e

# Create directories if they don't exist
mkdir -p uploads output

# Use PORT env var if set (Railway/Render provide this), otherwise default to 8000
PORT=${PORT:-8000}

echo "🎬 Starting ClipEngine on port $PORT..."

# Start uvicorn
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 2
