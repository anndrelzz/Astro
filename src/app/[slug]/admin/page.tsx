import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Car, Clock, Droplets, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { FUSO, fimDoDia, inicioDoDia, instanteNoFuso, partesNoFuso } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import type { StatusAgendamento } from "@/generated/prisma/enums";
import { CartaoFaturamento, type Periodo, type ResumoPeriodo } from "./cartao-faturamento";

// RF11, UC10 — Dashboard do painel (tela inicial do mockup do admin).
//
// A identidade da estetica (logo, nome, aberto/fechado, site publico) mora na
// barra lateral (admin-sidebar.tsx); por isso esta tela nao tem capa.
//
// Os indicadores saem dos dados que ja existem. O mockup mostra tambem nota de
// avaliacao e endereco da estetica: nenhum dos dois existe no modelo de dados,
// entao nao entram como numero inventado.

const STATUS_PAGO = ["CONFIRMADO", "CONCLUIDO"] as const;
// O que ainda nao entrou no caixa: PIX esperando confirmacao e pagamento no
// local (cobrado na hora do servico).
const STATUS_A_RECEBER = ["PIX_PENDENTE", "PENDENTE_PAGAMENTO"] as const;

// Cada status ganha cor propria, como no mockup - status e a informacao que o
// admin le mais rapido na tela.
const ESTILO_STATUS: Record<StatusAgendamento, { rotulo: string; classe: string; ponto: string }> = {
  CONFIRMADO: {
    rotulo: "Confirmado",
    classe: "bg-emerald-500/15 text-emerald-300",
    ponto: "bg-emerald-400",
  },
  PIX_PENDENTE: {
    rotulo: "PIX pendente",
    classe: "bg-amber-500/15 text-amber-300",
    ponto: "bg-amber-400",
  },
  PENDENTE_PAGAMENTO: {
    rotulo: "Aguardando pagamento",
    classe: "bg-sky-500/15 text-sky-300",
    ponto: "bg-sky-400",
  },
  CONCLUIDO: {
    rotulo: "Concluido",
    classe: "bg-admin-surface-2 text-astro-muted",
    ponto: "bg-astro-muted",
  },
  CANCELADO: {
    rotulo: "Cancelado",
    classe: "bg-red-500/15 text-red-300",
    ponto: "bg-red-400",
  },
};

export default async function AdminDashboardPage({
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

  // Dia, mes e hora do relogio da estetica (lib/fuso.ts), nao do servidor.
  const agora = new Date();
  const relogio = partesNoFuso(agora);

  const inicioMes = instanteNoFuso(relogio.ano, relogio.mes, 1);
  // "7 dias" = hoje e os 6 dias anteriores.
  const inicioSemana = inicioDoDia(agora, -6);
  const inicioMesPassado = instanteNoFuso(relogio.ano, relogio.mes - 1, 1);
  const fimMesPassado = new Date(inicioMes.getTime() - 1);

  const dados = await withTenant(tenant.id, async (tx) => {
    const naoCancelado = { not: "CANCELADO" } as const;

    const [hoje, mes, mesPassado] = await Promise.all([
      tx.agendamento.count({
        where: {
          tenantId: tenant.id,
          status: naoCancelado,
          dataHora: { gte: inicioDoDia(agora), lte: fimDoDia(agora) },
        },
      }),
      tx.agendamento.count({
        where: {
          tenantId: tenant.id,
          status: naoCancelado,
          dataHora: { gte: inicioMes, lte: fimDoDia(agora) },
        },
      }),
      tx.agendamento.count({
        where: {
          tenantId: tenant.id,
          status: naoCancelado,
          dataHora: { gte: inicioMesPassado, lte: fimMesPassado },
        },
      }),
    ]);

    // RF12 — receita conta apenas pagamento confirmado. Soma tambem o acrescimo
    // lancado na avaliacao presencial, como o financeiro: e o que entrou no caixa.
    // Para o cartao de faturamento, cada periodo (hoje, 7 dias, mes) tem o
    // recebido, o que falta receber e quantos atendimentos teve.
    const fimHoje = fimDoDia(agora);
    const resumo = async (inicio: Date) => {
      const periodo = { gte: inicio, lte: fimHoje };
      const [pago, pendente, qtd, qtdPago] = await Promise.all([
        tx.agendamento.aggregate({
          _sum: { valor: true, acrescimoAplicado: true },
          where: { tenantId: tenant.id, status: { in: [...STATUS_PAGO] }, dataHora: periodo },
        }),
        tx.agendamento.aggregate({
          _sum: { valor: true },
          where: { tenantId: tenant.id, status: { in: [...STATUS_A_RECEBER] }, dataHora: periodo },
        }),
        tx.agendamento.count({
          where: { tenantId: tenant.id, status: naoCancelado, dataHora: periodo },
        }),
        tx.agendamento.count({
          where: { tenantId: tenant.id, status: { in: [...STATUS_PAGO] }, dataHora: periodo },
        }),
      ]);
      return {
        recebido: Number(pago._sum.valor ?? 0) + Number(pago._sum.acrescimoAplicado ?? 0),
        aReceber: Number(pendente._sum.valor ?? 0),
        atendimentos: qtd,
        pagos: qtdPago,
      };
    };
    const [resumoHoje, resumoSemana, resumoMes, pixPendentes] = await Promise.all([
      resumo(inicioDoDia(agora)),
      resumo(inicioSemana),
      resumo(inicioMes),
      tx.agendamento.count({ where: { tenantId: tenant.id, status: "PIX_PENDENTE" } }),
    ]);

    const agenda = await tx.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        status: naoCancelado,
        dataHora: { gte: inicioDoDia(agora), lte: fimDoDia(agora) },
      },
      include: { usuario: true, veiculo: true, servico: true },
      orderBy: { dataHora: "asc" },
    });

    // "Aberto agora" e "horarios livres" saem da grade de funcionamento (RF02).
    const horarioHoje = await tx.horarioFuncionamento.findUnique({
      where: {
        tenantId_diaSemana: { tenantId: tenant.id, diaSemana: relogio.diaSemana },
      },
    });

    return {
      hoje,
      mes,
      mesPassado,
      resumoHoje,
      resumoSemana,
      resumoMes,
      pixPendentes,
      agenda,
      horarioHoje,
    };
  });

  const minutosAgora = relogio.hora * 60 + relogio.minuto;
  const aberto =
    !!dados.horarioHoje &&
    minutosAgora >= dados.horarioHoje.horaInicioMin &&
    minutosAgora < dados.horarioHoje.horaFimMin;

  // Vagas do dia = quantos horarios a grade oferece x capacidade simultanea.
  const vagasDoDia = dados.horarioHoje
    ? Math.max(
        0,
        Math.floor(
          (dados.horarioHoje.horaFimMin - dados.horarioHoje.horaInicioMin) /
            tenant.intervaloMinutos
        )
      ) * tenant.capacidadeSimultanea
    : 0;
  const vagasLivres = Math.max(0, vagasDoDia - dados.hoje);

  // Saudacao pelo horario da estetica e so o primeiro nome ("Rafael (Admin)"
  // vira "Rafael").
  const saudacao = relogio.hora < 12 ? "Bom dia" : relogio.hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (session.user.name ?? "").split(" ")[0] || "Admin";
  const dataHoje = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: FUSO,
  });
  const nomeMes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", timeZone: FUSO });

  const periodos: Record<Periodo, ResumoPeriodo> = {
    hoje: { rotulo: "Faturamento de hoje", ...dados.resumoHoje },
    semana: { rotulo: "Faturamento dos últimos 7 dias", ...dados.resumoSemana },
    mes: { rotulo: `Faturamento de ${nomeMes(agora)}`, ...dados.resumoMes },
  };

  // Ticket medio do mes: quanto entrou, dividido pelos atendimentos pagos.
  const ticketMedio = dados.resumoMes.pagos > 0 ? dados.resumoMes.recebido / dados.resumoMes.pagos : 0;

  // "23 a mais que setembro": so com mes passado para comparar.
  const deltaMes = dados.mes - dados.mesPassado;
  const comparacaoMes =
    dados.mesPassado > 0
      ? `${Math.abs(deltaMes)} a ${deltaMes >= 0 ? "mais" : "menos"} que ${nomeMes(inicioMesPassado)}`
      : null;

  return (
    <>
      {/* Saudacao */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {saudacao}, {primeiroNome}
          </h1>
          <p className="mt-1 text-astro-muted">
            {dados.hoje} carro{dados.hoje === 1 ? "" : "s"} hoje
            {dados.pixPendentes > 0 &&
              `, ${dados.pixPendentes} PIX esperando sua confirmação`}
            .
          </p>
        </div>
        <span className="rounded-full border border-admin-border bg-admin-surface px-3.5 py-2 font-mono text-xs text-astro-muted">
          {dataHoje}
        </span>
      </div>

      {/* Faturamento + indicadores */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <CartaoFaturamento periodos={periodos} />

        <div className="grid grid-cols-2 gap-3">
          <Mini rotulo="Carros hoje" valor={String(dados.hoje)} icone={<Car className="h-4 w-4" />} />
          <Mini
            rotulo="Vagas livres hoje"
            valor={dados.horarioHoje ? String(vagasLivres) : "Fechado"}
            icone={<Clock className="h-4 w-4" />}
          />
          <Mini
            rotulo="Agendamentos no mês"
            valor={String(dados.mes)}
            icone={<CalendarDays className="h-4 w-4" />}
            nota={comparacaoMes}
            notaPositiva={deltaMes >= 0}
          />
          <Mini rotulo="Ticket médio" valor={formatarReal(ticketMedio)} icone={<Wallet className="h-4 w-4" />} />
        </div>
      </div>

      {/* Agenda do dia */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-white lg:text-xl">
            Agendamentos de hoje
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-astro-blue/15 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-astro-blue-bright">
              <span className="h-1.5 w-1.5 rounded-full bg-astro-blue-bright" />
              {dados.hoje} agendado{dados.hoje === 1 ? "" : "s"}
            </span>
            <span className="rounded-full bg-admin-surface-2 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted">
              {aberto || vagasDoDia > 0
                ? `${vagasLivres} vaga${vagasLivres === 1 ? "" : "s"} livre${vagasLivres === 1 ? "" : "s"}`
                : "fechado hoje"}
            </span>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {dados.agenda.map((a) => {
            const estilo = ESTILO_STATUS[a.status];
            const fim = new Date(a.dataHora.getTime() + a.servico.duracaoMin * 60000);

            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-admin-border bg-admin-surface px-4 py-3.5 transition hover:border-astro-blue/40"
              >
                <div className="w-20 shrink-0">
                  <p className="font-mono text-lg font-bold text-astro-blue-bright">
                    {formatarHora(a.dataHora)}
                  </p>
                  <p className="font-mono text-[0.65rem] text-astro-muted">
                    ate {formatarHora(fim)}
                  </p>
                </div>

                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin-surface-2 text-astro-blue-bright">
                  <Droplets className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{a.usuario.nome}</p>
                  <p className="truncate text-xs text-astro-muted">
                    {a.servico.nome} · {a.veiculo.marca} {a.veiculo.modelo} ·{" "}
                    <span className="font-mono">{a.veiculo.placa}</span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-bold text-white">
                    {formatarReal(Number(a.valor))}
                    {a.acrescimoAplicado !== null && (
                      <span className="ml-1 font-normal text-amber-300">
                        + {formatarReal(Number(a.acrescimoAplicado))}
                      </span>
                    )}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider ${estilo.classe}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${estilo.ponto}`} />
                    {estilo.rotulo}
                  </span>
                </div>
              </li>
            );
          })}

          {dados.agenda.length === 0 && (
            <li className="rounded-xl border border-dashed border-admin-border p-10 text-center">
              <p className="text-sm font-semibold text-white">
                Nenhum agendamento para hoje.
              </p>
              <p className="mt-1 text-sm text-astro-muted">
                {dados.horarioHoje
                  ? "A agenda esta livre — os horarios continuam abertos para os clientes."
                  : "A estetica esta fechada hoje pela grade de horarios."}
              </p>
            </li>
          )}
        </ul>
      </section>
    </>
  );
}

function formatarHora(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

function formatarReal(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Mini indicador do Dashboard: rotulo pequeno com icone e um numero.
function Mini({
  rotulo,
  valor,
  icone,
  nota,
  notaPositiva,
}: {
  rotulo: string;
  valor: string;
  icone: React.ReactNode;
  nota?: string | null;
  notaPositiva?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-admin-border bg-admin-surface px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-xs text-astro-muted">
        <span className="text-astro-blue-bright">{icone}</span>
        {rotulo}
      </p>
      <p className="truncate text-2xl font-bold tracking-tight text-white tabular-nums">{valor}</p>
      {nota && (
        <p
          className={`flex items-center gap-1 text-[0.7rem] font-semibold ${
            notaPositiva ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {notaPositiva ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {nota}
        </p>
      )}
    </div>
  );
}
