#!/usr/bin/env bash
set -e

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s#replace-with-a-random-64-char-hex-string#$SECRET#" .env
fi

npm install
npx prisma migrate deploy
npx prisma generate
