#!/bin/bash
# Build-time environment injection for Angular
# Reads from RENDER_EXTERNAL_URL (provided by Render for this service)
# and BACKEND_URL (set in render.yaml envVars) to inject into environment.prod.ts

set -e

# Render provides RENDER_EXTERNAL_URL for the frontend service itself
# BACKEND_URL is set via envVars in render.yaml
BACKEND_URL="${BACKEND_URL:-https://realtime-backend.onrender.com}"

echo "Injecting environment variables..."
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL (RENDER_EXTERNAL_URL): ${RENDER_EXTERNAL_URL:-not set}"

# Convert https to wss for WebSocket URL
WS_URL="${BACKEND_URL/https:/wss:}"

# Create environment.prod.ts with injected values
cat > src/environments/environment.prod.ts <<EOF
export const environment = {
  production: true,
  apiUrl: '${BACKEND_URL}/api',
  wsUrl: '${WS_URL}/ws',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};
EOF

echo "Generated environment.prod.ts:"
cat src/environments/environment.prod.ts