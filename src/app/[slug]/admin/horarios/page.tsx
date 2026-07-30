import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { AdminHeader } from "../admin-header";
import { HorariosAdmin } from "./horarios-admin";

const NOMES_DIAS = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

function paraHora(minutos: number) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// UC09, RF02 — tela propria para a grade semanal, como no mockup do admin.
// Antes esta secao vivia dentro de /configuracoes.
export default async function AdminHorariosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  const horarios = await withTenant(tenant.id, (tx) =>
    tx.horarioFuncionamento.findMany({ where: { tenantId: tenant.id } })
  );

  const horariosPorDia = NOMES_DIAS.map((nome, diaSemana) => {
    const existente = horarios.find((h) => h.diaSemana === diaSemana);
    return {
      diaSemana,
      nome,
      ativo: !!existente,
      horaInicio: existente ? paraHora(existente.horaInicioMin) : "08:00",
      horaFim: existente ? paraHora(existente.horaFimMin) : "18:00",
    };
  });

  return (
    <>
      <AdminHeader trilha="Operacao · Semana padrao" titulo="Grade de horarios" />
      <HorariosAdmin
        horariosIniciais={horariosPorDia}
        capacidadeSimultanea={tenant.capacidadeSimultanea}
        linkConfiguracoes={`/${slug}/admin/configuracoes`}
      />
    </>
  );
}
