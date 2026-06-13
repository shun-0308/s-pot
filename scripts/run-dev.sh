#!/bin/sh
export PATH=/Users/shunmatsumoto/.nvm/versions/node/v24.15.0/bin:/opt/homebrew/bin:$PATH
cd "$(dirname "$0")/.." || exit 1
exec npm run dev -- --port 3100
