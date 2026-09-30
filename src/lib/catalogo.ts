import type { Prisma } from "@/generated/prisma/client";

// Decisao de 29/09: todo servico tem preco para TODO segmento ativo do tenant.
// Como a lista de segmentos e da propria estetica, segmento cadastrado e
// segmento que ela atende — nao existe combinacao legitimamente sem preco.
//
// Confere aqui, e nao no schema Zod, porque a resposta depende do banco: quais
// sao os segmentos ativos deste tenant agora.
export async function validarPrecosCompletos(
  tx: Prisma.TransactionClient,
  tenantId: string,
  precos: { segmentoId: string; valor: number }[]
) {
  const ativos = await tx.segmento.findMany({
    where: { tenantId, ativo: true },
    select: { id: true, nome: true },
  });

  const informados = new Set(precos.map((p) => p.segmentoId));

  const faltando = ativos.filter((s) => !informados.has(s.id));
  if (faltando.length > 0) {
    return `Informe o preco para: ${faltando.map((s) => s.nome).join(", ")}`;
  }

  // Id que nao pertence ao tenant, ou de segmento aposentado: o RLS ja barra o
  // primeiro na escrita, mas a mensagem daqui e mais util que um erro de FK.
  const idsAtivos = new Set(ativos.map((s) => s.id));
  if (precos.some((p) => !idsAtivos.has(p.segmentoId))) {
    return "Ha preco para um tipo de veiculo que nao existe ou foi removido";
  }

  return null;
}
