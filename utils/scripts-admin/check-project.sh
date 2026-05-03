#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WITH_BUILD=false
CHECK_PROTECTION=false

for arg in "$@"; do
  case "$arg" in
    --with-build)
      WITH_BUILD=true
      ;;
    --check-protection)
      CHECK_PROTECTION=true
      ;;
    -h|--help)
      cat <<'HELP'
Uso: utils/scripts-admin/check-project.sh [opcoes]

Opcoes:
  --with-build         Executa build dos 5 apps
  --check-protection   Consulta protecao da branch main via GitHub API
  -h, --help           Mostra esta ajuda
HELP
      exit 0
      ;;
    *)
      echo "Opcao desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

echo "== Repo =="
echo "$REPO_ROOT"

echo
echo "== Git status =="
GIT_STATUS="$(git status --short --branch)"
echo "$GIT_STATUS"

if echo "$GIT_STATUS" | grep -q '^ M\|^M \|^\?\?'; then
  echo "ALERTA: working tree com alteracoes locais."
else
  echo "OK: working tree limpo."
fi

echo
echo "== Ultimos commits =="
git log --oneline -n 5

GH_BIN=""
if command -v /usr/bin/gh >/dev/null 2>&1; then
  GH_BIN="/usr/bin/gh"
elif command -v gh >/dev/null 2>&1; then
  GH_BIN="$(command -v gh)"
fi

echo
echo "== CI Build (GitHub Actions) =="
if [[ -z "$GH_BIN" ]]; then
  echo "SKIP: gh nao encontrado."
else
  if GH_PAGER=cat PAGER=cat "$GH_BIN" auth status >/dev/null 2>&1; then
    GH_PAGER=cat PAGER=cat "$GH_BIN" run list \
      --workflow "CI Build" \
      --limit 3 \
      --json status,conclusion,displayTitle,headBranch,createdAt,url || true
  else
    echo "SKIP: gh sem autenticacao (rode: /usr/bin/gh auth login)."
  fi
fi

if [[ "$CHECK_PROTECTION" == true ]]; then
  echo
  echo "== Branch protection (main) =="
  if [[ -z "$GH_BIN" ]]; then
    echo "SKIP: gh nao encontrado."
  elif GH_PAGER=cat PAGER=cat "$GH_BIN" auth status >/dev/null 2>&1; then
    GH_PAGER=cat PAGER=cat "$GH_BIN" api repos/marreiro23/monorepo-ai-llm/branches/main/protection \
      --jq '{required_contexts: .required_status_checks.contexts, strict: .required_status_checks.strict, required_approvals: .required_pull_request_reviews.required_approving_review_count}'
  else
    echo "SKIP: gh sem autenticacao."
  fi
fi

if [[ "$WITH_BUILD" == true ]]; then
  echo
  echo "== Build dos apps =="
  npm run build:users-api
  npm run build:monorepo-ai-llm
  npm run build:llm-ops-api
  npm run build:sharepoint-api
  npm run build:sync-api
fi

echo
echo "Check concluido."
