import { NextResponse } from "next/server";
import { prisma } from "@/back/prisma";
import { normalizarEndereco, problemaNoEndereco } from "@/compartilhado/endereco-estetica";

// Tela /start — enquanto o dono digita o endereco do site, avisa se ele esta
// livre. Devolve o endereco ja normalizado, para a tela mostrar o link como
// vai ficar. Publica como a propria estetica: o endereco de um site ja e
// publico. A confirmacao de verdade e no POST /api/esteticas.
export async function GET(request: Request) {
  const endereco = normalizarEndereco(new URL(request.url).searchParams.get("valor") ?? "");

  const problema = problemaNoEndereco(endereco);
  if (problema) {
    return NextResponse.json({ endereco, disponivel: false, motivo: problema });
  }

  const emUso = await prisma.tenant.findUnique({ where: { slug: endereco }, select: { id: true } });
  if (emUso) {
    return NextResponse.json({ endereco, disponivel: false, motivo: "em-uso" });
  }
  return NextResponse.json({ endereco, disponivel: true });
}
