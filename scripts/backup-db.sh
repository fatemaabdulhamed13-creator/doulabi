#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Manual Supabase database backup (free plan has no automatic backups).
#
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres.<ref>@<host>:5432/postgres' ./scripts/backup-db.sh
#
# Get the URL from Supabase Dashboard → Connect → "Session pooler" (works on
# home Wi-Fi without IPv6) and REMOVE the ":[YOUR-PASSWORD]" part — the
# script asks for the password at a hidden prompt instead, so it never ends
# up in your shell history.
#
# Writes two files to ~/doulabi-backups/<date>/:
#   doulabi.dump    — everything (all schemas incl. auth users), pg_restore
#                     custom format: the full disaster-recovery copy.
#   public.sql.gz   — your app tables only (profiles, products, favorites…),
#                     schema + data as plain SQL: readable, easy to restore
#                     a single table from.
#
# Photos live in Cloudflare R2, which is separate from Supabase and not
# affected by anything that happens to the database.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Set SUPABASE_DB_URL first (see the comment at the top of this script)." >&2
  exit 1
fi

# Hidden password prompt (skipped if the URL already carries a password or
# PGPASSWORD is set). pg_dump reads PGPASSWORD from the environment.
if [[ -z "${PGPASSWORD:-}" && ! "$SUPABASE_DB_URL" =~ ://[^/@]+:[^/@]+@ ]]; then
  read -r -s -p "Database password: " PGPASSWORD
  echo
  export PGPASSWORD
fi

# Postgres.app (postgresapp.com) puts pg_dump here without touching PATH.
PGAPP_BIN="/Applications/Postgres.app/Contents/Versions/latest/bin"
[[ -d "$PGAPP_BIN" ]] && export PATH="$PGAPP_BIN:$PATH"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install Postgres.app from https://postgresapp.com (drag to Applications), then re-run." >&2
  exit 1
fi

OUT="$HOME/doulabi-backups/$(date +%Y-%m-%d_%H%M)"
mkdir -p "$OUT"

echo "→ Full dump (all schemas)…"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --file="$OUT/doulabi.dump"

echo "→ App tables (public schema) as SQL…"
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges | gzip > "$OUT/public.sql.gz"

# Sanity check: a dump that "succeeded" but is tiny means something's wrong.
SIZE=$(wc -c < "$OUT/doulabi.dump" | tr -d ' ')
if (( SIZE < 50000 )); then
  echo "⚠︎ Full dump is only ${SIZE} bytes — check it before relying on it." >&2
fi

echo "✓ Backup saved to $OUT"
ls -lh "$OUT"
