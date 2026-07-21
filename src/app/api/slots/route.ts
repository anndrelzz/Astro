import { NextResponse } from "next/server";
import { calcularSlotsDisponiveis } from "@/lib/slots";
import { prisma } from "@/lib/prisma";

// RF02, RNF02 — consulta de slots disponiveis (meta: < 300ms).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const servicoId = searchParams.get("servicoId");
  const data = searchParams.get("data"); // formato YYYY-MM-DD

  if (!tenantId || !servicoId || !data) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, tenantId },
  });
  if (!tenant || !servico) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataConsulta = new Date(ano, mes - 1, dia);

  const slots = await calcularSlotsDisponiveis(tenant, servico, dataConsulta);

  return NextResponse.json({ slots });
}
