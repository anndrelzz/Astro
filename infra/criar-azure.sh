#!/usr/bin/env bash
# Cria a infraestrutura do Astro na Azure com a Azure CLI.
#
# Foi assim que o ambiente de producao foi montado em 03/11/2026. O script
# deixa o passo a passo versionado e permite recriar tudo do zero (por
# exemplo, numa assinatura nova). Roda em Linux, macOS ou Git Bash.
#
# Antes de rodar:
#   1. az login (contas da Catolica exigem MFA para criar recursos; se a CLI
#      pedir, rode o "az login --tenant ... --claims-challenge ..." que ela
#      sugerir no erro);
#   2. psql e openssl instalados;
#   3. conferir as variaveis abaixo. Os nomes do banco e do site viram
#      enderecos publicos e precisam ser unicos no mundo.
#
# Os segredos (senhas, NEXTAUTH_SECRET, CRON_SECRET...) sao gerados aqui e
# gravados so em .env.azure, que o .gitignore deixa fora do Git.
#
# Por que Chile Central: a assinatura Azure for Students so permite
# chilecentral, mexicocentral, spaincentral, francecentral e italynorth
# (politica "Allowed resource deployment regions"). Brazil South nao esta
# disponivel; o Chile e a regiao permitida mais perto do Brasil.
set -euo pipefail

GRUPO="astro-rg"
REGIAO="chilecentral"
BANCO="useastro-db"
PLANO="astro-plano"
SITE="useastro"
IDENTIDADE="astro-deploy"
REPO="anndrelzz/Astro"
EMAIL_ALERTAS="andre.estevao@catolicasc.edu.br"
ARQ_ENV=".env.azure"

if [ -e "$ARQ_ENV" ]; then
  echo "$ARQ_ENV ja existe: o script nao sobrescreve segredos. Apague-o antes de recriar tudo." >&2
  exit 1
fi

gera() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
SENHA_ADMIN=$(gera 32)
SENHA_APP=$(gera 32)
NEXTAUTH_SECRET=$(gera 48)
CRON_SECRET=$(gera 40)
TELEGRAM_WEBHOOK_SECRET=$(gera 40)
HOST_BANCO="$BANCO.postgres.database.azure.com"
URL_APP="postgresql://astro:$SENHA_APP@$HOST_BANCO:5432/astro?sslmode=verify-full"

cat > "$ARQ_ENV" <<EOF
# Azure (nao vai para o Git).
AZURE_PG_HOST="$HOST_BANCO"
AZURE_PG_ADMIN_USER="astroadmin"
AZURE_PG_ADMIN_PASSWORD="$SENHA_ADMIN"
AZURE_PG_APP_PASSWORD="$SENHA_APP"
DATABASE_URL_OWNER="postgresql://astroadmin:$SENHA_ADMIN@$HOST_BANCO:5432/postgres?sslmode=verify-full"
DATABASE_URL="$URL_APP"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
CRON_SECRET="$CRON_SECRET"
TELEGRAM_WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET"
EOF
echo "Segredos gravados em $ARQ_ENV"

# --- Provedores e grupo ---------------------------------------------------
az provider register -n Microsoft.DBforPostgreSQL --wait
az provider register -n Microsoft.Web --wait
az group create --name "$GRUPO" --location "$REGIAO" --tags projeto=astro -o none

# --- Orcamento: US$ 100 (o credito da Azure for Students), com e-mail em 30%,
# 60% e 90% do gasto real. Nao corta nada: so avisa.
SUB=$(az account show --query id -o tsv)
aviso() { echo "{\"enabled\":true,\"operator\":\"GreaterThan\",\"threshold\":$1,\"thresholdType\":\"Actual\",\"contactEmails\":[\"$EMAIL_ALERTAS\"]}"; }
az rest --method put \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Consumption/budgets/astro-orcamento?api-version=2023-05-01" \
  --body "{\"properties\":{\"category\":\"Cost\",\"amount\":100,\"timeGrain\":\"Annually\",\"timePeriod\":{\"startDate\":\"2026-11-01T00:00:00Z\",\"endDate\":\"2027-10-31T00:00:00Z\"},\"notifications\":{\"gasto30\":$(aviso 30),\"gasto60\":$(aviso 60),\"gasto90\":$(aviso 90)}}}" \
  -o none

# --- PostgreSQL Flexible: o menor tamanho (B1ms), versao 18 como no CI.
# --public-access libera so o IP de quem roda o script (para criar o role e
# rodar as migrations); a regra 0.0.0.0 libera so os servicos da Azure.
MEU_IP=$(curl -fsS https://api.ipify.org)
az postgres flexible-server create \
  --resource-group "$GRUPO" --name "$BANCO" --location "$REGIAO" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 18 \
  --admin-user astroadmin --admin-password "$SENHA_ADMIN" \
  --public-access "$MEU_IP" --backup-retention 7 --geo-redundant-backup Disabled \
  --tags projeto=astro --yes -o none
az postgres flexible-server firewall-rule create \
  --resource-group "$GRUPO" --server-name "$BANCO" --name PermitirServicosAzure \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none

# Role da aplicacao, como no CI: dono das tabelas (roda as migrations), mas
# sem superuser e sem BYPASSRLS, para o RLS valer de verdade. Na Azure o
# schema public nasce com dono azure_pg_admin; sem passar para o astro, o
# prisma migrate deploy falha com "permission denied for schema public".
PGPASSWORD="$SENHA_ADMIN" psql "host=$HOST_BANCO dbname=postgres user=astroadmin sslmode=require" -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE astro LOGIN PASSWORD '$SENHA_APP' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;" \
  -c "GRANT astro TO astroadmin WITH SET TRUE, INHERIT FALSE;" \
  -c "CREATE DATABASE astro OWNER astro;"
PGPASSWORD="$SENHA_ADMIN" psql "host=$HOST_BANCO dbname=astro user=astroadmin sslmode=require" -v ON_ERROR_STOP=1 \
  -c "ALTER SCHEMA public OWNER TO astro;"

DATABASE_URL="$URL_APP" npx prisma migrate deploy

# --- App Service: B1 Linux (o menor que aceita dominio proprio com HTTPS).
az appservice plan create --resource-group "$GRUPO" --name "$PLANO" --location "$REGIAO" \
  --sku B1 --is-linux --tags projeto=astro -o none
az webapp create --resource-group "$GRUPO" --plan "$PLANO" --name "$SITE" \
  --runtime "NODE:24-lts" --tags projeto=astro -o none
az webapp update --resource-group "$GRUPO" --name "$SITE" --https-only true -o none
# Sem FTP (o deploy e so pelo GitHub Actions) e com Always On, para o site
# nao dormir entre um acesso e outro.
az webapp config set --resource-group "$GRUPO" --name "$SITE" \
  --always-on true --min-tls-version 1.2 --ftps-state Disabled --http20-enabled true \
  --startup-file "node server.js" -o none
az webapp config appsettings set --resource-group "$GRUPO" --name "$SITE" -o none --settings \
  "DATABASE_URL=$URL_APP" \
  "NEXTAUTH_URL=https://$SITE.azurewebsites.net" \
  "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" \
  "CRON_SECRET=$CRON_SECRET" \
  "TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET" \
  "TELEGRAM_BOT_USERNAME=AstroBot" \
  "HOSTNAME=0.0.0.0" \
  "SCM_DO_BUILD_DURING_DEPLOYMENT=false"

# --- Identidade do deploy (CD): login por OIDC, sem senha guardada no
# GitHub. So tem permissao no grupo e so aceita este repositorio no
# ambiente "producao".
az identity create --resource-group "$GRUPO" --name "$IDENTIDADE" --location "$REGIAO" --tags projeto=astro -o none
PRINCIPAL=$(az identity show -g "$GRUPO" -n "$IDENTIDADE" --query principalId -o tsv)
sleep 20 # a identidade leva alguns segundos para aparecer no Entra ID
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$(az group show -n "$GRUPO" --query id -o tsv)" -o none
az identity federated-credential create --resource-group "$GRUPO" --identity-name "$IDENTIDADE" \
  --name github-producao --issuer "https://token.actions.githubusercontent.com" \
  --subject "repo:$REPO:environment:producao" --audiences "api://AzureADTokenExchange" -o none

# --- GitHub: ambiente "producao" com os segredos que o deploy.yml usa.
gh api --method PUT "repos/$REPO/environments/producao" --silent
gh secret set AZURE_CLIENT_ID --env producao --repo "$REPO" --body "$(az identity show -g "$GRUPO" -n "$IDENTIDADE" --query clientId -o tsv)"
gh secret set AZURE_TENANT_ID --env producao --repo "$REPO" --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --env producao --repo "$REPO" --body "$SUB"
gh secret set DATABASE_URL --env producao --repo "$REPO" --body "$URL_APP"

echo
echo "Pronto. Proximos passos:"
echo "  - merge na main (ou Actions > Deploy > Run workflow) para o primeiro deploy;"
echo "  - dominio proprio: ver infra/README.md."
