import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { FUSO, chaveDia, fimDoDia, inicioDoDia, instanteNoFuso, minutosNoFuso, partesNoFuso } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { AgendamentosLista, type DiaSemana, type ItemAgendamento } from "./agendamentos-lista";

// RF11, UC10 — agenda do painel administrativo, em linha do tempo.
//
// O servidor carrega UMA SEMANA (segunda a domingo) que contem o dia pedido em
// ?dia=AAAA-MM-DD (padrao: hoje, no relogio da estetica). Trocar de dia dentro
// da semana, filtrar por situacao e buscar rodam no cliente, sem ida ao
// servidor; trocar de semana e uma nova navegacao.

const SIGLAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function lerDia(bruto: string | undefined, agora: Date) {
  const m = bruto?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return inicioDoDia(agora);
  const d = instanteNoFuso(Number(m[1]), Number(m[2]), Number(m[3]));
  // Data impossivel (31/02) vira outro dia no Date; nesse caso, volta para hoje.
  return chaveDia(d) === bruto ? d : inicioDoDia(agora);
}

export default async function AdminAgendamentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { slug } = await params;
  const { dia: diaBruto } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  const agora = new Date();
  const diaEscolhido = lerDia(diaBruto, agora);
  // Segunda-feira da semana do dia escolhido (diaSemana: 0 = domingo).
  const recuo = (partesNoFuso(diaEscolhido).diaSemana + 6) % 7;
  const segunda = inicioDoDia(diaEscolhido, -recuo);

  const { agendamentos, horarios } = await withTenant(tenant.id, async (tx) => {
    const [agendamentos, horarios] = await Promise.all([
      tx.agendamento.findMany({
        where: {
          tenantId: tenant.id,
          dataHora: { gte: segunda, lte: fimDoDia(segunda, 6) },
        },
        include: { usuario: true, veiculo: true, servico: true },
        orderBy: { dataHora: "asc" },
      }),
      tx.horarioFuncionamento.findMany({ where: { tenantId: tenant.id } }),
    ]);
    return { agendamentos, horarios };
  });

  const dias: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const d = inicioDoDia(segunda, i);
    const p = partesNoFuso(d);
    const grade = horarios.find((h) => h.diaSemana === p.diaSemana);
    return {
      chave: chaveDia(d),
      sigla: SIGLAS[p.diaSemana],
      numero: p.dia,
      nome: d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO }),
      abreMin: grade?.horaInicioMin ?? null,
      fechaMin: grade?.horaFimMin ?? null,
    };
  });

  const itens: ItemAgendamento[] = agendamentos.map((a) => {
    const inicioMin = minutosNoFuso(a.dataHora);
    return {
      id: a.id,
      dia: chaveDia(a.dataHora),
      inicioMin,
      fimMin: inicioMin + a.servico.duracaoMin,
      fimISO: new Date(a.dataHora.getTime() + a.servico.duracaoMin * 60000).toISOString(),
      duracaoMin: a.servico.duracaoMin,
      clienteNome: a.usuario.nome,
      clienteTelefone: a.usuario.telefone ?? "",
      clienteEmail: a.usuario.email,
      veiculo: `${a.veiculo.marca} ${a.veiculo.modelo}`,
      veiculoAno: a.veiculo.ano,
      placa: a.veiculo.placa,
      servicoNome: a.servico.nome,
      valor: Number(a.valor),
      acrescimoAplicado: a.acrescimoAplicado === null ? null : Number(a.acrescimoAplicado),
      status: a.status,
    };
  });

  return (
    <AgendamentosLista
      slug={slug}
      dias={dias}
      diaInicial={chaveDia(diaEscolhido)}
      semanaAnterior={chaveDia(inicioDoDia(segunda, -7))}
      proximaSemana={chaveDia(inicioDoDia(segunda, 7))}
      hoje={chaveDia(agora)}
      agoraISO={agora.toISOString()}
      agoraMin={minutosNoFuso(agora)}
      capacidade={tenant.capacidadeSimultanea}
      itens={itens}
      acrescimoCondicaoPercent={tenant.acrescimoCondicaoPercent}
    />
  );
}
