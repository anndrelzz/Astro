-- Uma notificacao por canal, e a data em que ela foi registrada.
--
-- Antes, cada aviso era uma linha so, com o status decidido pelo e-mail: se o
-- Telegram falhasse, nada registrava. Com o canal na linha, e-mail e Telegram
-- tem status e tentativas proprios, e o reenvio tenta de novo so o canal que
-- falhou, sem mandar o e-mail duas vezes.
--
-- criadoEm e o que permite achar o aviso que ficou PENDENTE porque o servidor
-- caiu entre o commit e o envio: pendente ha mais de alguns minutos nao esta
-- mais "a caminho", esta esquecido.
--
-- Linhas antigas viram EMAIL (o unico canal que tinha status de verdade) e
-- ganham criadoEm = agora. "notificacao" tem RLS, mas esta migration so mexe
-- em ESTRUTURA (o DEFAULT preenche as linhas existentes), entao nao precisa
-- suspender o FORCE. Ver o passo 0 da 20260929_segmentos_editaveis.

CREATE TYPE "CanalNotificacao" AS ENUM ('EMAIL', 'TELEGRAM');

ALTER TABLE "notificacao"
  ADD COLUMN "canal" "CanalNotificacao" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
