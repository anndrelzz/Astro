-- "Ja fiz o pagamento" (tela do PIX): a hora em que o cliente avisou que
-- pagou, para o painel do Admin mostrar. So acrescenta uma coluna vazia:
-- nenhuma linha e alterada, nada de RLS a suspender.
ALTER TABLE "agendamento" ADD COLUMN "pagamentoInformadoEm" TIMESTAMP(3);
