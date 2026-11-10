-- Avisos por e-mail ao dono da estetica: novo agendamento (no local ou PIX
-- aguardando confirmacao) e cancelamento feito pelo cliente. Dois tipos novos
-- de notificacao e o liga/desliga nas Configuracoes, ligado por padrao.
-- So acrescenta valores ao enum e uma coluna com padrao: nenhuma linha de
-- tabela com RLS e alterada ("tenant" nao tem RLS).
ALTER TYPE "TipoNotificacao" ADD VALUE 'AVISO_NOVO_AGENDAMENTO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'AVISO_CANCELAMENTO';

ALTER TABLE "tenant" ADD COLUMN "avisosPorEmail" BOOLEAN NOT NULL DEFAULT true;
