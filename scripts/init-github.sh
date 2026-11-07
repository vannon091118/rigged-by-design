#!/usr/bin/env bash
# Initialisiert das Repo, setzt .gitignore, macht den ersten Commit und legt
# (falls gh authentifiziert ist) das oeffentliche GitHub-Repo an.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  git init -b main
fi

cat > .gitignore <<'EOF'
node_modules/
dist/
coverage/
artifacts/
*.log
.env
.env.local
.DS_Store
EOF

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Bestehende Historie gefunden - Initial-Commit uebersprungen."
else
  git add -A
  git commit -m "feat: initial core architecture"
  echo "Initial-Commit erstellt."
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) fehlt - Repo-Anlage uebersprungen."
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh ist nicht authentifiziert - Repo-Anlage uebersprungen."
  exit 0
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin existiert bereits: $(git remote get-url origin)"
  exit 0
fi

gh repo create rigged-by-design --public --source=. --remote=origin --push
