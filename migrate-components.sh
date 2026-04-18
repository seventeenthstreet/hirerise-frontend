#!/usr/bin/env bash
# =============================================================================
# migrate-components.sh
#
# Migrates ALL frontend files from the Firebase token pattern to the
# Supabase token pattern. Run from the frond/ project root.
#
# Pattern replaced (identical across all 8 affected components):
#
#   BEFORE:
#     import { getIdToken } from 'firebase/auth';
#     import { firebaseAuth } from '@/lib/firebase';
#     ...
#     const user  = firebaseAuth.currentUser;
#     const token = user ? await getIdToken(user, false) : null;
#
#   AFTER:
#     import { getAuthToken } from '@/lib/getToken';
#     ...
#     const token = await getAuthToken();
#
# Also migrates apiClient.ts (already handled separately but safe to re-run).
#
# Run:
#   chmod +x migrate-components.sh
#   ./migrate-components.sh
# =============================================================================

set -euo pipefail

echo "=== HireRise: Migrating components from Firebase → Supabase Auth ==="
echo ""

# ── Files to migrate ──────────────────────────────────────────────────────────
COMPONENT_FILES=(
  "src/components/JobMatchCard.tsx"
  "src/components/CareerGrowth.tsx"
  "src/components/AutoApply.tsx"
  "src/components/InterviewPrep.tsx"
  "src/components/SalaryPredictor.tsx"
  "src/components/career/PathTimeline.tsx"
  "src/components/career/CareerPathSection.tsx"
  "src/services/apiClient.ts"
)

MIGRATED=0
SKIPPED=0

for FILE in "${COMPONENT_FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "  SKIP (not found): $FILE"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Check if this file still has Firebase imports
  if ! grep -q "firebase/auth\|firebaseAuth" "$FILE" 2>/dev/null; then
    echo "  SKIP (already migrated): $FILE"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  Migrating: $FILE"

  # Step 1: Remove Firebase import lines
  # Handles both single-line and the two-line pattern
  sed -i "/import { getIdToken } from 'firebase\/auth';/d" "$FILE"
  sed -i '/import { getIdToken } from "firebase\/auth";/d' "$FILE"
  sed -i "/import { firebaseAuth } from '@\/lib\/firebase';/d" "$FILE"
  sed -i '/import { firebaseAuth } from "@\/lib\/firebase";/d' "$FILE"

  # Step 2: Add the Supabase import if not already present
  # Inserts after the first import line in the file
  if ! grep -q "getAuthToken" "$FILE"; then
    # Find the line number of the last 'import' statement and insert after
    LAST_IMPORT=$(grep -n "^import " "$FILE" | tail -1 | cut -d: -f1)
    if [ -n "$LAST_IMPORT" ]; then
      sed -i "${LAST_IMPORT}a import { getAuthToken } from '@/lib/getToken';" "$FILE"
    fi
  fi

  # Step 3: Replace the two-line token pattern with the single-line Supabase version
  # Pattern A: standard two consecutive lines
  sed -i \
    '/const user  = firebaseAuth\.currentUser;/{
      N
      s/const user  = firebaseAuth\.currentUser;\n  const token = user ? await getIdToken(user, false) : null;/const token = await getAuthToken();/
    }' "$FILE"

  # Pattern B: handle slight whitespace variations
  sed -i \
    '/const user = firebaseAuth\.currentUser;/{
      N
      s/const user = firebaseAuth\.currentUser;\n.*const token = user ? await getIdToken(user, false) : null;/const token = await getAuthToken();/
    }' "$FILE"

  # Step 4: Catch any remaining individual lines that weren't caught by pattern above
  sed -i "s/const user  = firebaseAuth\.currentUser;//g" "$FILE"
  sed -i "s/const user = firebaseAuth\.currentUser;//g" "$FILE"
  sed -i "s/const token = user ? await getIdToken(user, false) : null;/const token = await getAuthToken();/g" "$FILE"

  # Step 5: Clean up any blank lines left by the deletions (max 1 consecutive blank)
  # This is cosmetic only — skip if sed -i '' causes issues on your platform
  # cat -s "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE" 2>/dev/null || true

  MIGRATED=$((MIGRATED + 1))
done

echo ""
echo "=== Component migration complete ==="
echo "  Migrated: $MIGRATED"
echo "  Skipped:  $SKIPPED"
echo ""

# ── Verify no Firebase references remain in components ────────────────────────
echo "=== Verification: checking for remaining Firebase references ==="

REMAINING=$(grep -rn "firebase/auth\|firebaseAuth\|getIdToken" \
  src/components src/services/apiClient.ts \
  --include="*.tsx" --include="*.ts" 2>/dev/null || true)

if [ -n "$REMAINING" ]; then
  echo ""
  echo "⚠  Firebase references still found — review manually:"
  echo "$REMAINING"
else
  echo "✓  No Firebase references remain in components or apiClient."
fi

echo ""
echo "=== Full verification: all Firebase references in src/ ==="
ALL_REMAINING=$(grep -rn "firebase" src/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-path="src/lib/firebase.ts" \
  --exclude-path="src/lib/firebase-admin.ts" \
  2>/dev/null || true)

if [ -n "$ALL_REMAINING" ]; then
  echo "⚠  Firebase found outside the two files to delete:"
  echo "$ALL_REMAINING"
else
  echo "✓  Only src/lib/firebase.ts and src/lib/firebase-admin.ts remain."
  echo "  → Safe to delete both now."
fi

echo ""
echo "=== Next steps ==="
echo "  1. Delete: src/lib/firebase.ts"
echo "  2. Delete: src/lib/firebase-admin.ts"
echo "  3. Delete: src/lib/devLogin.ts"
echo "  4. Run: npm uninstall firebase firebase-admin"
echo "  5. Run: npm run build   (should compile with zero Firebase errors)"