#!/usr/bin/env bash
#
# git-publish.sh — publish committed file changes to a git remote when the
# normal git workflow is broken by Cowork's deletion-blocking mount.
#
# Why this exists
# ---------------
# Cowork mounts the user's folders so that unlink()/rmdir() return EPERM
# ("Operation not permitted"). Ordinary git breaks on this in three ways:
#   1. A stale .git/index.lock from an interrupted run cannot be removed, so
#      `git add` / `git commit` refuse to run at all.
#   2. Moving a branch ref rewrites .git/refs/... via a rename-over-existing,
#      which the mount blocks.
#   3. Temp-object cleanup cannot unlink (cosmetic — the object is still saved).
#
# This script sidesteps all three:
#   - It stages into a TEMP index outside the mount (GIT_INDEX_FILE in $TMPDIR),
#     so the locked .git/index is never touched.
#   - It builds the commit with `git commit-tree`, a plumbing command that only
#     WRITES new objects — it never deletes or renames anything.
#   - It pushes the new commit straight to the remote branch by SHA
#     (`git push <remote> <sha>:refs/heads/<branch>`), so the local branch ref
#     never has to move. The remote becomes the source of truth.
#
# It is safe to run on a perfectly healthy repo too — the same steps work there.
#
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: git-publish.sh --message "MSG" [options] [FILE ...]

Required:
  --message MSG     Commit message.

Options:
  --repo PATH       Repo working directory (default: current directory).
  --branch NAME     Branch to publish to (default: the repo's current branch).
  --remote NAME     Remote name (default: origin).
  --dry-run         Do everything except the push; print the commit SHA.
  -h, --help        Show this help.

FILE ...            Paths to publish (relative to the repo root, or absolute).
                    If omitted, all modified tracked files are published
                    (git add -u). Name a brand-new untracked file explicitly
                    to include it.

Examples:
  git-publish.sh --repo ~/falcons-tracker --branch master \
    --message "Refresh news digest" src/playerData.js

  cd ~/hawks-tracker && git-publish.sh --message "Update roster" \
    src/playerData.js
EOF
}

# ---- parse arguments -------------------------------------------------------
REPO="$(pwd)"
BRANCH=""
REMOTE="origin"
MESSAGE=""
DRY_RUN=0
FILES=()

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)    REPO="${2:?--repo needs a value}"; shift 2 ;;
    --branch)  BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    --remote)  REMOTE="${2:?--remote needs a value}"; shift 2 ;;
    --message) MESSAGE="${2:?--message needs a value}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; while [ $# -gt 0 ]; do FILES+=("$1"); shift; done ;;
    -*) echo "ERROR: unknown option '$1'" >&2; usage; exit 1 ;;
    *)  FILES+=("$1"); shift ;;
  esac
done

if [ -z "$MESSAGE" ]; then
  echo "ERROR: --message is required." >&2
  usage
  exit 1
fi

# ---- sanity-check the repo -------------------------------------------------
cd "$REPO" || { echo "ERROR: cannot cd into '$REPO'" >&2; exit 1; }
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: '$REPO' is not a git repository." >&2
  exit 1
fi
REPO="$(pwd)"

if [ -z "$BRANCH" ]; then
  BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
  if [ -z "$BRANCH" ]; then
    echo "ERROR: HEAD is detached — pass --branch explicitly." >&2
    exit 1
  fi
fi

HEAD_SHA="$(git rev-parse HEAD)"

# ---- pre-flight: do not clobber remote work -------------------------------
# `git ls-remote` exits 0 even when the ref is absent (empty output); it exits
# non-zero only on a connection or auth failure — so we can tell the two apart.
if REMOTE_LS="$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" 2>/dev/null)"; then
  REMOTE_TIP="$(printf '%s' "$REMOTE_LS" | cut -f1)"
else
  echo "ERROR: cannot reach remote '$REMOTE'." >&2
  echo "If this is a 401/403, the auth token (PAT) is likely expired —" >&2
  echo "report it and stop; do not retry or improvise another auth path." >&2
  exit 1
fi

if [ -n "$REMOTE_TIP" ] && [ "$REMOTE_TIP" != "$HEAD_SHA" ]; then
  echo "ERROR: $REMOTE/$BRANCH is at $REMOTE_TIP" >&2
  echo "       but local HEAD is    $HEAD_SHA" >&2
  echo "The branches have diverged. Pushing now would not fast-forward and" >&2
  echo "could clobber remote work. Sync the local repo first, then re-run:" >&2
  echo "  cd $REPO && rm -f .git/index.lock" >&2
  echo "  git fetch $REMOTE && git reset --hard $REMOTE/$BRANCH" >&2
  echo "  # then re-apply your edits and run git-publish.sh again" >&2
  exit 1
fi

# ---- stage into a throwaway index outside the mount -----------------------
TMP_INDEX="$(mktemp "${TMPDIR:-/tmp}/git-publish-index.XXXXXX")"
export GIT_INDEX_FILE="$TMP_INDEX"
cleanup() { rm -f "$TMP_INDEX" "$TMP_INDEX.lock"; }
trap cleanup EXIT

git read-tree HEAD   # temp index now mirrors the HEAD commit's tree

if [ "${#FILES[@]}" -gt 0 ]; then
  git add -- "${FILES[@]}"
else
  git add -u          # all modifications/deletions to already-tracked files
fi

TREE="$(git write-tree)"

if [ "$TREE" = "$(git rev-parse 'HEAD^{tree}')" ]; then
  echo "Nothing to publish — the staged content matches HEAD. No commit made."
  exit 0
fi

echo "=== Changes to publish on $REMOTE/$BRANCH (vs HEAD $HEAD_SHA) ==="
git diff --cached HEAD --stat
echo

# ---- author / committer identity -----------------------------------------
NAME="$(git config user.name  || true)"
EMAIL="$(git config user.email || true)"
[ -n "$NAME" ]  || NAME="$(git log -1 --format='%an' 2>/dev/null || echo 'Cowork Agent')"
[ -n "$EMAIL" ] || EMAIL="$(git log -1 --format='%ae' 2>/dev/null || echo 'cowork@localhost')"
export GIT_AUTHOR_NAME="$NAME"    GIT_AUTHOR_EMAIL="$EMAIL"
export GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$EMAIL"

# ---- build the commit object (writes only; never deletes) -----------------
COMMIT="$(git commit-tree "$TREE" -p HEAD -m "$MESSAGE")"
echo "Created commit $COMMIT  (author: $NAME <$EMAIL>)"
echo "Any 'unable to unlink tmp_obj' warnings above are harmless — the object"
echo "is written; the mount just blocks cleanup of git's temp file."
echo

# ---- push -----------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY RUN — not pushing. The real run would execute:"
  echo "  git push $REMOTE $COMMIT:refs/heads/$BRANCH"
  exit 0
fi

echo "Pushing $COMMIT -> $REMOTE/$BRANCH ..."
if ! git push "$REMOTE" "$COMMIT:refs/heads/$BRANCH"; then
  echo "ERROR: push failed." >&2
  echo "A 401/403 means the auth token (PAT) is expired — report it; do not" >&2
  echo "retry. A non-fast-forward means the remote moved — sync and re-run." >&2
  exit 1
fi

# ---- verify ---------------------------------------------------------------
NEW_TIP="$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" | cut -f1)"
if [ "$NEW_TIP" != "$COMMIT" ]; then
  echo "WARNING: remote tip is $NEW_TIP, expected $COMMIT — verify manually." >&2
  exit 1
fi

echo
echo "Published. $REMOTE/$BRANCH: $HEAD_SHA -> $COMMIT"
cat <<EOF

NOTE: the LOCAL branch ref still points at the old commit (we pushed by SHA to
avoid the deletion-blocked ref update). The remote is correct and will deploy.
When you are next on the actual machine, sync the local repo:

  cd "$REPO"
  rm -f .git/index.lock
  git fetch $REMOTE && git reset --hard $REMOTE/$BRANCH
EOF
