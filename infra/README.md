# Infraestrutura na Azure

Ambiente de produção do Astro, criado com a Azure CLI pelo [`criar-azure.sh`](criar-azure.sh).

## O que existe

Tudo no grupo de recursos `astro-rg`, região **Chile Central**.

| Recurso | Nome | Para que serve |
|---|---|---|
| PostgreSQL Flexible Server | `useastro-db` | Banco de produção (PostgreSQL 18, Burstable B1ms, 32 GB) |
| Plano do App Service | `astro-plano` | A máquina que roda o site (B1 Linux) |
| App Service | `useastro` | O site Next.js (Node 24, `node server.js`) |
| Identidade gerenciada | `astro-deploy` | O login do GitHub Actions no deploy (OIDC) |
| Orçamento | `astro-orcamento` | Aviso por e-mail em 30%, 60% e 90% de US$ 100 |

Endereços:
- site: `https://useastro.azurewebsites.net` (e o domínio próprio `useastro.app.br`);
- banco: `useastro-db.postgres.database.azure.com` (só aceita os serviços da Azure e os IPs liberados um a um).

**Por que Chile Central:** a assinatura Azure for Students só permite `chilecentral`, `mexicocentral`, `spaincentral`, `francecentral` e `italynorth`. Brazil South não está disponível, e o Chile é a região permitida mais perto do Brasil. O site e o banco ficam na mesma região, então a consulta ao banco não cruza o continente.

## Segurança

- **RLS de verdade:** a aplicação conecta com o role `astro`, sem superuser e sem `BYPASSRLS`. As migrations ligam `FORCE ROW LEVEL SECURITY`, então as policies valem também para o dono das tabelas, como no CI.
- **Banco fechado:** não há acesso pela internet. O deploy abre o firewall só para o IP da máquina do GitHub durante as migrations e fecha no fim.
- **Sem senha da Azure no GitHub:** o deploy entra por OIDC. A identidade `astro-deploy` só tem papel de Contributor no `astro-rg` e só aceita `repo:anndrelzz/Astro:environment:producao`.
- **Site:** só HTTPS, TLS 1.2 ou maior, FTP desligado.
- **Segredos:** ficam nas configurações do App Service e no `.env.azure` local (fora do Git). O pacote do deploy nunca leva `.env`.

## Deploy (CD)

O [`deploy.yml`](../.github/workflows/deploy.yml) roda sozinho depois que o CI passa num push na `main`, ou na mão em **Actions → Deploy → Run workflow**. Em ordem:
1. build `standalone` do Next;
2. login na Azure;
3. libera o banco para a máquina do deploy;
4. `prisma migrate deploy`;
5. fecha o banco;
6. envia o pacote;
7. confere se o site respondeu.

## Custo

Preços de tabela em Chile Central (novembro de 2026):

| Recurso | Preço | Por mês |
|---|---|---|
| App Service B1 | US$ 0,0238 por hora | cerca de US$ 17 |
| PostgreSQL B1ms | US$ 0,0238 por hora | cerca de US$ 17 |
| Armazenamento do banco (32 GB) | | alguns dólares |

O deploy não muda o custo, e o GitHub Actions é gratuito em repositório público. O gasto real aparece em **Gerenciamento de Custos → Análise de custo**, com algumas horas de atraso.

## Operação

**Pausar o banco** (para economizar, por até 7 dias seguidos). Com o banco parado, o site abre mas não carrega dados, e os lembretes não saem.
- Portal: abrir `useastro-db` e clicar em **Parar** ou **Iniciar**.
- CLI:
  ```bash
  az postgres flexible-server stop --resource-group astro-rg --name useastro-db
  az postgres flexible-server start --resource-group astro-rg --name useastro-db
  ```
- Antes de mergear um PR com migration, o banco precisa estar ligado, senão o deploy falha (e basta rodar de novo).

**Acessar o banco da sua máquina:** liberar o seu IP no firewall (portal: `useastro-db` → Rede), ou:
```bash
az postgres flexible-server firewall-rule create --resource-group astro-rg --server-name useastro-db --name meu-ip --start-ip-address <IP> --end-ip-address <IP>
```

**Ver os logs do site:**
```bash
az webapp log tail --resource-group astro-rg --name useastro
```

**Apagar tudo** (depois do TCC; não tem volta):
```bash
az group delete --name astro-rg
```

## Domínio próprio

O domínio `useastro.app.br` foi registrado no Registro.br e usa o DNS do próprio Registro.br, em modo avançado. Na zona DNS:

| Tipo | Nome | Valor |
|---|---|---|
| A | *(vazio)* | IP de entrada do site (`inboundIpAddress` do App Service) |
| TXT | `asuid` | `customDomainVerificationId` do App Service: prova para a Azure que o domínio é nosso |

Depois que os dois aparecem no DNS público, o [`ligar-dominio.sh`](ligar-dominio.sh):
1. liga o domínio ao site;
2. emite o certificado gerenciado (grátis, renovado pela Azure; o atual é da GeoTrust/DigiCert e vale até 03/05/2027);
3. troca o `NEXTAUTH_URL` para `https://useastro.app.br` e reinicia o site.

O HTTP responde 301 para o HTTPS (`--https-only`).

**No Registro.br**, ligar o modo avançado do DNS leva cerca de 2 horas na primeira vez. A zona passa para `a.sec.dns.br` e `b.sec.dns.br`, e só depois o `.br` aponta para eles. Os registros já podem ser criados antes, e respondem nesses dois servidores enquanto a troca não termina.
