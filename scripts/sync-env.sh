#!/usr/bin/env bash
# Sincroniza .env.local com Vercel (production + preview + development)
# Uso: bash scripts/sync-env.sh
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "❌ .env.local não encontrado"
  exit 1
fi

VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_PROJECT_REF"
  "NEXT_PUBLIC_APP_URL"
  "STRIPE_SECRET_KEY"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "STRIPE_PRICE_BASICO"
  "STRIPE_PRICE_PRO"
  "STRIPE_PRICE_ENTERPRISE"
  "RESEND_API_KEY"
  "RESEND_FROM_EMAIL"
  "N8N_WEBHOOK_URL_RESUME_PARSE"
  "N8N_WEBHOOK_SECRET"
)

ENVS=(production preview development)

# Parseia .env.local e monta array KEY=VALUE (só vars não-comentadas, não-vazias)
declare -A VALUES
while IFS= read -r line; do
  line="${line%%#*}"               # remove comentários inline
  line="$(echo "$line" | xargs)"    # trim
  [ -z "$line" ] && continue
  [[ "$line" =~ ^[A-Z_][A-Z0-9_]*= ]] || continue
  key="${line%%=*}"
  val="${line#*=}"
  VALUES["$key"]="$val"
done < .env.local

OK=0; FAIL=0
for var in "${VARS[@]}"; do
  val="${VALUES[$var]:-}"
  for env in "${ENVS[@]}"; do
    # Remove valor anterior (se houver) para evitar duplicata
    npx vercel env rm "$var" "$env" --yes >/dev/null 2>&1 || true
    if [ -z "$val" ]; then
      # Pula vars vazias (Resend/n8n ficam sem)
      echo "⏭  $var / $env (vazio, pulando)"
      continue
    fi
    if printf "%s" "$val" | npx vercel env add "$var" "$env" >/dev/null 2>&1; then
      echo "✅ $var / $env"
      OK=$((OK+1))
    else
      echo "❌ $var / $env"
      FAIL=$((FAIL+1))
    fi
  done
done

echo ""
echo "OK: $OK | FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && echo "✅ Pronto. Rode: npx vercel --prod"
