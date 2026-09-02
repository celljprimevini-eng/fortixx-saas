#!/usr/bin/env node
/**
 * Remove toda a carga de teste criada por seed-demo-load.mjs (os 100
 * auth.users fake + tudo marcado com [LG] no tenant demo). Deixa o tenant
 * demo como estava antes (só os usuários reais + as 8 hr_faqs).
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/clean-demo-load.mjs
 */

import { sql, q, TENANT } from './_lib.mjs';

const LG = '[LG]';
const EMAIL_DOMAIN = 'loadgen.fortixx.local';
const JUNK_TENANT = '__LGX_TENANT__';

const cleanup = `
delete from auth.users where email like '%@${EMAIL_DOMAIN}';
delete from tenants where name=${q(JUNK_TENANT)};
delete from hr_messages where tenant_id=${q(TENANT)} and conversation_id in (select id from hr_conversations where subject like ${q(LG + '%')});
delete from hr_conversations where tenant_id=${q(TENANT)} and subject like ${q(LG + '%')};
delete from audit_logs where tenant_id=${q(TENANT)} and action like 'LG:%';
delete from notifications where tenant_id=${q(TENANT)} and title like ${q(LG + '%')};
delete from interviews where tenant_id=${q(TENANT)};
delete from candidates where tenant_id=${q(TENANT)} and full_name like ${q(LG + '%')};
delete from job_openings where tenant_id=${q(TENANT)} and title like ${q(LG + '%')};
delete from training_progress where tenant_id=${q(TENANT)};
delete from trainings where tenant_id=${q(TENANT)} and title like ${q(LG + '%')};
delete from onboarding_tasks where onboarding_id in (select id from onboardings where tenant_id=${q(TENANT)});
delete from onboardings where tenant_id=${q(TENANT)};
delete from schedules where tenant_id=${q(TENANT)};
delete from documents where tenant_id=${q(TENANT)} and file_name like ${q(LG + '%')};
`;

process.stdout.write('→ limpando carga de teste do tenant demo ... ');
await sql(cleanup);
console.log('ok');
console.log('✅ Carga de teste removida. Tenant demo voltou ao estado anterior.');
