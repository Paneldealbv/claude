#!/usr/bin/env bash
# Draait alle migraties en beveiligingstests op een tijdelijke, lokale
# Postgres-database. Raakt nooit de echte Supabase-database.
#
# Vereist: Postgres 15+ binaries (initdb, pg_ctl, psql).
# Gebruik:  npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_TEST:-54329}"
DATA="$(mktemp -d)"

# initdb weigert als root te draaien; gebruik dan de postgres-gebruiker.
RUN=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$DATA"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$DATA/db" -U postgres --auth=trust -E UTF8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -o "-p $PORT -k $DATA -c listen_addresses=''" \
  -l "$DATA/log" -w start >/dev/null

PSQL=("${RUN[@]}" "$PGBIN/psql" -h "$DATA" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database nieuwbouw_test"
DB=("${PSQL[@]}" -d nieuwbouw_test)

echo "→ Supabase-omgeving nabootsen"
"${DB[@]}" -f "$ROOT/supabase/tests/supabase-stubs.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ Migratie $(basename "$f")"
  "${DB[@]}" -1 -f "$f" >/dev/null
done

echo "→ Beveiligingstests"
"${DB[@]}" -f "$ROOT/supabase/tests/rls.test.sql" 2>&1 >/dev/null \
  | sed -e 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /' -e 's/^NOTICE:  /  /'
status=${PIPESTATUS[0]}
[ "$status" = "0" ] || exit "$status"

echo "→ Live-controle (zelfde script als op Supabase, wordt teruggedraaid)"
uit="$("${DB[@]}" -f "$ROOT/supabase/tests/live-check.sql" 2>&1 || true)"
if grep -q "LIVE-TEST GESLAAGD" <<<"$uit"; then
  grep -o "LIVE-TEST GESLAAGD.*" <<<"$uit" | sed 's/^/  ✓ /'
else
  echo "$uit"
  exit 1
fi
