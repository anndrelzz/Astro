import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConfiguracoesAdmin } from "./configuracoes-admin";
import { AdminNav } from "../admin-nav";

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

// UC13, UC14, UC09, RF17, RF18, RF02 — configuracoes gerais da estetica.
export default async function AdminConfiguracoesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { horarios: true },
  });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  const horariosPorDia = NOMES_DIAS.map((nome, diaSemana) => {
    const existente = tenant.horarios.find((h) => h.diaSemana === diaSemana);
    return {
      diaSemana,
      nome,
      ativo: !!existente,
      horaInicio: existente ? paraHora(existente.horaInicioMin) : "08:00",
      horaFim: existente ? paraHora(existente.horaFimMin) : "18:00",
    };
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <AdminNav slug={slug} />
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Configuracoes
      </h1>
      <ConfiguracoesAdmin
        configInicial={{
          pixChaveCopiaCola: tenant.pixChaveCopiaCola ?? "",
          cancelamentoHorasLimite: tenant.cancelamentoHorasLimite,
          capacidadeSimultanea: tenant.capacidadeSimultanea,
          intervaloMinutos: tenant.intervaloMinutos,
          corPrimaria: tenant.corPrimaria ?? "#0f172a",
        }}
        horariosIniciais={horariosPorDia}
        logoUrlInicial={tenant.logoUrl}
      />
    </div>
  );
}
