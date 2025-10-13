#!/usr/bin/env bash
set -euo pipefail

# Azure Container Apps deployment script for naitive-engage-suite
# Prereqs:
# - az CLI (>= 2.60)
# - docker logged in locally
# - Service principal env vars set (recommended for non-interactive):
#   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
# - Required configuration env vars:
#   AZ_SUBSCRIPTION_ID, AZ_RESOURCE_GROUP, AZ_REGION, ACR_NAME, ACA_ENV_NAME, ACA_APP_NAME
#   DATABASE_URL, BETTER_AUTH_SECRET
# - Optional: BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL

: "${AZ_SUBSCRIPTION_ID:?Set AZ_SUBSCRIPTION_ID}"
: "${AZ_RESOURCE_GROUP:?Set AZ_RESOURCE_GROUP}"
: "${AZ_REGION:?Set AZ_REGION}"               # e.g., eastus, westus2
: "${ACR_NAME:?Set ACR_NAME}"                 # must be globally unique
: "${ACA_ENV_NAME:?Set ACA_ENV_NAME}"
: "${ACA_APP_NAME:?Set ACA_APP_NAME}"
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${BETTER_AUTH_SECRET:?Set BETTER_AUTH_SECRET}"

# Defaults
IMAGE_REPO="${ACR_NAME}.azurecr.io/naitive-engage-suite"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
TAG=${TAG:-"${GIT_SHA}"}
FULL_IMAGE="${IMAGE_REPO}:${TAG}"
BETTER_AUTH_URL=${BETTER_AUTH_URL:-"https://${ACA_APP_NAME}.${AZ_REGION}.azurecontainerapps.io"}
NEXT_PUBLIC_BETTER_AUTH_URL=${NEXT_PUBLIC_BETTER_AUTH_URL:-"${BETTER_AUTH_URL}"}

log() { echo "[deploy-aca] $*"; }

# Login
if [[ -n "${AZURE_CLIENT_ID:-}" && -n "${AZURE_TENANT_ID:-}" && -n "${AZURE_CLIENT_SECRET:-}" ]]; then
  log "Logging in with service principal"
  az login --service-principal -u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET" --tenant "$AZURE_TENANT_ID" >/dev/null
else
  log "No service principal env vars found. Ensure you're already logged in: az login"
fi

az account set --subscription "$AZ_SUBSCRIPTION_ID"

# Resource group
if ! az group show -n "$AZ_RESOURCE_GROUP" >/dev/null 2>&1; then
  log "Creating resource group $AZ_RESOURCE_GROUP in $AZ_REGION"
  az group create -n "$AZ_RESOURCE_GROUP" -l "$AZ_REGION" >/dev/null
fi

# ACR
if ! az acr show -n "$ACR_NAME" >/dev/null 2>&1; then
  log "Creating Azure Container Registry $ACR_NAME"
  az acr create -n "$ACR_NAME" -g "$AZ_RESOURCE_GROUP" --sku Basic >/dev/null
fi

# Build & push image
log "Logging in to ACR"
az acr login -n "$ACR_NAME" >/dev/null

log "Building image: $FULL_IMAGE"
docker build -t "$FULL_IMAGE" .

log "Pushing image: $FULL_IMAGE"
docker push "$FULL_IMAGE"

# ACA environment
if ! az containerapp env show -n "$ACA_ENV_NAME" -g "$AZ_RESOURCE_GROUP" >/dev/null 2>&1; then
  log "Creating Container Apps environment $ACA_ENV_NAME"
  az containerapp env create -n "$ACA_ENV_NAME" -g "$AZ_RESOURCE_GROUP" -l "$AZ_REGION" >/dev/null
fi

# Create or update Container App
if ! az containerapp show -n "$ACA_APP_NAME" -g "$AZ_RESOURCE_GROUP" >/dev/null 2>&1; then
  log "Creating Container App $ACA_APP_NAME"
  az containerapp create \
    -n "$ACA_APP_NAME" \
    -g "$AZ_RESOURCE_GROUP" \
    --environment "$ACA_ENV_NAME" \
    --image "$FULL_IMAGE" \
    --target-port 3000 \
    --ingress external \
    --registry-server "${ACR_NAME}.azurecr.io" \
    --min-replicas 1 --max-replicas 3 \
    --cpu "0.5" --memory "1.0Gi" \
    --env-vars \
      NODE_ENV=production \
      DATABASE_URL="$DATABASE_URL" \
      BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
      BETTER_AUTH_URL="$BETTER_AUTH_URL" \
      NEXT_PUBLIC_BETTER_AUTH_URL="$NEXT_PUBLIC_BETTER_AUTH_URL" \
  >/dev/null
else
  log "Updating Container App $ACA_APP_NAME"
  az containerapp update \
    -n "$ACA_APP_NAME" \
    -g "$AZ_RESOURCE_GROUP" \
    --image "$FULL_IMAGE" \
    --set-env-vars \
      NODE_ENV=production \
      DATABASE_URL="$DATABASE_URL" \
      BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
      BETTER_AUTH_URL="$BETTER_AUTH_URL" \
      NEXT_PUBLIC_BETTER_AUTH_URL="$NEXT_PUBLIC_BETTER_AUTH_URL" \
  >/dev/null
fi

# Output URL
FQDN=$(az containerapp show -n "$ACA_APP_NAME" -g "$AZ_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
log "Deployed: https://${FQDN}"
