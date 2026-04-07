#!/bin/bash
#
# migrate-database.sh
#
# Migrates data from an external PostgreSQL (e.g., Supabase) to the
# self-hosted PostgreSQL inside the docker-compose stack.
#
# Usage:
#   ./scripts/migrate-database.sh
#
# Required env vars:
#   SOURCE_DATABASE_URL  - Connection string of the source database (Supabase)
#   TARGET_DATABASE_URL  - Connection string of the target database (docker-compose)
#                          Defaults to the compose postgres if not set.
#
# Steps:
#   1. Dumps the source database (schema + data)
#   2. Restores into the target database
#   3. Verifies row counts
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[migrate]${NC} $1"; }
warn() { echo -e "${YELLOW}[migrate]${NC} $1"; }
err()  { echo -e "${RED}[migrate]${NC} $1"; exit 1; }

# ── Validate ──────────────────────────────────────────────
if [ -z "${SOURCE_DATABASE_URL:-}" ]; then
  err "SOURCE_DATABASE_URL is not set. Set it to your Supabase/external Postgres connection string."
fi

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-postgres://nisam:${POSTGRES_PASSWORD}@localhost:5432/nisam_video}"

log "Source: $(echo "$SOURCE_DATABASE_URL" | sed 's|://[^@]*@|://***@|')"
log "Target: $(echo "$TARGET_DATABASE_URL" | sed 's|://[^@]*@|://***@|')"

# Check tools
command -v pg_dump  >/dev/null 2>&1 || err "pg_dump not found. Install postgresql-client."
command -v psql     >/dev/null 2>&1 || err "psql not found. Install postgresql-client."

# ── Dump source ───────────────────────────────────────────
DUMP_FILE="/tmp/nisam_video_migration_$(date +%Y%m%d_%H%M%S).sql"

log "Dumping source database..."
pg_dump "$SOURCE_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --no-comments \
  --clean \
  --if-exists \
  --exclude-table='_prisma_migrations' \
  --exclude-table='_drizzle_migrations' \
  --exclude-schema='auth' \
  --exclude-schema='storage' \
  --exclude-schema='realtime' \
  --exclude-schema='supabase_*' \
  --exclude-schema='extensions' \
  --exclude-schema='pgbouncer' \
  --exclude-schema='pgsodium*' \
  --exclude-schema='vault' \
  --exclude-schema='graphql*' \
  > "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "Dump complete: $DUMP_FILE ($DUMP_SIZE)"

# ── Count source rows ────────────────────────────────────
log "Counting source rows..."
SOURCE_COUNTS=$(psql "$SOURCE_DATABASE_URL" -t -A -c "
  SELECT tablename, n_tup_ins - n_tup_del AS est_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
" 2>/dev/null || echo "")

if [ -n "$SOURCE_COUNTS" ]; then
  echo "$SOURCE_COUNTS" | while IFS='|' read -r tbl cnt; do
    [ -n "$tbl" ] && echo "  $tbl: ~$cnt rows"
  done
fi

# ── Restore into target ──────────────────────────────────
log "Restoring into target database..."
warn "This will DROP and recreate all tables in the target. Press Ctrl+C to abort (5s)..."
sleep 5

psql "$TARGET_DATABASE_URL" < "$DUMP_FILE" 2>&1 | grep -E "ERROR|FATAL" || true

log "Restore complete."

# ── Verify ────────────────────────────────────────────────
log "Verifying target row counts..."
psql "$TARGET_DATABASE_URL" -t -A -c "
  SELECT tablename, n_tup_ins - n_tup_del AS est_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
" 2>/dev/null | while IFS='|' read -r tbl cnt; do
  [ -n "$tbl" ] && echo "  $tbl: ~$cnt rows"
done

# ── Cleanup ───────────────────────────────────────────────
log "Dump file kept at: $DUMP_FILE"
log ""
log "Migration complete! Next steps:"
log "  1. Update your .env to point DATABASE_URL to the compose postgres"
log "  2. Restart the app: docker compose restart app"
log "  3. Verify the app works, then remove the old Supabase project"
log ""
warn "Keep the dump file as a backup until you've verified everything works."
