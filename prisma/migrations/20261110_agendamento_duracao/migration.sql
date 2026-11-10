-- Duracao guardada no agendamento, como o valor: mudar a duracao de um
-- servico no Catalogo vale so para os proximos agendamentos.
--
-- 1. A coluna nasce vazia.
ALTER TABLE "agendamento" ADD COLUMN "duracaoMin" INTEGER;

-- 2. Os agendamentos ja feitos recebem a duracao atual do servico, que era a
--    usada ate aqui (nada muda para eles).
--
-- "agendamento" e "servico" tem FORCE ROW LEVEL SECURITY e a migration roda
-- como o role astro, sem BYPASSRLS: sem app.tenant_id, o UPDATE alcancaria
-- ZERO linhas em silencio (ver 20260929_segmentos_editaveis). Como dono das
-- tabelas, o astro suspende o FORCE so durante o UPDATE e restaura logo
-- depois.
ALTER TABLE "agendamento" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "servico" NO FORCE ROW LEVEL SECURITY;

UPDATE "agendamento" AS a
SET "duracaoMin" = s."duracaoMin"
FROM "servico" AS s
WHERE s."id" = a."servicoId" AND a."duracaoMin" IS NULL;

ALTER TABLE "servico" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agendamento" FORCE ROW LEVEL SECURITY;

-- 3. Obrigatoria daqui em diante. Se o UPDATE tivesse alcancado menos linhas
--    do que devia, este passo falha com "contem valores nulos" e a migration
--    inteira e desfeita.
ALTER TABLE "agendamento" ALTER COLUMN "duracaoMin" SET NOT NULL;
