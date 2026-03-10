# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jitsi Recording Uploader — a Node.js service that watches a Jibri recordings directory for new video files and automatically uploads them to Google Drive. Designed to run as a sidecar container alongside Jibri in Kubernetes.

## Commands

- `npm start` — run the service
- `npm run dev` — run with nodemon (auto-restart on changes)
- `npm test` — run Jest tests
- `node src/index.js reupload <file-path>` — force re-upload a specific file
- `./build-and-deploy.sh` — build Docker image and deploy to Kubernetes (requires `REGISTRY`, `TAG`, `NAMESPACE`, `PVC_NAME` env vars)

## Architecture

All source code is in `src/` (plain Node.js, CommonJS modules, no transpilation):

- **index.js** — Entry point. `JitsiRecordingUploader` class orchestrates startup: validates config, initializes UploadManager, starts FileWatcher, handles graceful shutdown (SIGTERM/SIGINT). Also handles CLI `reupload` subcommand.
- **fileWatcher.js** — Uses `chokidar` to watch `JIBRI_RECORDINGS_PATH` (depth 2) for video files (.mp4, .avi, .mov, .mkv, .webm). Has `awaitWriteFinish` stability check before triggering uploads. Scans existing files on startup.
- **uploadManager.js** — Sequential upload queue with retry logic (exponential backoff, configurable max retries). Optional local file cleanup after upload.
- **googleDriveService.js** — Google Drive API v3 via `googleapis` OAuth2. Key behaviors:
  - Extracts conference room name from filename (text before first `_`) and creates/reuses a per-room subdirectory in Drive.
  - Duplicate detection: skips upload if a file with the same name and size already exists in the target directory.
- **config.js** — Loads env vars via `dotenv`. See README for all config options.
- **logger.js** — Winston logger; outputs to console + `logs/combined.log` + `logs/error.log`.

## Deployment

- **Dockerfile** — node:18-alpine, runs as non-root user
- **k8s/** — Raw Kubernetes manifests + Kustomize overlays. Includes sidecar deployment pattern (`jibri-with-uploader-sidecar.yaml`).
- **helm/** — Helm chart with `deploy.sh` wrapper and example values files.
