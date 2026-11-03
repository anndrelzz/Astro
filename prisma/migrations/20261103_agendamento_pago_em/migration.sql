-- Data em que o pagamento foi confirmado (RF12, regime de caixa).
--
-- O financeiro passa a somar a receita pelo dia em que o dinheiro entrou, e
-- nao pelo dia do servico: um PIX confirmado hoje para um servico do dia 13
-- aparecia so no dia 13, e o painel nao batia com o extrato do banco.

ALTER TABLE "agendamento" ADD COLUMN "pagoEm" TIMESTAMP(3);

-- Os ja pagos nao tem a data real da confirmacao: recebem o dia do servico,
-- que era o criterio usado ate aqui. Assim os numeros antigos nao mudam.
--
-- "agendamento" tem FORCE ROW LEVEL SECURITY e a migration roda como o role
-- astro, sem BYPASSRLS: sem app.tenant_id, o UPDATE alcancaria ZERO linhas em
-- silencio (ver 20260929_segmentos_editaveis). Como dono da tabela, o astro
-- pode suspender o FORCE so durante o UPDATE e restaurar logo depois.
ALTER TABLE "agendamento" NO FORCE ROW LEVEL SECURITY;

UPDATE "agendamento"
SET "pagoEm" = "dataHora"
WHERE "status" IN ('CONFIRMADO', 'CONCLUIDO') AND "pagoEm" IS NULL;

ALTER TABLE "agendamento" FORCE ROW LEVEL SECURITY;
