# 🟢 ESTA É A PASTA OFICIAL DO SITE FORTIXX

**Caminho:** `C:\Users\VINÃO TV\Downloads\PROJETO FORTIXX\principal\`

Não existe mais nenhuma outra pasta do Fortixx no disco. Só esta. Se algum dia
aparecer outra (`fortixx-saas`, `fortixx-saas_1`, `fortixx-saas correto`,
`_backup_preserve`, ou qualquer nome parecido) — **é lixo/duplicata antiga, não
mexe nela**, essa aqui é a única com valor.

## Por que essa nota existe

Em 30/08/2026 essa pasta foi apagada sem querer durante uma limpeza de disco (o C:\
tinha ficado quase cheio). Não teve perda real — o código estava todo salvo no
GitHub — mas deu trabalho reclonar e religar tudo. Essa nota é pra isso nunca mais
virar confusão.

## Fonte de verdade real

Não é essa pasta em si — é o **GitHub**:

```
https://github.com/celljprimevini-eng/fortixx-saas
branch: main
```

Se essa pasta sumir de novo (crash, limpeza de disco, o que for), o código **não se
perde**: é só reclonar.

```powershell
cd "C:\Users\VINÃO TV\Downloads\PROJETO FORTIXX"
git clone https://github.com/celljprimevini-eng/fortixx-saas.git principal
```

O que **não** vem no clone (não fica no Git, por segurança): o arquivo `.env.local`
com as chaves do Supabase/Stripe/Resend. Esses valores reais só existem no painel da
Vercel (Project Settings → Environment Variables) — a maioria está marcada como
"Sensitive" e só quem tem acesso ao painel consegue ver/copiar de novo.

## Site em produção

`https://fortixx-saas.vercel.app` — roda direto do GitHub via Vercel, **não depende
desta pasta local nenhuma**. Se essa pasta sumir, o site continua no ar normalmente.

## Histórico completo

Ver vault Obsidian (`D:\JARVIS\Jarvis\10-projects\fortixx-rh\`), especialmente
`fortixx-saas-moc.md` (índice) e os logs mais recentes em `execucao/`.
