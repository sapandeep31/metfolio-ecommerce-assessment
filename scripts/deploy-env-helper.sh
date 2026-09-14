#!/usr/bin/env bash
# ==============================================================================
# Deployment Environment Variable Helper
# Extracts live cloud credentials from .env to paste into Render and Vercel.
# ==============================================================================

set -euo pipefail

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found."
  exit 1
fi

get_env_val() {
  grep "^$1=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || echo ""
}

RENDER_API_URL="${1:-https://metfolio-oms-api.onrender.com}"
VERCEL_APP_URL="${2:-https://metfolio-ecommerce-assessment.vercel.app}"

echo "=============================================================================="
echo " 1. RENDER DASHBOARD ENVIRONMENT VARIABLES (for apps/api)"
echo " Copy and paste these into your Render Web Service Environment Settings:"
echo "=============================================================================="
cat <<EOF
NODE_ENV=production
PAYMENTS_DRIVER=stripe
STORAGE_DRIVER=local
API_BASE_URL=${RENDER_API_URL}
APP_BASE_URL=${VERCEL_APP_URL}
DATABASE_URL=$(get_env_val "DATABASE_URL")
DIRECT_DATABASE_URL=$(get_env_val "DIRECT_DATABASE_URL")
REDIS_URL=$(get_env_val "REDIS_URL")
AUTH_SECRET=$(get_env_val "AUTH_SECRET")
STRIPE_SECRET_KEY=$(get_env_val "STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET=$(get_env_val "STRIPE_WEBHOOK_SECRET")
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(get_env_val "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
NEXT_PUBLIC_SUPABASE_URL=$(get_env_val "NEXT_PUBLIC_SUPABASE_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(get_env_val "NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY=$(get_env_val "SUPABASE_SERVICE_ROLE_KEY")
EOF

echo ""
echo "=============================================================================="
echo " 2. VERCEL DASHBOARD ENVIRONMENT VARIABLES (for apps/web)"
echo " Copy and paste these into your Vercel Project Environment Settings:"
echo "=============================================================================="
cat <<EOF
NEXT_PUBLIC_SUPABASE_URL=$(get_env_val "NEXT_PUBLIC_SUPABASE_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(get_env_val "NEXT_PUBLIC_SUPABASE_ANON_KEY")
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(get_env_val "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
AUTH_SECRET=$(get_env_val "AUTH_SECRET")
API_BASE_URL=${RENDER_API_URL}
NEXT_PUBLIC_API_BASE_URL=${RENDER_API_URL}
APP_BASE_URL=${VERCEL_APP_URL}
EOF
echo "=============================================================================="
