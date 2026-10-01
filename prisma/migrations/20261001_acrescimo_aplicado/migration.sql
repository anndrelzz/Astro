-- Acrescimo efetivamente cobrado na avaliacao presencial.
--
-- Complementa a 20261001_acrescimo_condicao, que so AVISAVA o cliente da
-- possibilidade. Sem esta coluna o sistema gravava sempre o valor de
-- referencia, entao uma lavacao combinada por R$ 120,00 e cobrada por
-- R$ 156,00 aparecia como R$ 120,00 no dashboard financeiro — o relatorio do
-- dono nao fechava com o caixa dele.
--
-- Fica ao lado de "valor" em vez de somar nele: valor e o que foi combinado no
-- agendamento e nao muda (RN01). Separados, o historico mostra as duas partes
-- para cliente e Admin, e o financeiro consegue isolar quanto da receita veio
-- de acrescimo.
--
-- "agendamento" tem RLS, mas esta migration so mexe em ESTRUTURA (ADD COLUMN),
-- nao em dados — entao nao precisa suspender FORCE como a
-- 20260929_segmentos_editaveis precisou. Ver o passo 0 daquela.

ALTER TABLE "agendamento" ADD COLUMN "acrescimoAplicado" DECIMAL(10,2);
