-- Notificacao do PIX: no lugar do "Agendamento confirmado" logo ao gerar o
-- PIX (o pagamento ainda nem foi conferido), o cliente recebe "Horario
-- reservado: aguardando a confirmacao do PIX"; quando o Admin confirma o PIX,
-- recebe "Pagamento confirmado". So acrescenta valores ao enum: nenhuma linha
-- e alterada, nada de RLS a suspender.
ALTER TYPE "TipoNotificacao" ADD VALUE 'RESERVA_PIX';
ALTER TYPE "TipoNotificacao" ADD VALUE 'PAGAMENTO_CONFIRMADO';
