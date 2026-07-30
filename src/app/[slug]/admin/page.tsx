import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  Droplets,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import type { StatusAgendamento } from "@/generated/prisma/enums";

// RF11, UC10 — Dashboard do painel (tela inicial do mockup do admin).
//
// Os indicadores saem dos dados que ja existem. O mockup mostra tambem nota de
// avaliacao e endereco da estetica: nenhum dos dois existe no modelo de dados,
// entao nao entram como numero inventado.

const STATUS_PAGO = ["CONFIRMADO", "CONCLUIDO"] as const;

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

function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fimDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

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

  const agora = new Date();
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);

  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);

  const dados = await withTenant(tenant.id, async (tx) => {
    const naoCancelado = { not: "CANCELADO" } as const;

    const [hoje, ontemQtd, mes, mesPassado] = await Promise.all([
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
          dataHora: { gte: inicioDoDia(ontem), lte: fimDoDia(ontem) },
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

    // RF12 — receita conta apenas pagamento confirmado.
    const [receitaDia, receitaMes] = await Promise.all([
      tx.agendamento.aggregate({
        _sum: { valor: true },
        where: {
          tenantId: tenant.id,
          status: { in: [...STATUS_PAGO] },
          dataHora: { gte: inicioDoDia(agora), lte: fimDoDia(agora) },
        },
      }),
      tx.agendamento.aggregate({
        _sum: { valor: true },
        where: {
          tenantId: tenant.id,
          status: { in: [...STATUS_PAGO] },
          dataHora: { gte: inicioMes, lte: fimDoDia(agora) },
        },
      }),
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
        tenantId_diaSemana: { tenantId: tenant.id, diaSemana: agora.getDay() },
      },
    });

    return {
      hoje,
      ontem: ontemQtd,
      mes,
      mesPassado,
      receitaDia: Number(receitaDia._sum.valor ?? 0),
      receitaMes: Number(receitaMes._sum.valor ?? 0),
      agenda,
      horarioHoje,
    };
  });

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
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

  const iniciais = tenant.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const dataExtenso = agora
    .toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "")
    .toUpperCase();

  return (
    <>
      {/* Capa + identidade da estetica */}
      <section className="overflow-hidden rounded-2xl border border-admin-border">
        <div className="relative flex h-36 items-center justify-center bg-[radial-gradient(120%_140%_at_50%_-20%,#3b82f6_0%,#1d4ed8_35%,#0b1120_100%)] lg:h-48">
          {/* Listras diagonais sutis, como na capa do mockup */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 22px)",
            }}
          />
          {/* A capa carrega a marca da PLATAFORMA, como no wireframe. A
              identidade da estetica (avatar, nome, slug) fica no card abaixo. */}
          <Image
            src="/logo-astro-branco.png"
            alt="Astro"
            width={712}
            height={219}
            priority
            className="relative h-auto w-56 drop-shadow-lg lg:w-72"
          />
        </div>

        {/* Card sobreposto */}
        <div className="relative -mt-8 mx-4 mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-admin-border bg-admin-surface px-5 py-4 shadow-xl shadow-black/40 lg:mx-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-astro-blue text-xl font-bold text-white shadow-lg shadow-astro-blue/30">
            {iniciais}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-white lg:text-2xl">{tenant.nome}</h2>
              <span
                className={
                  aberto
                    ? "flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-emerald-300"
                    : "flex items-center gap-1.5 rounded-full bg-admin-surface-2 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted"
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${aberto ? "bg-emerald-400" : "bg-astro-muted"}`}
                />
                {aberto ? "Aberto" : "Fechado"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-astro-muted">
              astro.app/{tenant.slug}
            </p>
          </div>

          <Link
            href={`/${slug}`}
            className="shrink-0 rounded-lg border border-admin-border px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-astro-blue hover:text-white"
          >
            Ver site publico
          </Link>
        </div>
      </section>

      {/* Cabecalho da secao */}
      <div className="mb-5 mt-7">
        <p className="astro-label">Visao geral · {dataExtenso}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Dashboard
        </h1>
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Agendamentos hoje"
          valor={String(dados.hoje)}
          variacao={comparar(dados.hoje, dados.ontem, "vs ontem")}
          icone={<CalendarDays className="h-4 w-4" />}
          corIcone="bg-astro-blue/15 text-astro-blue-bright"
        />
        <Indicador
          rotulo="Agendamentos · mes"
          valor={String(dados.mes)}
          variacao={comparar(dados.mes, dados.mesPassado, "vs mes passado")}
          icone={<CalendarCheck className="h-4 w-4" />}
          corIcone="bg-violet-500/15 text-violet-300"
        />
        <Indicador
          rotulo="Receita do dia"
          valor={formatarReal(dados.receitaDia)}
          icone={<Wallet className="h-4 w-4" />}
          corIcone="bg-emerald-500/15 text-emerald-300"
        />
        <Indicador
          rotulo="Receita · mes"
          valor={formatarReal(dados.receitaMes)}
          icone={<TrendingUp className="h-4 w-4" />}
          corIcone="bg-amber-500/15 text-amber-300"
        />
      </div>

      {/* Agenda do dia */}
      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="astro-label">Agenda · hoje</p>
            <h2 className="mt-1 text-lg font-semibold text-white lg:text-xl">
              Agendamentos de hoje
            </h2>
          </div>
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
                  <p className="font-bold text-white">{formatarReal(Number(a.valor))}</p>
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
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarReal(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Devolve a variacao so quando ha base de comparacao — sem periodo anterior,
// "+100%" seria enganoso.
function comparar(atual: number, anterior: number, sufixo: string) {
  if (anterior === 0) return null;
  const delta = atual - anterior;
  const pct = Math.round((delta / anterior) * 100);
  const sinal = delta >= 0 ? "+" : "";
  return `${sinal}${pct}% ${sufixo}`;
}

function Indicador({
  rotulo,
  valor,
  variacao,
  icone,
  corIcone,
}: {
  rotulo: string;
  valor: string;
  variacao?: string | null;
  icone: React.ReactNode;
  corIcone: string;
}) {
  const positiva = variacao?.startsWith("+");

  return (
    <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="astro-label">{rotulo}</p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${corIcone}`}
        >
          {icone}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white lg:text-4xl">
        {valor}
      </p>
      {variacao && (
        <span
          className={
            positiva
              ? "mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[0.65rem] text-emerald-300"
              : "mt-3 inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 font-mono text-[0.65rem] text-red-300"
          }
        >
          <TrendingUp
            className={`h-3 w-3 ${positiva ? "" : "rotate-180"}`}
          />
          {variacao}
        </span>
      )}
    </div>
  );
}
