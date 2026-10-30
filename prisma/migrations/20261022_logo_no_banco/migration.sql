-- Logo da estetica passa a morar no banco (UC12, RF13).
--
-- Ate aqui o arquivo ia para public/uploads/logos, no disco do servidor. No
-- Azure App Service esse disco e recriado a cada deploy/restart (o logo sumia)
-- e na Vercel ele e somente leitura (o upload falhava). Guardando os bytes no
-- banco, o logo acompanha o banco para qualquer hospedagem.
--
-- Sem RLS, assim como "tenant": o logo e exibido na tela de login, antes de
-- existir sessao, para qualquer visitante — e dado publico da estetica, do
-- mesmo diretorio que nome e slug. Por isso tambem nao ha FORCE para suspender
-- como na 20260929_segmentos_editaveis.
--
-- Logos que ja existiam em public/uploads continuam funcionando no ambiente
-- onde o arquivo ainda esta no disco; o proximo envio ja grava aqui.

CREATE TABLE "logo_tenant" (
  "tenantId"     TEXT         NOT NULL,
  "dados"        BYTEA        NOT NULL,
  "tipo"         TEXT         NOT NULL,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "logo_tenant_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "logo_tenant" ADD CONSTRAINT "logo_tenant_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
