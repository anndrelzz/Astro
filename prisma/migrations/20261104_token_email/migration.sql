-- RFC 6.2 (esqueci minha senha) e a confirmacao do e-mail: os links enviados
-- por e-mail e o campo de e-mail confirmado. So estrutura nova, sem mexer em
-- dados: nao precisa suspender o FORCE do RLS.

ALTER TABLE "usuario" ADD COLUMN "emailConfirmadoEm" TIMESTAMP(3);

CREATE TYPE "TipoTokenEmail" AS ENUM ('REDEFINIR_SENHA', 'CONFIRMAR_EMAIL');

CREATE TABLE "token_email" (
  "id"        TEXT             NOT NULL,
  "tenantId"  TEXT             NOT NULL,
  "usuarioId" TEXT             NOT NULL,
  "tipo"      "TipoTokenEmail" NOT NULL,
  "tokenHash" TEXT             NOT NULL,
  "expiraEm"  TIMESTAMP(3)     NOT NULL,
  "usadoEm"   TIMESTAMP(3),
  "criadoEm"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "token_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "token_email_tokenHash_key" ON "token_email"("tokenHash");
CREATE INDEX "token_email_tenantId_idx" ON "token_email"("tenantId");
CREATE INDEX "token_email_usuarioId_tipo_idx" ON "token_email"("usuarioId", "tipo");

ALTER TABLE "token_email" ADD CONSTRAINT "token_email_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "token_email" ADD CONSTRAINT "token_email_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- O mesmo isolamento das outras tabelas da estetica: sem app.tenant_id, nada.
ALTER TABLE "token_email" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "token_email" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "token_email"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
