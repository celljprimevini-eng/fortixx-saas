#!/usr/bin/env bash
# Roda todas as migrations num Postgres LOCAL (nunca no Supabase de produção)
# com stubs mínimos de auth/storage e executa o teste de segurança.
#
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres ./supabase/tests/rls/run.sh
#
# Esperado: todo ataque (1..9) termina em ERR ou rows=0, e todo uso
# legítimo (L1..L11) em OK / rows>0.
set -euo pipefail
cd "$(dirname "$0")/../../.."
DB=fortixx_rls_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/rls/supabase-stubs.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f" >/dev/null 2>&1 || { echo "falhou em $f"; exit 1; }
done
psql -q -d $DB -f supabase/tests/rls/security.sql 2>&1 | grep -v '^$'
psql -q -d postgres -c "drop database $DB"
