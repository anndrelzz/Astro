-- RLS multi-tenant (RNF06) — fecha a lacuna entre o RFC (isolamento
-- garantido no banco) e o estado anterior (isolamento so na aplicacao).
--
-- IMPORTANTE (verificado em dev nesta migration): o role de conexao da
-- aplicacao precisa ser NAO-superuser e sem BYPASSRLS, senao toda policy
-- abaixo e ignorada silenciosamente. Confirmado que `astro` (DATABASE_URL)
-- tem rolsuper=false e rolbypassrls=false. Antes de promover para
-- producao, reconfirme isso no role de producao com:
--   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
-- (o mesmo role tambem nao tem CREATEROLE em dev, o que descarta a
-- alternativa de um role de servico com BYPASSRLS — ver nota na policy
-- de "usuario" abaixo sobre o caso do webhook do Telegram.)

-- ============================================================
-- 1. Colunas tenantId em veiculo/notificacao (nullable -> backfill -> NOT NULL)
-- ============================================================

ALTER TABLE "veiculo" ADD COLUMN "tenantId" TEXT;
UPDATE "veiculo" SET "tenantId" = "usuario"."tenantId"
  FROM "usuario" WHERE "veiculo"."usuarioId" = "usuario"."id";
ALTER TABLE "veiculo" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "notificacao" ADD COLUMN "tenantId" TEXT;
UPDATE "notificacao" SET "tenantId" = "agendamento"."tenantId"
  FROM "agendamento" WHERE "notificacao"."agendamentoId" = "agendamento"."id";
ALTER TABLE "notificacao" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "notificacao_tenantId_idx" ON "notificacao"("tenantId");
CREATE INDEX "veiculo_tenantId_idx" ON "veiculo"("tenantId");

-- AddForeignKey
ALTER TABLE "veiculo" ADD CONSTRAINT "veiculo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 2. Row-Level Security nas tabelas sensiveis por tenant
--    (tenant fica de fora: diretorio publico consultado por slug
--    antes de existir sessao, em login/cadastro)
-- ============================================================

ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario" FORCE ROW LEVEL SECURITY;
-- O astro (DATABASE_URL) nao tem CREATEROLE, entao um role de servico
-- com BYPASSRLS nao e uma opcao aqui. Em vez disso, a policy abaixo tem
-- uma segunda condicao (USING apenas, nao afeta WITH CHECK) que permite
-- SELECT por telegramLinkToken cruzando tenants — usada exclusivamente
-- pelo webhook do Telegram (RN12/UC15) para descobrir a qual usuario/tenant
-- um token de vinculacao pertence, antes de existir contexto de tenant.
-- O token e unico globalmente e de uso unico; essa condicao nunca habilita
-- escrita fora do tenant (WITH CHECK continua exigindo tenantId igual).
CREATE POLICY tenant_isolation ON "usuario"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (
      current_setting('app.telegram_lookup_token', true) <> ''
      AND "telegramLinkToken" = current_setting('app.telegram_lookup_token', true)
    )
  )
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "veiculo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "veiculo" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "veiculo"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "servico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "servico" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "servico"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "agendamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agendamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agendamento"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "horario_funcionamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "horario_funcionamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "horario_funcionamento"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "notificacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notificacao" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notificacao"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
