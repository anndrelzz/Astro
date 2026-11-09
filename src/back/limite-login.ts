import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { MAX_TENTATIVAS_LOGIN, MINUTOS_BLOQUEIO_LOGIN } from "@/compartilhado/limite-login";

// Limite de tentativas no login (issue #107). A contagem fica na propria
// conta (usuario.tentativasErradas e usuario.bloqueadoAte), no banco: assim
// ela sobrevive a um reinicio ou deploy do site, e o atacante nao tem como
// zera-la — o que aconteceria se ela ficasse na memoria do servidor ou num
// cookie do navegador.
//
// O fluxo do login e: reservar a tentativa -> conferir a senha -> registrar
// o resultado. Reservar ANTES de conferir e o que segura tentativas
// simultaneas: se 50 pedidos chegam juntos, cada um ganha um numero (1, 2,
// 3...) num UPDATE atomico, e so os 5 primeiros chegam a conferir a senha.

/**
 * Soma uma tentativa e devolve o numero dela, ou `null` se a conta esta
 * bloqueada. Bloqueio vencido e descartado aqui mesmo: a contagem recomeca
 * do 1.
 */
export async function reservarTentativa(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  agora: Date
): Promise<number | null> {
  // Uma unica instrucao, para dois pedidos ao mesmo tempo nunca lerem o mesmo
  // numero. A data vai como parametro (e nao now() do banco) para a
  // comparacao usar o mesmo relogio que gravou o bloqueio.
  const linhas = await tx.$queryRaw<{ tentativasErradas: number }[]>`
    UPDATE "usuario"
    SET "tentativasErradas" = CASE WHEN "bloqueadoAte" IS NULL THEN "tentativasErradas" + 1 ELSE 1 END,
        "bloqueadoAte" = NULL
    WHERE "id" = ${usuarioId}
      AND ("bloqueadoAte" IS NULL OR "bloqueadoAte" <= ${agora})
    RETURNING "tentativasErradas"
  `;
  if (linhas.length === 0) return null; // bloqueio ainda valendo
  const numero = linhas[0].tentativasErradas;
  // Passou do limite sem o bloqueio gravado ainda: pedido simultaneo que
  // chegou depois do 5o. Fica de fora sem conferir a senha.
  return numero > MAX_TENTATIVAS_LOGIN ? null : numero;
}

/** Senha certa: a contagem zera. */
export async function registrarAcerto(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.usuario.update({
    where: { id: usuarioId },
    data: { tentativasErradas: 0, bloqueadoAte: null },
  });
}

/** Senha errada na ultima tentativa permitida: bloqueia por 15 minutos. */
export async function registrarErro(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  numero: number,
  agora: Date
) {
  if (numero < MAX_TENTATIVAS_LOGIN) return;
  await tx.usuario.update({
    where: { id: usuarioId },
    data: { bloqueadoAte: new Date(agora.getTime() + MINUTOS_BLOQUEIO_LOGIN * 60 * 1000) },
  });
}
