import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Car, Clock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { authOptions } from "@/back/auth";
import { FUSO, chaveDia, fimDoDia, horaMinuto, inicioDoDia, instanteNoFuso, minutosNoFuso, partesNoFuso } from "@/compartilhado/fuso";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { AgendaHoje } from "@/front/admin/agenda-hoje";
import { CartaoFaturamento, type Periodo, type ResumoPeriodo } from "@/front/admin/cartao-faturamento";
import { EsperandoVoce } from "@/front/admin/esperando-voce";

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

  // Dia, mes e hora do relogio da estetica (compartilhado/fuso.ts), nao do servidor.
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

    // "Esperando voce": PIX de hoje em diante que o dono ainda nao confirmou.
    const esperando = await tx.agendamento.findMany({
      where: { tenantId: tenant.id, status: "PIX_PENDENTE", dataHora: { gte: inicioDoDia(agora) } },
      include: { usuario: true, veiculo: true, servico: true },
      orderBy: { dataHora: "asc" },
      take: 5,
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
      esperando,
      horarioHoje,
    };
  });

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

  const eventos = dados.agenda.map((a) => {
    const inicioMin = minutosNoFuso(a.dataHora);
    return {
      id: a.id,
      inicioMin,
      fimMin: inicioMin + a.servico.duracaoMin,
      cliente: a.usuario.nome,
      detalhe: `${a.servico.nome} · ${a.veiculo.modelo}`,
      status: a.status,
    };
  });
  const expediente = dados.horarioHoje
    ? `${tenant.capacidadeSimultanea} carro${tenant.capacidadeSimultanea === 1 ? "" : "s"} por vez · ${minParaHora(dados.horarioHoje.horaInicioMin)} às ${minParaHora(dados.horarioHoje.horaFimMin)}`
    : "fechado hoje";

  const hojeChave = chaveDia(agora);
  const amanhaChave = chaveDia(inicioDoDia(agora, 1));
  const esperando = dados.esperando.map((a) => {
    const dia = chaveDia(a.dataHora);
    return {
      id: a.id,
      hora: horaMinuto(a.dataHora),
      dia:
        dia === hojeChave
          ? "hoje"
          : dia === amanhaChave
            ? "amanhã"
            : a.dataHora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO }),
      cliente: a.usuario.nome,
      detalhe: `${a.servico.nome} · ${a.veiculo.modelo} · ${a.veiculo.placa} · ${formatarReal(Number(a.valor))}`,
    };
  });

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

      {/* Esquerda: faturamento, indicadores e PIX para confirmar.
          Direita: a agenda de hoje em linha do tempo. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5">
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

          <EsperandoVoce itens={esperando} />
        </div>

        <AgendaHoje
          eventos={eventos}
          abreMin={dados.horarioHoje?.horaInicioMin ?? null}
          fechaMin={dados.horarioHoje?.horaFimMin ?? null}
          agoraMin={relogio.hora * 60 + relogio.minuto}
          expediente={expediente}
        />
      </div>
    </>
  );
}

// 540 -> "09:00"
function minParaHora(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
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
