#!/usr/bin/env bash
set -uo pipefail
BASE=${1:?template database}
shift
HERE=$(cd "$(dirname "$0")" && pwd)
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
files=("$@")
[ ${#files[@]} -eq 0 ] && files=("$HERE"/../*.sql)
fail=0
for f in "${files[@]}"; do
  t="t_$$"
  dropdb --if-exists "$t"; createdb -T "$BASE" "$t"
  if out=$(psql -q -X -v ON_ERROR_STOP=1 -d "$t" -f "$f" 2>&1); then echo "PASS $(basename "$f")"; else echo "FAIL $(basename "$f")"; echo "$out" | tail -5; fail=1; fi
  dropdb "$t"
done
exit $fail
