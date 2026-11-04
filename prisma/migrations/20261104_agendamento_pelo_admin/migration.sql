-- Agendamento feito pelo Admin pelo cliente "coringa" (decisao do orientador,
-- 30/10). So acrescenta colunas, sem mexer em dados: nao precisa suspender o
-- FORCE do RLS.

-- Cliente interno de cada estetica, pelo qual o Admin agenda.
ALTER TABLE "usuario" ADD COLUMN "coringa" BOOLEAN NOT NULL DEFAULT false;

-- Nome e telefone de quem chamou, nos agendamentos feitos pelo Admin.
ALTER TABLE "agendamento" ADD COLUMN "contatoNome" TEXT;
ALTER TABLE "agendamento" ADD COLUMN "contatoTelefone" TEXT;
