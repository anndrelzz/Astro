-- Issue #107: login sem limite de tentativas. Dois campos na propria conta:
-- quantas tentativas desde o ultimo acerto e ate quando o login fica
-- bloqueado. So acrescenta colunas (com valor padrao): nao mexe em linhas
-- existentes, entao o RLS nao interfere.
ALTER TABLE "usuario" ADD COLUMN "tentativasErradas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuario" ADD COLUMN "bloqueadoAte" TIMESTAMP(3);
