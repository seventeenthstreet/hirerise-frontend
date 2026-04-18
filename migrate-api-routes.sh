#!/usr/bin/env bash
# =============================================================================
# migrate-api-routes.sh
#
# Batch-replaces ALL Firebase token verification calls in Next.js API routes
# with the Supabase equivalent.
#
# Run from the project root (frond/):
#   chmod +x migrate-api-routes.sh
#   ./migrate-api-routes.sh
#
# What it does:
#   1. Replaces the import line in every API route
#   2. Replaces the function call (verifyFirebaseToken → verifySupabaseToken)
#
# Safe to run multiple times — uses exact string matching.
# =============================================================================

set -euo pipefail

ROUTES_DIR="src/app/api"

echo "=== HireRise: Migrating API routes from Firebase to Supabase Auth ==="
echo ""

# Find all .ts route files that still import verifyFirebaseToken
FILES=$(grep -rl "verifyFirebaseToken" "$ROUTES_DIR" --include="*.ts" 2>/dev/null || true)

if [ -z "$FILES" ]; then
  echo "✓ No files with verifyFirebaseToken found — already migrated or nothing to do."
  exit 0
fi

COUNT=0

for FILE in $FILES; do
  echo "  Migrating: $FILE"

  # Step 1: Replace the import line
  sed -i \
    "s|import { verifyFirebaseToken }[[:space:]]*from '@/lib/firebase-admin';|import { verifySupabaseToken } from '@/lib/auth';|g" \
    "$FILE"

  # Also handle double-quoted imports
  sed -i \
    's|import { verifyFirebaseToken }[[:space:]]*from "@/lib/firebase-admin";|import { verifySupabaseToken } from "@/lib/auth";|g' \
    "$FILE"

  # Step 2: Replace the function call
  sed -i \
    "s/await verifyFirebaseToken(token)/await verifySupabaseToken(token)/g" \
    "$FILE"

  # Step 3: Replace inline verifyFirebaseToken references (rare edge cases)
  sed -i \
    "s/verifyFirebaseToken(/verifySupabaseToken(/g" \
    "$FILE"

  COUNT=$((COUNT + 1))
done

echo ""
echo "=== Done: $COUNT file(s) migrated ==="
echo ""

# Verify no Firebase imports remain in API routes
REMAINING=$(grep -rl "firebase" "$ROUTES_DIR" --include="*.ts" 2>/dev/null || true)
if [ -n "$REMAINING" ]; then
  echo "⚠ WARNING: Firebase references still found in:"
  echo "$REMAINING"
  echo "  Review these files manually."
else
  echo "✓ No Firebase references remain in API routes."
fi

echo ""
echo "=== Next steps ==="
echo "  1. Run: grep -r 'firebase' src/app/api --include='*.ts' (should return nothing)"
echo "  2. Run: grep -r 'firebase' src/lib --include='*.ts' (check only firebase.ts, firebase-admin.ts)"
echo "  3. Delete: src/lib/firebase.ts"
echo "  4. Delete: src/lib/firebase-admin.ts"
echo "  5. Delete: src/lib/devLogin.ts"
echo "  6. Update .env.local (see .env.migration.example)"