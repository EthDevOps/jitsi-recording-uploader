#!/bin/bash

# Build and deploy script for Jitsi Recording Uploader

set -e

# Configuration
REGISTRY=${REGISTRY:-"your-registry.com"}
IMAGE_NAME="jitsi-recording-uploader"
TAG=${TAG:-"latest"}
NAMESPACE=${NAMESPACE:-"jitsi"}
PVC_NAME=${PVC_NAME:-"jibri-recordings-pvc"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Building and deploying Jitsi Recording Uploader${NC}"

# Check if required tools are installed
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required but not installed.${NC}" >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}❌ kubectl is required but not installed.${NC}" >&2; exit 1; }

# Check if .env file exists for credentials
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env with your Google Drive credentials"
    exit 1
fi

echo -e "${YELLOW}📦 Building Docker image...${NC}"
docker build -t ${REGISTRY}/${IMAGE_NAME}:${TAG} .

echo -e "${YELLOW}📤 Pushing Docker image...${NC}"
docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}

echo -e "${YELLOW}🔐 Creating Kubernetes secret...${NC}"
./k8s/create-secret.sh

echo -e "${YELLOW}⚙️  Updating deployment manifest...${NC}"
# Update the image in deployment.yaml
sed -i.bak "s|image: .*|image: ${REGISTRY}/${IMAGE_NAME}:${TAG}|g" k8s/deployment.yaml
sed -i.bak "s|claimName: .*|claimName: ${PVC_NAME}|g" k8s/deployment.yaml
sed -i.bak "s|namespace: .*|namespace: ${NAMESPACE}|g" k8s/*.yaml

echo -e "${YELLOW}🚀 Deploying to Kubernetes...${NC}"
kubectl apply -f k8s/

echo -e "${YELLOW}⏳ Waiting for deployment to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/jitsi-recording-uploader -n ${NAMESPACE}

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}📊 Check status with:${NC}"
echo "kubectl get pods -n ${NAMESPACE} -l app=jitsi-recording-uploader"
echo "kubectl logs -n ${NAMESPACE} -l app=jitsi-recording-uploader -f"

# Clean up backup files
rm -f k8s/*.yaml.bak

echo -e "${GREEN}🎉 Jitsi Recording Uploader is now running in Kubernetes!${NC}"