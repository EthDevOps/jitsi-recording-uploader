#!/bin/bash

# Script to create Kubernetes secret from environment variables
# Usage: ./create-secret.sh

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please create a .env file with your Google Drive credentials"
    exit 1
fi

# Source the .env file
source .env

# Check required variables
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ] || [ -z "$GOOGLE_REFRESH_TOKEN" ]; then
    echo "Error: Missing required environment variables"
    echo "Please ensure .env contains GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN"
    exit 1
fi

# Set namespace (change as needed)
NAMESPACE=${NAMESPACE:-jitsi}

echo "Creating Kubernetes secret in namespace: $NAMESPACE"

# Create or update the secret
kubectl create secret generic jitsi-uploader-credentials \
  --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  --from-literal=GOOGLE_REFRESH_TOKEN="$GOOGLE_REFRESH_TOKEN" \
  --namespace="$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secret created successfully!"
echo "Verify with: kubectl get secret jitsi-uploader-credentials -n $NAMESPACE"