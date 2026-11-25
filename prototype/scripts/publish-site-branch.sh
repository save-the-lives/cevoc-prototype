#!/usr/bin/env bash
# Publish a built site folder to the `site` branch as a normal commit on top of the branch,
# so a server that installed the site with `git clone -b site` can keep it current with a plain `git pull`.
# (Force-pushing a fresh orphan commit each time breaks `git pull` on that server.)
#
# Usage: publish-site-branch.sh <built-site-dir> <remote-url> <commit-message>
# Used by .github/workflows/deploy.yml and by exam/run-exam.sh, so the exam tests the real publish step.
set -euo pipefail
SRC=$(cd "$1" && pwd); REMOTE=$2; MSG=$3
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if git ls-remote --exit-code --heads "$REMOTE" site >/dev/null 2>&1; then
  git clone -q --depth 1 -b site "$REMOTE" "$WORK/site"
else
  git init -q -b site "$WORK/site"
fi
cd "$WORK/site"
git config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"

# Replace the tracked contents with the new build (keeps .git; deleted files are removed by `git add -A`).
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$SRC"/. .
# The server keeps its shared database in data/ (created by api/state.php): never tracked, never shown by git status.
printf '%s\n' 'data/*.sqlite*' > .gitignore
git add -A
if git diff --cached --quiet; then echo "site branch already up to date"; exit 0; fi
git commit -qm "$MSG"
git push -q "$REMOTE" HEAD:site
echo "published: $(git rev-parse --short HEAD)"
