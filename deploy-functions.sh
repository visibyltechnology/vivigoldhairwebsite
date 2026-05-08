#!/bin/bash
# Deploy all Supabase edge functions to production.
# Run this any time you update a file in supabase/functions/
#
# Requirements:
#   - Supabase CLI: npm install -g supabase  (or npx supabase)
#   - SUPABASE_ACCESS_TOKEN env var set to your Supabase PAT
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=your_pat bash deploy-functions.sh

set -e

PROJECT_REF="iivgirvlatkcwklflmzc"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is not set."
  echo "Export it: export SUPABASE_ACCESS_TOKEN=your_supabase_pat"
  exit 1
fi

echo "Deploying all edge functions to project $PROJECT_REF..."
npx supabase functions deploy \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "All functions deployed successfully."
