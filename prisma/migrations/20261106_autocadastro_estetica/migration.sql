-- Autocadastro da estetica (tela /start). Resumo da conexao que criou a
-- estetica, para limitar os cadastros por hora sem guardar o IP (LGPD).
-- A tabela tenant nao tem RLS: nada a suspender aqui.
ALTER TABLE "tenant" ADD COLUMN "cadastroIpHash" TEXT;

CREATE INDEX "tenant_cadastroIpHash_criadoEm_idx" ON "tenant"("cadastroIpHash", "criadoEm");
