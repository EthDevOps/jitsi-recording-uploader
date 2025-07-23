#!/bin/bash

# Helm deployment script for Jitsi Recording Uploader

set -e

# Configuration
CHART_PATH="./helm/jitsi-recording-uploader"
RELEASE_NAME=${RELEASE_NAME:-"jitsi-uploader"}
NAMESPACE=${NAMESPACE:-"jitsi"}
VALUES_FILE=${VALUES_FILE:-""}
ENVIRONMENT=${ENVIRONMENT:-"development"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -e, --environment   Environment (development|production) [default: development]"
    echo "  -n, --namespace     Kubernetes namespace [default: jitsi]"
    echo "  -r, --release       Helm release name [default: jitsi-uploader]"
    echo "  -f, --values        Custom values file path"
    echo "  -u, --upgrade       Upgrade existing release"
    echo "  -d, --dry-run       Perform a dry run"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production -f my-values.yaml"
    echo "  $0 --upgrade --environment production"
    echo "  $0 --dry-run -e development"
}

# Parse command line arguments
UPGRADE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--release)
            RELEASE_NAME="$2"
            shift 2
            ;;
        -f|--values)
            VALUES_FILE="$2"
            shift 2
            ;;
        -u|--upgrade)
            UPGRADE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Deploying Jitsi Recording Uploader${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Namespace: ${NAMESPACE}${NC}"
echo -e "${BLUE}Release: ${RELEASE_NAME}${NC}"

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ Helm is not installed${NC}"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

# Validate chart
echo -e "${YELLOW}📋 Validating Helm chart...${NC}"
if ! helm lint ${CHART_PATH}; then
    echo -e "${RED}❌ Chart validation failed${NC}"
    exit 1
fi

# Create namespace if it doesn't exist
echo -e "${YELLOW}🏗️  Ensuring namespace exists...${NC}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Determine values file
if [[ -z "${VALUES_FILE}" ]]; then
    case ${ENVIRONMENT} in
        production)
            VALUES_FILE="helm/values-examples/production.yaml"
            ;;
        development)
            VALUES_FILE="helm/values-examples/development.yaml"
            ;;
        *)
            echo -e "${YELLOW}⚠️  Unknown environment ${ENVIRONMENT}, using default values${NC}"
            VALUES_FILE=""
            ;;
    esac
fi

# Check if values file exists
if [[ -n "${VALUES_FILE}" && ! -f "${VALUES_FILE}" ]]; then
    echo -e "${RED}❌ Values file not found: ${VALUES_FILE}${NC}"
    exit 1
fi

# Build Helm command
HELM_CMD="helm"
if [[ "${UPGRADE}" == "true" ]]; then
    HELM_CMD="${HELM_CMD} upgrade"
else
    HELM_CMD="${HELM_CMD} install"
fi

HELM_CMD="${HELM_CMD} ${RELEASE_NAME} ${CHART_PATH}"
HELM_CMD="${HELM_CMD} --namespace ${NAMESPACE}"

if [[ -n "${VALUES_FILE}" ]]; then
    HELM_CMD="${HELM_CMD} --values ${VALUES_FILE}"
    echo -e "${BLUE}Values file: ${VALUES_FILE}${NC}"
fi

if [[ "${DRY_RUN}" == "true" ]]; then
    HELM_CMD="${HELM_CMD} --dry-run --debug"
    echo -e "${YELLOW}🧪 Performing dry run...${NC}"
else
    HELM_CMD="${HELM_CMD} --wait --timeout 300s"
fi

if [[ "${UPGRADE}" == "true" ]]; then
    HELM_CMD="${HELM_CMD} --install"
fi

# Execute Helm command
echo -e "${YELLOW}⚙️  Executing: ${HELM_CMD}${NC}"
if eval ${HELM_CMD}; then
    if [[ "${DRY_RUN}" != "true" ]]; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        
        # Show deployment status
        echo -e "${YELLOW}📊 Deployment status:${NC}"
        kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=jitsi-recording-uploader
        
        echo -e "${YELLOW}📝 To view logs:${NC}"
        echo "kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=jitsi-recording-uploader -f"
        
        echo -e "${YELLOW}🧪 To test authentication:${NC}"
        echo "kubectl exec -n ${NAMESPACE} deployment/${RELEASE_NAME}-jitsi-recording-uploader -- npm run test-auth"
        
        # Show Helm release info
        echo -e "${YELLOW}📋 Release information:${NC}"
        helm list -n ${NAMESPACE}
    else
        echo -e "${GREEN}✅ Dry run completed successfully!${NC}"
    fi
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi