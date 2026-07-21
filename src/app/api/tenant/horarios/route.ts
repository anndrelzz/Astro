import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { horariosSchema } from "@/lib/validations/tenant";

function paraMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// UC09, RF02 — Admin define dias/horarios de funcionamento. Dia com
// ativo=false remove o registro (estetica fechada nesse dia da semana).
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = horariosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const tenantId = session.user.tenantId;

  await prisma.$transaction(
    parsed.data.map((dia) =>
      dia.ativo
        ? prisma.horarioFuncionamento.upsert({
            where: { tenantId_diaSemana: { tenantId, diaSemana: dia.diaSemana } },
            update: {
              horaInicioMin: paraMinutos(dia.horaInicio),
              horaFimMin: paraMinutos(dia.horaFim),
            },
            create: {
              tenantId,
              diaSemana: dia.diaSemana,
              horaInicioMin: paraMinutos(dia.horaInicio),
              horaFimMin: paraMinutos(dia.horaFim),
            },
          })
        : prisma.horarioFuncionamento.deleteMany({
            where: { tenantId, diaSemana: dia.diaSemana },
          })
    )
  );

  return NextResponse.json({ ok: true });
}
