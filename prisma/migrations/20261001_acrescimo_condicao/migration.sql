-- Acrescimo por condicao do veiculo (pedido da EstimaCar, 01/10/2026).
--
-- A estetica cobra ate X% a mais quando o carro chega em condicao muito ruim
-- (30% no caso da EstimaCar). O valor do agendamento continua sendo o calculado
-- pelo segmento — a RN01 nao muda. O que o sistema passa a fazer e AVISAR o
-- cliente antes da confirmacao, com o teto em reais, e deixar explicito que a
-- diferenca e paga no local mesmo quando o pagamento foi por PIX.
--
-- Nulo = a estetica nao tem essa politica e nenhum aviso e exibido, mesmo
-- padrao da RN10 com pixChaveCopiaCola.
--
-- "tenant" nao tem RLS (e o diretorio publico consultado por slug antes de
-- existir sessao), entao esta migration nao precisa suspender FORCE como a
-- 20260929_segmentos_editaveis precisou.

ALTER TABLE "tenant" ADD COLUMN "acrescimoCondicaoPercent" INTEGER;
