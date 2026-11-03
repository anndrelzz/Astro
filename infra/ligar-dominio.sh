#!/usr/bin/env bash
# Liga o dominio proprio ao App Service, com HTTPS gratuito.
#
# Roda depois do criar-azure.sh, quando o DNS publico ja mostra os dois
# registros que o criar-azure.sh imprime no fim:
#   A    (vazio) -> IP de entrada do site
#   TXT  asuid   -> customDomainVerificationId do site (prova que o dominio e nosso)
#
# Conferir antes (os dois precisam responder):
#   nslookup useastro.app.br 8.8.8.8
#   nslookup -type=TXT asuid.useastro.app.br 8.8.8.8
#
# No Registro.br, o modo avancado do DNS leva cerca de 2 horas na primeira vez:
# a zona passa para a.sec.dns.br e b.sec.dns.br, e so depois o .br aponta
# para eles.
set -euo pipefail

GRUPO="astro-rg"
SITE="useastro"
DOMINIO="${DOMINIO:-useastro.app.br}"

# A Azure le o TXT asuid; sem ele, recusa ligar o dominio.
az webapp config hostname add --resource-group "$GRUPO" --webapp-name "$SITE" --hostname "$DOMINIO" -o none

# Certificado gerenciado: gratis e renovado pela propria Azure. Leva alguns
# minutos para ser emitido.
THUMBPRINT=$(az webapp config ssl create --resource-group "$GRUPO" --name "$SITE" --hostname "$DOMINIO" \
  --query properties.thumbprint -o tsv)
az webapp config ssl bind --resource-group "$GRUPO" --name "$SITE" \
  --certificate-thumbprint "$THUMBPRINT" --ssl-type SNI -o none

# O login (NextAuth) monta os enderecos de retorno a partir daqui. A troca de
# configuracao reinicia o site, mas o restart explicito garante que o valor
# novo ja vale quando o script termina.
az webapp config appsettings set --resource-group "$GRUPO" --name "$SITE" \
  --settings "NEXTAUTH_URL=https://$DOMINIO" -o none
az webapp restart --resource-group "$GRUPO" --name "$SITE"

az webapp config hostname list --resource-group "$GRUPO" --webapp-name "$SITE" \
  --query "[].{dominio:name, ssl:sslState}" -o table
echo "Pronto: https://$DOMINIO"
