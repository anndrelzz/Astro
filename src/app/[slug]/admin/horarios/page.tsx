import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { HorariosAdmin } from "./horarios-admin";

// Indexado por Date.getDay(): 0 = domingo ... 6 = sabado, que e como o banco
// guarda em horario_funcionamento.diaSemana.
const NOMES_DIAS = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

// A semana e EXIBIDA comecando na segunda e terminando no domingo, como no
// mockup e como a estetica pensa a propria semana de trabalho. A ordem de
// exibicao e independente do indice guardado no banco.
const ORDEM_EXIBICAO = [1, 2, 3, 4, 5, 6, 0];

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

  const horariosPorDia = ORDEM_EXIBICAO.map((diaSemana) => {
    const existente = horarios.find((h) => h.diaSemana === diaSemana);
    return {
      diaSemana,
      nome: NOMES_DIAS[diaSemana],
      ativo: !!existente,
      horaInicio: existente ? paraHora(existente.horaInicioMin) : "08:00",
      horaFim: existente ? paraHora(existente.horaFimMin) : "18:00",
    };
  });

  // O cabecalho e renderizado DENTRO do componente cliente porque o botao
  // "Salvar grade" mora na barra do topo (como no mockup) e depende do estado
  // do formulario. O AdminHeader tem a area de acao justamente para isso.
  return (
    <HorariosAdmin
      horariosIniciais={horariosPorDia}
      capacidadeSimultanea={tenant.capacidadeSimultanea}
      linkConfiguracoes={`/${slug}/admin/configuracoes`}
    />
  );
}
