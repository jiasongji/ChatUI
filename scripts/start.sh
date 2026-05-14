#!/usr/bin/env sh
set -eu

mkdir -p /app/data

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Initializing admin user..."
npx tsx prisma/seed.ts

echo "Starting ChatUI..."
exec node server.js
