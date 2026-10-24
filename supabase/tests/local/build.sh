#!/usr/bin/env bash
set -euo pipefail
DB=${1:?database name}
UPTO=${2:-}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG="$HERE/../../migrations"
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
dropdb --if-exists "$DB"
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/shim.sql" >/dev/null
for f in "$MIG"/*.sql; do
  n=$(basename "$f" | sed -E 's/^[0-9]{11}([0-9]{3}).*/\1/')
  if [ -n "$UPTO" ] && [ "$n" -gt "$UPTO" ]; then break; fi
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null 2>"/tmp/build-$DB.err" || { echo "failed at $(basename "$f")"; cat "/tmp/build-$DB.err"; exit 1; }
done
echo "built $DB"
