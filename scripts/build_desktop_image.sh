#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-agenttrust/desktop-environment}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY_URL="${REGISTRY_URL:-}"
PUSH_IMAGE=false

usage() {
  printf '%s\n' \
    'Usage: scripts/build_desktop_image.sh [--tag <version>] [--push]' \
    '' \
    'Builds the AgentTrust interactive desktop Docker image.' \
    '' \
    'Options:' \
    '  --tag <version>  Tag to apply locally. Defaults to IMAGE_TAG or latest.' \
    '  --push           Push the image to REGISTRY_URL after a successful build.' \
    '  -h, --help       Show this help text.' \
    '' \
    'Environment:' \
    '  IMAGE_NAME       Image repository name. Defaults to agenttrust/desktop-environment.' \
    '  IMAGE_TAG        Default tag when --tag is omitted.' \
    '  REGISTRY_URL     Registry prefix used with --push, for example registry.example.com/team.'
}

log() {
  printf '[desktop-build] %s\n' "$*"
}

fail() {
  printf '[desktop-build] ERROR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      [[ $# -ge 2 ]] || fail "--tag requires a value"
      IMAGE_TAG="$2"
      shift 2
      ;;
    --push)
      PUSH_IMAGE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker CLI was not found on PATH"
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not available. Start Docker Desktop or your Docker service and retry."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKERFILE_PATH="${REPO_ROOT}/backend/docker/desktop/Dockerfile"
CONTEXT_DIR="${REPO_ROOT}/backend/docker/desktop"
LOCAL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

[[ -f "$DOCKERFILE_PATH" ]] || fail "Dockerfile not found at ${DOCKERFILE_PATH}"

start_epoch="$(date +%s)"
log "Building ${LOCAL_IMAGE}"
log "Dockerfile: ${DOCKERFILE_PATH}"
log "Context: ${CONTEXT_DIR}"

docker build \
  --file "$DOCKERFILE_PATH" \
  --tag "$LOCAL_IMAGE" \
  "$CONTEXT_DIR"

elapsed="$(( $(date +%s) - start_epoch ))"
log "Build completed in ${elapsed}s: ${LOCAL_IMAGE}"

if [[ "$PUSH_IMAGE" == true ]]; then
  [[ -n "$REGISTRY_URL" ]] || fail "--push requires REGISTRY_URL to be set"

  REGISTRY_IMAGE="${REGISTRY_URL%/}/${IMAGE_NAME}:${IMAGE_TAG}"
  log "Tagging ${LOCAL_IMAGE} as ${REGISTRY_IMAGE}"
  docker tag "$LOCAL_IMAGE" "$REGISTRY_IMAGE"

  log "Pushing ${REGISTRY_IMAGE}"
  docker push "$REGISTRY_IMAGE"
  log "Push completed: ${REGISTRY_IMAGE}"
fi

log "Available local image:"
docker images "$IMAGE_NAME" --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'
