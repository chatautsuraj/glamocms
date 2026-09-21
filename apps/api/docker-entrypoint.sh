#!/bin/sh
set -e
# Production containers always use Postgres (compose / Render set DATABASE_URL).
if [ -f prisma/schema.prisma ]; then
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma || true
fi
npx prisma generate
npx prisma db push --skip-generate
exec node dist/src/main.js
