#!/usr/bin/env bash
# scripts/git-publish.sh
# ────────────────────────────────────────────────────────────────────────────
# Self-healing git publish for Cowork sessions.
#
# The Cowork mount blocks unlink() on tracked files, which breaks two normal
# git workflows:
#   (1) `git add` / `git commit` create `.git/index.lock`, then can't remove
#       it on success — so the next git write-op refuses with
#       "Unable to create '.git/index.lock': File exists."
#   (2) `git push` / `git update-ref` rename a `.lock` file over the target
#       ref — the rename requires unlinking the old ref, which also EPERMs,
#       so the local branch ref stays stale even after a successful push.
#
# This script sidesteps both:
#   (1) It never touches `.git/index` — it stages into a throwaway index in
#       `/tmp` via GIT_INDEX_FILE, so no lock file is ever created in `.git/`.
#   (2) It pushes the new commit *by SHA* to the remote, then overwrites
#       `.git/refs/heads/<branch>` in place with `>` (which truncates and
#       writes without ever calling unlink). The local ref ends up pointing
#       at the new commit, no manual `git fetch && git reset --hard` needed.
#
# After this script runs successfully:
#   • remote tip = local HEAD = the new commit
#   • `git status` is clean
#   • `git log` shows the new commit
#   • no `.git/index.lock` was created by this script (any pre-existing one
#     is left in place — harmless for read-only ops, and it'll be cleaned
#     up naturally next time the user is on the real machine)
#
# Usage:
#   scripts/git-publish.sh --message "..." [--branch main] [--remote origin]
#                          [--dry-run] [FILE ...]
#
# If no FILEs are given, all currently-modified tracked files are staged.
# Untracked files MUST be named explicitly.
#
# Examples:
#   scripts/git-publish.sh --message "Daily refresh" \
#       src/playerData.js liverpool-tracker.jsx
#
#   scripts/git-publish.sh --message "WIP" --dry-run
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── arg parsing ─────────────────────────────────────────────────────────────
BRANCH=""
REMOTE="origin"
MESSAGE=""
DRY_RUN=0
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message|-m) MESSAGE="$2"; shift 2;;
    --branch|-b)  BRANCH="$2";  shift 2;;
    --remote|-r)  REMOTE="$2";  shift 2;;
    --dry-run)    DRY_RUN=1;    shift;;
    -h|--help)
      sed -n '2,50p' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    --) shift; FILES+=("$@"); break;;
    -*) echo "Unknown flag: $1" >&2; exit 2;;
    *)  FILES+=("$1"); shift;;
  esac
done

if [[ -z "$MESSAGE" ]]; then
  echo "ERROR: --message is required" >&2
  exit 2
fi

# ── repo discovery ──────────────────────────────────────────────────────────
REPO_DIR="$(git rev-parse --show-toplevel)"
cd "$REPO_DIR"

if [[ -z "$BRANCH" ]]; then
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
fi

# ── pre-flight: don't clobber a remote that moved ahead ─────────────────────
PARENT=$(git rev-parse HEAD)
REMOTE_TIP=$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" 2>/dev/null | cut -f1)

if [[ -z "$REMOTE_TIP" ]]; then
  echo "ERROR: could not read remote tip from $REMOTE/$BRANCH" >&2
  exit 1
fi

if [[ "$REMOTE_TIP" != "$PARENT" ]]; then
  echo "ABORT: remote $REMOTE/$BRANCH has moved ahead of local HEAD." >&2
  echo "  local HEAD:  $PARENT" >&2
  echo "  remote tip:  $REMOTE_TIP" >&2
  echo "" >&2
  echo "On a non-Cowork machine: cd '$REPO_DIR' && git fetch && git reset --hard $REMOTE/$BRANCH" >&2
  echo "Then re-apply your edits and re-run this script." >&2
  exit 1
fi

# ── stage into a throwaway index in /tmp (never touches .git/index.lock) ────
TMPIDX=$(mktemp /tmp/git-index.XXXXXX)
trap 'rm -f "$TMPIDX" "$TMPIDX.lock"' EXIT

# Seed it from HEAD so the diff is calculated against the right baseline
GIT_INDEX_FILE="$TMPIDX" git read-tree HEAD

# If no FILEs given, stage every currently-modified tracked file
if [[ ${#FILES[@]} -eq 0 ]]; then
  while IFS= read -r _f; do [ -n "$_f" ] && FILES+=("$_f"); done < <(git diff --name-only HEAD)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Nothing to publish; working tree matches HEAD."
  exit 0
fi

# The `2>&1 | grep -v 'unable to unlink' || true` swallows the harmless
# warnings about temp objects git can't clean up under the mount.
GIT_INDEX_FILE="$TMPIDX" git add -- "${FILES[@]}" 2>&1 \
  | grep -v "unable to unlink" || true

TREE=$(GIT_INDEX_FILE="$TMPIDX" git write-tree)

echo "── publish plan ─────────────────────────────────────────────────────"
echo "  repo:    $REPO_DIR"
echo "  branch:  $BRANCH  (remote: $REMOTE)"
echo "  parent:  $PARENT"
echo "  tree:    $TREE"
echo "  files:"
printf '    %s\n' "${FILES[@]}"
echo "── diff ─────────────────────────────────────────────────────────────"
git diff --stat HEAD -- "${FILES[@]}"
echo "─────────────────────────────────────────────────────────────────────"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "DRY RUN — would build commit on $TREE with parent $PARENT and push to $REMOTE/$BRANCH"
  exit 0
fi

# ── build the commit (commit-tree only writes; never deletes) ───────────────
NEW_SHA=$(printf '%s\n' "$MESSAGE" | git commit-tree "$TREE" -p "$PARENT")
echo "new commit: $NEW_SHA"

# ── push the new SHA straight to the remote branch ──────────────────────────
echo "pushing $NEW_SHA -> $REMOTE/$BRANCH ..."
git push "$REMOTE" "$NEW_SHA:refs/heads/$BRANCH"

# ── SELF-HEAL part 1: overwrite local ref in place (no rename, no unlink) ──
# This is the line that makes the script "no manual housekeeping needed."
# `>` opens with O_TRUNC and writes; no unlink syscall is involved, so the
# Cowork mount allows it. The newline at the end matches git's own format.
REF_FILE=".git/refs/heads/$BRANCH"
if [[ -f "$REF_FILE" ]]; then
  printf '%s\n' "$NEW_SHA" > "$REF_FILE"
else
  # Packed ref or non-loose layout — fall back to update-ref (will emit a
  # harmless "unable to unlink HEAD.lock" warning but the ref still updates)
  git update-ref "refs/heads/$BRANCH" "$NEW_SHA" 2>&1 \
    | grep -v "unable to unlink" || true
fi

# ── SELF-HEAL part 2: sync .git/index with the new tree ─────────────────────
# Without this, `git status` would show the just-committed files as either
# modified or deleted because the real .git/index still reflects HEAD's old
# tree. The temp index ($TMPIDX) already has the correct post-commit state
# — copy it over. cp does O_TRUNC + write, no unlink, so the mount allows it.
cp "$TMPIDX" .git/index

# ── verify ─────────────────────────────────────────────────────────────────
echo "── post-publish state ───────────────────────────────────────────────"
echo "  local HEAD:  $(git rev-parse HEAD)"
echo "  remote tip:  $(git ls-remote "$REMOTE" "refs/heads/$BRANCH" | cut -f1)"
echo "  working tree:"
git status --short | sed 's/^/    /'
echo "─────────────────────────────────────────────────────────────────────"
echo "PUBLISHED: $NEW_SHA"
