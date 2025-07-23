# Kubernetes Deployment Guide

## Prerequisites

1. **Docker Image**: Build and push the Docker image to your registry
2. **Jibri PVC**: Ensure you have the PVC name that Jibri uses for recordings
3. **Google Drive Credentials**: From the authentication setup guide

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build the image
docker build -t your-registry/jitsi-recording-uploader:latest .

# Push to your registry
docker push your-registry/jitsi-recording-uploader:latest
```

### 2. Update Configuration

Edit the following files to match your environment:

**k8s/deployment.yaml:**
- Update `image:` to your registry URL
- Update `claimName:` to your actual Jibri PVC name
- Update `namespace:` if different from `jitsi`

**k8s/configmap.yaml:**
- Add your `UPLOAD_FOLDER_ID` if you want uploads in a specific folder
- Adjust other settings as needed

### 3. Create Secret

```bash
# Method 1: Using the script (recommended)
./k8s/create-secret.sh

# Method 2: Manual kubectl command
kubectl create secret generic jitsi-uploader-credentials \
  --from-literal=GOOGLE_CLIENT_ID="your_client_id" \
  --from-literal=GOOGLE_CLIENT_SECRET="your_client_secret" \
  --from-literal=GOOGLE_REFRESH_TOKEN="your_refresh_token" \
  --namespace=jitsi
```

### 4. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or use kustomize
kubectl apply -k k8s/

# Check deployment status
kubectl get pods -n jitsi -l app=jitsi-recording-uploader
kubectl logs -n jitsi -l app=jitsi-recording-uploader -f
```

## File Descriptions

| File | Purpose |
|------|---------|
| `secret.yaml` | Template for Google Drive credentials |
| `create-secret.sh` | Script to create secret from .env file |
| `configmap.yaml` | Application configuration |
| `deployment.yaml` | Main deployment with PVC mount |
| `service.yaml` | Service and optional monitoring |
| `rbac.yaml` | Service account and permissions |
| `kustomization.yaml` | Kustomize configuration |
| `deployment-patches.yaml` | Environment-specific patches |

## Important Notes

### PVC Mount
- The deployment mounts your Jibri PVC at `/recordings` (read-only)
- Update `claimName: jibri-recordings-pvc` to match your actual PVC name
- The uploader watches `/recordings` for new video files

### Single Instance
- The deployment uses `replicas: 1` to prevent duplicate uploads
- If you need high availability, implement leader election

### Resource Limits
- Default limits: 256Mi memory, 200m CPU
- Adjust based on your recording volume and upload frequency

### Monitoring
- Optional ServiceMonitor included for Prometheus
- Logs are written to `/app/logs` volume
- Health checks ensure the pod is running properly

## Troubleshooting

### Check Logs
```bash
kubectl logs -n jitsi deployment/jitsi-recording-uploader -f
```

### Verify PVC Mount
```bash
kubectl exec -n jitsi deployment/jitsi-recording-uploader -- ls -la /recordings
```

### Test Authentication
```bash
kubectl exec -n jitsi deployment/jitsi-recording-uploader -- npm run test-auth
```

### Check Configuration
```bash
kubectl get configmap jitsi-uploader-config -n jitsi -o yaml
kubectl get secret jitsi-uploader-credentials -n jitsi -o yaml
```

## Environment-Specific Deployment

For different environments (dev/staging/prod), create separate kustomization directories:

```
k8s/
├── base/           # Base manifests
├── overlays/
│   ├── dev/        # Development overrides
│   ├── staging/    # Staging overrides
│   └── production/ # Production overrides
```

Then deploy with:
```bash
kubectl apply -k k8s/overlays/production/
```