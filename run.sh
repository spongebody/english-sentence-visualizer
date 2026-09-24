#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo '请先安装 Node.js 22 或更新版本（包含 npm）。' >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo '请使用 Node.js 22 或更新版本。' >&2
  exit 1
fi
if [[ ! -f .env && ! -f .env.local ]]; then
  cp .env.example .env
  chmod 600 .env
  echo '已创建 .env，请填入 DEEPSEEK_API_KEY 后重启。界面可以先行预览。'
fi
if [[ ! -d node_modules || ! -f node_modules/.installed-lock || package-lock.json -nt node_modules/.installed-lock ]]; then
  npm ci
  touch node_modules/.installed-lock
fi
app_port="${PORT:-3000}"
echo "句子研读：http://localhost:${app_port}（Ctrl+C 停止）"
exec npm run dev -- --port "$app_port"
