#!/usr/bin/env bash
# Sitting script for PR #5128 merge-up — Path 2 (single merge into the A8
# amendment tip, then fast-forward the PR branch). Prepared by wave-2600
# lane Z, 2026-11-04. Pack: PACK.md in this directory.
#
# PRECONDITIONS (sitting's own acts, NOT done by this script):
#   - Pre-act journal entry written (act: merge-up + FF push, target: PR #5128).
#   - Main re-pinned live immediately before running; pass it as $1.
#     The pack was built against main 8c9deff7534ed549df88b730c03af2d9d3a11db8.
#     If main has moved, STOP: the conflict set must be re-derived.
#   - resolve-catalog.py and fix-duplicate-import.patch sit next to this script.
#
# The script performs NO push. It stops at a verified local composed commit
# and prints the exact push command for the sitting to execute under its journal.
set -euo pipefail
MAIN_SHA="${1:?usage: apply-mergeup.sh <current-main-sha>}"
PACK_MAIN="8c9deff7534ed549df88b730c03af2d9d3a11db8"
PR_HEAD="f2cbdd4a51d6f70f2489d2b0c33cdcd10df7703a"     # ppr/public-proof-residuals
AMEND_TIP="2c1c87641ebfaeea47fec60936234ba5cb89bb0c"  # amend/5128-a8
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$MAIN_SHA" = "$PACK_MAIN" ] || { echo "STOP: main moved since pack ($MAIN_SHA != $PACK_MAIN); re-derive the pack."; exit 1; }

WORK="$(mktemp -d)/repo"
gh repo clone Uuriko/project-room "$WORK" -- --no-checkout --filter=blob:none
cd "$WORK"
git fetch origin "ppr/public-proof-residuals:refs/heads/pr5128" "amend/5128-a8:refs/heads/amend5128" "main:refs/heads/mainlive"
[ "$(git rev-parse pr5128)" = "$PR_HEAD" ]     || { echo "STOP: PR head moved."; exit 1; }
[ "$(git rev-parse amend5128)" = "$AMEND_TIP" ] || { echo "STOP: amend tip moved."; exit 1; }
[ "$(git rev-parse mainlive)" = "$MAIN_SHA" ]   || { echo "STOP: main fetch mismatch."; exit 1; }

git config user.email "sitting@local"; git config user.name "Landing sitting"
git checkout -b mergeup-5128 amend5128
if git merge --no-commit --no-ff mainlive; then
  echo "STOP: merge was clean — pack falsifier fired; #5128 no longer conflicts. Re-grade the PR instead."
  exit 1
fi
# Exactly the two expected conflicted files, nothing else:
UU="$(git diff --name-only --diff-filter=U | sort)"
EXPECTED="$(printf 'plugins/project-room/skills/project-room/references/errors-catalog.md\nskills/project-room/references/errors-catalog.md')"
[ "$UU" = "$EXPECTED" ] || { echo "STOP: unexpected conflict set:"; echo "$UU"; exit 1; }

python3 "$HERE/resolve-catalog.py"
cmp skills/project-room/references/errors-catalog.md plugins/project-room/skills/project-room/references/errors-catalog.md
git add skills/project-room/references/errors-catalog.md plugins/project-room/skills/project-room/references/errors-catalog.md
git commit --no-edit

# Known auto-merge defect: main and the amendment each added the identical
# import line `discoverabilityErrorOverride,` to tests/discoverability.test.js;
# auto-merge keeps both and the file dies with a duplicate-declaration SyntaxError.
git apply --check "$HERE/fix-duplicate-import.patch"
git apply "$HERE/fix-duplicate-import.patch"
git add tests/discoverability.test.js
git commit -m "Drop duplicate discoverabilityErrorOverride import from main+amend auto-merge"

# FF proof: the PR branch can fast-forward to this commit.
git merge-base --is-ancestor "$PR_HEAD" HEAD

# Local verification (the pack's observed result at tree 44fbb116…: 32/32).
node --test tests/errors-catalog-drift.test.js tests/public-proof-404-copy.test.js tests/discoverability.test.js

echo
echo "Composed tree: $(git rev-parse HEAD^{tree})  (pack expectation: 44fbb11612167bce1eee1c209c3c97949579b2f0)"
echo "If the tree differs, STOP and re-derive — do not push."
echo "Sitting's journalled push (NOT executed):"
echo "  git push origin HEAD:ppr/public-proof-residuals   # fast-forward, no force"
echo "Then: CI must run at the new exact head; heavy jobs are NOT-RUN until they do."
