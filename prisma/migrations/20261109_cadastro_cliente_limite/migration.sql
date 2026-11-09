-- Cadastro de cliente com limite por conexao (OWASP A04): resumo (HMAC) da
-- conexao que criou a conta, para contar os cadastros da ultima hora. O IP
-- nao e guardado (LGPD). So acrescenta uma coluna vazia e um indice: nenhuma
-- linha e alterada, nada de RLS a suspender.
ALTER TABLE "usuario" ADD COLUMN "cadastroIpHash" TEXT;

CREATE INDEX "usuario_tenantId_cadastroIpHash_criadoEm_idx" ON "usuario"("tenantId", "cadastroIpHash", "criadoEm");
