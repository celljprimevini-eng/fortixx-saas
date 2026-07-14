#!/usr/bin/env node
/**
 * Cria automaticamente os 3 produtos/preços da Fortixx no Stripe
 * (Básico, Pro, Enterprise) e grava os IDs gerados de volta no
 * .env.local — para você não ter que copiar/colar manualmente do
 * Dashboard do Stripe.
 *
 * Idempotente: se já existir um produto com o mesmo nome, reaproveita.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = [
  { key: 'BASICO', name: 'Fortixx Básico', price: 41930, description: 'Até 25 colaboradores' },
  { key: 'PRO', name: 'Fortixx Pro', price: 104930, description: 'Até 250 colaboradores' },
  { key: 'ENTERPRISE', name: 'Fortixx Enterprise', price: null, description: 'Sob consulta — contato comercial' },
];

async function upsertProductAndPrice(plan) {
  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find((p) => p.name === plan.name);
  if (!product) {
    product = await stripe.products.create({ name: plan.name, description: plan.description });
    console.log(`✅ Produto criado: ${plan.name}`);
  } else {
    console.log(`ℹ️  Produto já existe: ${plan.name}`);
  }

  if (!plan.price) return null; // Enterprise é sob consulta, sem preço fixo

  const prices = await stripe.prices.list({ product: product.id, limit: 100 });
  let price = prices.data.find((p) => p.unit_amount === plan.price && p.recurring?.interval === 'month');
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price,
      currency: 'brl',
      recurring: { interval: 'month' },
    });
    console.log(`✅ Preço criado: ${plan.name} — R$${(plan.price / 100).toFixed(2)}/mês`);
  } else {
    console.log(`ℹ️  Preço já existe: ${plan.name}`);
  }

  return price.id;
}

async function main() {
  console.log('Configurando produtos e preços no Stripe…\n');

  const priceIds = {};
  for (const plan of PLANS) {
    const priceId = await upsertProductAndPrice(plan);
    if (priceId) priceIds[plan.key] = priceId;
  }

  // Grava os price IDs no .env.local
  const envPath = '.env.local';
  let envContent = fs.readFileSync(envPath, 'utf-8');
  for (const [key, id] of Object.entries(priceIds)) {
    const varName = `STRIPE_PRICE_${key}`;
    if (envContent.includes(`${varName}=`)) {
      envContent = envContent.replace(new RegExp(`${varName}=.*`), `${varName}=${id}`);
    } else {
      envContent += `\n${varName}=${id}`;
    }
  }
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ IDs de preço gravados em .env.local');

  // Cria o webhook endpoint automaticamente, se APP_URL já estiver definida
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/webhook`;
    const existing = await stripe.webhookEndpoints.list();
    const already = existing.data.find((w) => w.url === webhookUrl);
    if (!already) {
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          'checkout.session.completed',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.payment_failed',
        ],
      });
      console.log(`\n✅ Webhook criado no Stripe: ${webhookUrl}`);
      console.log(`   Copie este segredo para STRIPE_WEBHOOK_SECRET no .env.local:`);
      console.log(`   ${webhook.secret}`);
    } else {
      console.log(`\nℹ️  Webhook já existe para ${webhookUrl}`);
    }
  } else {
    console.log('\n⚠️  NEXT_PUBLIC_APP_URL não definida — configure o webhook manualmente depois do deploy.');
  }
}

main().catch((err) => {
  console.error('Erro ao configurar Stripe:', err.message);
  process.exit(1);
});
