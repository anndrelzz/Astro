-- Review do #103: o link de uma conta apagada nao serve para nada. Com
-- RESTRICT, apagar um usuario que tivesse link aberto falhava; com CASCADE,
-- os links saem junto com a conta.
ALTER TABLE "token_email" DROP CONSTRAINT "token_email_usuarioId_fkey";
ALTER TABLE "token_email" ADD CONSTRAINT "token_email_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
