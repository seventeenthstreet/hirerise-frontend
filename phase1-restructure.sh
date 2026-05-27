#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# phase1-restructure.sh
# PHASE 1 — ROUTE RESTRUCTURING: file migration script
#
# Run from the frond/ project root:
#   chmod +x phase1-restructure.sh
#   ./phase1-restructure.sh
#
# What this script does (in order):
#   1. Create new route group directories
#   2. Move protected app pages into (auth)/(app)/
#   3. Move onboarding pages into (auth)/(onboarding)/
#   4. Install the three updated/new layout files
#   5. Install the updated Providers.tsx
#   6. Print a verification checklist
#
# SAFETY:
#   - All moves use `git mv` so Git tracks the renames (preserves history).
#   - If Git is not available or files are not tracked, falls back to `mv`.
#   - The script is idempotent: re-running after partial completion is safe
#     (git mv on an already-moved file will fail gracefully, not corrupt state).
#   - No page content is modified — only directory location changes.
#   - All URL routes are preserved: Next.js route groups with () are URL-transparent.
#
# After running:
#   1. Replace content of updated layout files (see DELIVERABLES below).
#   2. Run `pnpm dev` and verify all routes respond correctly.
#   3. Run `pnpm build` to confirm no import resolution errors.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

log()  { echo -e "${BLUE}[phase1]${RESET} $1"; }
ok()   { echo -e "${GREEN}  ✓${RESET} $1"; }
warn() { echo -e "${YELLOW}  ⚠${RESET} $1"; }

safe_mv() {
  local src="$1"
  local dst_dir="$2"
  if [ ! -e "$src" ]; then
    warn "Source not found (already moved?): $src"
    return 0
  fi
  mkdir -p "$dst_dir"
  if git rev-parse --git-dir > /dev/null 2>&1 && git ls-files --error-unmatch "$src" > /dev/null 2>&1; then
    git mv "$src" "$dst_dir/"
    ok "git mv $src → $dst_dir/"
  else
    mv "$src" "$dst_dir/"
    ok "mv $src → $dst_dir/"
  fi
}

safe_mv_dir() {
  local src="$1"
  local dst="$2"
  if [ ! -d "$src" ]; then
    warn "Source dir not found (already moved?): $src"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git mv "$src" "$dst"
    ok "git mv $src → $dst"
  else
    mv "$src" "$dst"
    ok "mv $src → $dst"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}PHASE 1 — ROUTE RESTRUCTURING${RESET}"
echo "Working directory: $(pwd)"
echo ""

if [ ! -d "src/app" ]; then
  echo "ERROR: Must run from the frond/ project root (src/app not found)"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
log "Step 1: Create new route group directories"

mkdir -p src/app/\(auth\)/\(app\)/dashboard/analytics
mkdir -p src/app/\(auth\)/\(onboarding\)/direction
mkdir -p src/app/\(auth\)/\(onboarding\)/onboarding
mkdir -p src/app/\(auth\)/\(onboarding\)/career/onboarding
mkdir -p src/app/\(auth\)/\(onboarding\)/education/onboarding

ok "Directory structure created"

# ─────────────────────────────────────────────────────────────────────────────
log "Step 2: Move protected app pages → (auth)/(app)/"

# dashboard (directory move preserves analytics sub-route)
safe_mv_dir \
  "src/app/(auth)/dashboard" \
  "src/app/(auth)/(app)/dashboard"

# resume
safe_mv \
  "src/app/(auth)/resume/page.tsx" \
  "src/app/(auth)/(app)/resume"

# market-insights
safe_mv \
  "src/app/(auth)/market-insights/page.tsx" \
  "src/app/(auth)/(app)/market-insights"

# Clean up empty source directories (if any)
rmdir "src/app/(auth)/resume" 2>/dev/null        && ok "Removed empty (auth)/resume/" || true
rmdir "src/app/(auth)/market-insights" 2>/dev/null && ok "Removed empty (auth)/market-insights/" || true

# ─────────────────────────────────────────────────────────────────────────────
log "Step 3: Move onboarding pages → (auth)/(onboarding)/"

# direction
safe_mv \
  "src/app/(auth)/direction/page.tsx" \
  "src/app/(auth)/(onboarding)/direction"

# onboarding (main)
safe_mv \
  "src/app/(auth)/onboarding/page.tsx" \
  "src/app/(auth)/(onboarding)/onboarding"

# onboarding layout (passthrough — preserve as-is inside new group)
if [ -f "src/app/(auth)/onboarding/layout.tsx" ]; then
  safe_mv \
    "src/app/(auth)/onboarding/layout.tsx" \
    "src/app/(auth)/(onboarding)/onboarding"
fi

# career/onboarding
safe_mv \
  "src/app/(auth)/career/onboarding/page.tsx" \
  "src/app/(auth)/(onboarding)/career/onboarding"

# education/onboarding
safe_mv \
  "src/app/(auth)/education/onboarding/page.tsx" \
  "src/app/(auth)/(onboarding)/education/onboarding"

# Clean up empty source directories
rmdir "src/app/(auth)/direction"                      2>/dev/null || true
rmdir "src/app/(auth)/onboarding"                     2>/dev/null || true
rmdir "src/app/(auth)/career/onboarding"              2>/dev/null || true
rmdir "src/app/(auth)/career"                         2>/dev/null || true
rmdir "src/app/(auth)/education/onboarding"           2>/dev/null || true
rmdir "src/app/(auth)/education"                      2>/dev/null || true

ok "Onboarding pages moved"

# ─────────────────────────────────────────────────────────────────────────────
log "Step 4: Install new/updated layout files"

echo ""
echo -e "${YELLOW}  ACTION REQUIRED:${RESET} Copy the following files from the deliverables:"
echo ""
echo "  DELIVERABLE → DESTINATION"
echo "  ──────────────────────────────────────────────────────────────────────"
echo "  app-layout.tsx       → src/app/(auth)/(app)/layout.tsx"
echo "  onboarding-layout.tsx→ src/app/(auth)/(onboarding)/layout.tsx"
echo "  auth-layout.tsx      → src/app/(auth)/layout.tsx           (replace)"
echo "  Providers.tsx        → src/providers/Providers.tsx         (replace)"
echo ""

# If the deliverable files are in the same directory, copy them automatically:
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/app-layout.tsx" ]; then
  cp "${SCRIPT_DIR}/app-layout.tsx" "src/app/(auth)/(app)/layout.tsx"
  ok "Installed (auth)/(app)/layout.tsx"
fi

if [ -f "${SCRIPT_DIR}/onboarding-layout.tsx" ]; then
  cp "${SCRIPT_DIR}/onboarding-layout.tsx" "src/app/(auth)/(onboarding)/layout.tsx"
  ok "Installed (auth)/(onboarding)/layout.tsx"
fi

if [ -f "${SCRIPT_DIR}/auth-layout.tsx" ]; then
  cp "${SCRIPT_DIR}/auth-layout.tsx" "src/app/(auth)/layout.tsx"
  ok "Updated (auth)/layout.tsx → passthrough"
fi

if [ -f "${SCRIPT_DIR}/Providers.tsx" ]; then
  cp "${SCRIPT_DIR}/Providers.tsx" "src/providers/Providers.tsx"
  ok "Updated Providers.tsx → ObservabilityProvider added"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── FINAL STRUCTURE ──────────────────────────────────────────────────────${RESET}"
find src/app -name "*.tsx" | grep -v node_modules | sort | \
  sed 's|src/app/||' | \
  awk '{printf "  %s\n", $0}'

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── VERIFICATION CHECKLIST ───────────────────────────────────────────────${RESET}"
echo ""
echo "  Run these checks after applying the restructure:"
echo ""
echo "  □  pnpm dev — start dev server"
echo "  □  / → redirects to /direction or /dashboard (no 404)"
echo "  □  /direction → renders direction selector (NO sidebar/header)"
echo "  □  /onboarding → renders onboarding flow (NO sidebar/header)"
echo "  □  /career/onboarding → renders career onboarding (NO sidebar/header)"
echo "  □  /education/onboarding → renders education onboarding (NO sidebar/header)"
echo "  □  /dashboard → renders dashboard WITH sidebar + header"
echo "  □  /resume → renders resume page WITH sidebar + header"
echo "  □  /market-insights → renders market insights WITH sidebar + header"
echo "  □  /login → renders login page (no sidebar, no AppShell)"
echo "  □  Auth flow: sign in → redirect to correct destination"
echo "  □  console: no 'window.__HIRERISE_LOG is not a function' errors"
echo "  □  console: SESSION_START event visible in window.__obs?.getEventBuffer()"
echo "  □  pnpm build — no import resolution or TypeScript errors"
echo "  □  No hydration mismatch warnings in console"
echo ""
echo -e "${GREEN}${BOLD}Phase 1 restructuring complete.${RESET}"