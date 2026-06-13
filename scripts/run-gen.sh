#!/bin/sh
# 水彩地図生成のランチャー。キーは ~/.spot_openai_key から読む
export PATH=/Users/shunmatsumoto/.nvm/versions/node/v24.15.0/bin:/opt/homebrew/bin:$PATH
export OPENAI_API_KEY="$(cat "$HOME/.spot_openai_key")"
cd "$(dirname "$0")/.." || exit 1
exec node scripts/generate-maps.mjs --provider openai "$@"
