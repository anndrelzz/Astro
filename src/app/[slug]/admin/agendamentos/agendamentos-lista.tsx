"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import type { StatusAgendamento } from "@/generated/prisma/enums";

// RF11, UC10 — tabela de agendamentos do painel (mockup do admin).
//
// Abas, busca e paginacao rodam aqui, sobre o conjunto que o servidor ja
// enviou: respondem instantaneamente e nao geram consulta a cada tecla. O
// periodo, esse sim, e filtrado no servidor — e ele que limita o volume.

export type Periodo = "hoje" | "7dias" | "mes" | "todos";

export type ItemAgendamento = {
  id: string;
  dataHoraISO: string;
  duracaoMin: number;
  clienteNome: string;
  clienteTelefone: string;
  veiculo: string;
  placa: string;
  servicoNome: string;
  valor: number;
  status: StatusAgendamento;
};

const POR_PAGINA = 10;

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7dias", rotulo: "7 dias" },
  { valor: "mes", rotulo: "Este mes" },
  { valor: "todos", rotulo: "Todos" },
];

// "Concluido" nao ganha aba: nenhuma rota do sistema atribui esse status, entao
// a aba mostraria zero para sempre. O status continua no banco porque o
// historico do cliente o utiliza (UC05).
const ABAS: { chave: "todos" | StatusAgendamento; rotulo: string }[] = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "CONFIRMADO", rotulo: "Confirmados" },
  { chave: "PIX_PENDENTE", rotulo: "PIX pendente" },
  { chave: "PENDENTE_PAGAMENTO", rotulo: "Pagamento no local" },
  { chave: "CANCELADO", rotulo: "Cancelados" },
];

const ESTILO_STATUS: Record<
  StatusAgendamento,
  { rotulo: string; classe: string; ponto: string }
> = {
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
    rotulo: "Pagamento no local",
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

// Cor do avatar derivada do nome: a mesma pessoa recebe sempre a mesma cor,
// o que ajuda a reconhecer clientes recorrentes ao correr os olhos pela lista.
const CORES_AVATAR = [
  "bg-blue-500/25 text-blue-200",
  "bg-emerald-500/25 text-emerald-200",
  "bg-violet-500/25 text-violet-200",
  "bg-amber-500/25 text-amber-200",
  "bg-rose-500/25 text-rose-200",
  "bg-teal-500/25 text-teal-200",
];

function corDoNome(nome: string) {
  let soma = 0;
  for (const c of nome) soma += c.charCodeAt(0);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatarReal(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}` : `${h}h 00`;
}

function formatarTelefone(t: string) {
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

export function AgendamentosLista({
  slug,
  itens,
  periodo,
}: {
  slug: string;
  itens: ItemAgendamento[];
  periodo: Periodo;
}) {
  const router = useRouter();
  const campoBusca = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<"todos" | StatusAgendamento>("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const contagens = useMemo(() => {
    const m = new Map<string, number>();
    m.set("todos", itens.length);
    for (const i of itens) m.set(i.status, (m.get(i.status) ?? 0) + 1);
    return m;
  }, [itens]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (aba !== "todos" && i.status !== aba) return false;
      if (!termo) return true;
      return (
        i.clienteNome.toLowerCase().includes(termo) ||
        i.placa.toLowerCase().includes(termo) ||
        i.servicoNome.toLowerCase().includes(termo) ||
        i.veiculo.toLowerCase().includes(termo)
      );
    });
  }, [itens, aba, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  function trocarAba(chave: "todos" | StatusAgendamento) {
    setAba(chave);
    setPagina(1);
    setExpandido(null);
  }

  function trocarPeriodo(valor: Periodo) {
    router.push(`/${slug}/admin/agendamentos?periodo=${valor}`);
  }

  async function agir(id: string, acao: "confirmar-pagamento" | "cancelar") {
    setProcessando(id);
    setErro(null);

    const resposta = await fetch(`/api/agendamentos/${id}/${acao}`, {
      method: "POST",
    });

    setProcessando(null);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel completar a acao.");
      return;
    }
    setExpandido(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Busca + periodo */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-lg border border-admin-border bg-admin-surface px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-astro-muted" />
          <input
            ref={campoBusca}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar cliente, placa, servico..."
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-astro-muted"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-admin-border bg-admin-surface p-1">
          <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-astro-muted" />
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              onClick={() => trocarPeriodo(p.valor)}
              className={
                periodo === p.valor
                  ? "rounded-md bg-astro-blue/35 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-astro-blue-bright/50"
                  : "rounded-md px-3 py-1.5 text-xs text-astro-muted transition hover:text-white"
              }
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Abas por status */}
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => {
          const ativa = aba === a.chave;
          const n = contagens.get(a.chave) ?? 0;
          return (
            <button
              key={a.chave}
              onClick={() => trocarAba(a.chave)}
              className={
                ativa
                  ? "flex items-center gap-2 rounded-lg border border-astro-blue-bright/50 bg-astro-blue/20 px-4 py-2 text-sm font-semibold text-white"
                  : "flex items-center gap-2 rounded-lg border border-admin-border px-4 py-2 text-sm text-astro-muted transition hover:text-white"
              }
            >
              {a.rotulo}
              <span
                className={
                  ativa
                    ? "rounded bg-white/20 px-1.5 py-0.5 font-mono text-[0.65rem]"
                    : "rounded bg-admin-surface-2 px-1.5 py-0.5 font-mono text-[0.65rem]"
                }
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-admin-border">
                {["Horario", "Cliente", "Veiculo", "Servico", "Valor", "Status", ""].map(
                  (c, i) => (
                    <th
                      key={c || i}
                      className={`astro-label px-4 py-3 ${i === 4 ? "text-right" : "text-left"}`}
                    >
                      {c}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((item) => {
                const d = new Date(item.dataHoraISO);
                const estilo = ESTILO_STATUS[item.status];
                const aberto = expandido === item.id;
                const podeConfirmar =
                  item.status === "PIX_PENDENTE" ||
                  item.status === "PENDENTE_PAGAMENTO";
                const podeCancelar =
                  item.status !== "CANCELADO" && item.status !== "CONCLUIDO";

                return (
                  <tr
                    key={item.id}
                    className="border-b border-admin-border/60 last:border-0"
                  >
                    <td colSpan={7} className="p-0">
                      <div className="flex w-full items-center gap-4 px-4 py-3.5 transition hover:bg-white/[0.03]">
                        {/* Horario */}
                        <div className="w-20 shrink-0">
                          <p className="font-mono font-bold text-white">
                            {d.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="font-mono text-[0.65rem] text-astro-muted">
                            {formatarDuracao(item.duracaoMin)}
                          </p>
                        </div>

                        {/* Cliente */}
                        <div className="flex w-56 shrink-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${corDoNome(item.clienteNome)}`}
                          >
                            {iniciais(item.clienteNome)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {item.clienteNome}
                            </p>
                            <p className="truncate font-mono text-[0.65rem] text-astro-muted">
                              {formatarTelefone(item.clienteTelefone) || "sem telefone"}
                            </p>
                          </div>
                        </div>

                        {/* Veiculo */}
                        <div className="hidden w-48 shrink-0 md:block">
                          <p className="truncate text-slate-200">{item.veiculo}</p>
                          <p className="font-mono text-[0.65rem] text-astro-muted">
                            {item.placa}
                          </p>
                        </div>

                        {/* Servico */}
                        <p className="hidden min-w-0 flex-1 truncate text-slate-200 lg:block">
                          {item.servicoNome}
                        </p>

                        {/* Valor */}
                        <p className="ml-auto shrink-0 font-bold text-white lg:ml-0">
                          {formatarReal(item.valor)}
                        </p>

                        {/* Status */}
                        <span
                          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider sm:inline-flex ${estilo.classe}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${estilo.ponto}`} />
                          {estilo.rotulo}
                        </span>

                        {/* Abrir acoes */}
                        <button
                          onClick={() => setExpandido(aberto ? null : item.id)}
                          aria-expanded={aberto}
                          aria-label={aberto ? "Fechar acoes" : "Abrir acoes"}
                          className="shrink-0 rounded-md p-1 text-astro-muted transition hover:bg-white/5 hover:text-white"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition ${aberto ? "rotate-180" : "-rotate-90"}`}
                          />
                        </button>
                      </div>

                      {/* Acoes da linha */}
                      {aberto && (
                        <div className="flex flex-wrap items-center gap-3 border-t border-admin-border bg-admin-bg px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider sm:hidden ${estilo.classe}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${estilo.ponto}`} />
                            {estilo.rotulo}
                          </span>

                          <p className="text-xs text-astro-muted md:hidden">
                            {item.veiculo} · {item.placa} · {item.servicoNome}
                          </p>

                          <div className="ml-auto flex flex-wrap gap-2">
                            {podeConfirmar && (
                              <button
                                onClick={() => agir(item.id, "confirmar-pagamento")}
                                disabled={processando === item.id}
                                className="flex items-center gap-2 rounded-lg bg-astro-blue px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                {processando === item.id
                                  ? "Confirmando..."
                                  : item.status === "PIX_PENDENTE"
                                    ? "Confirmar PIX"
                                    : "Confirmar pagamento"}
                              </button>
                            )}
                            {podeCancelar && (
                              <button
                                onClick={() => agir(item.id, "cancelar")}
                                disabled={processando === item.id}
                                className="flex items-center gap-2 rounded-lg border border-red-500/40 px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Cancelar
                              </button>
                            )}
                            {!podeConfirmar && !podeCancelar && (
                              <span className="text-xs text-astro-muted">
                                Nenhuma acao disponivel para este status.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visiveis.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-white">
              Nenhum agendamento encontrado.
            </p>
            <p className="mt-1 text-sm text-astro-muted">
              {busca
                ? "Tente outro termo de busca."
                : "Ajuste o filtro de periodo ou a aba de status."}
            </p>
          </div>
        )}
      </div>

      {/* Rodape */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-astro-muted">
          Mostrando {visiveis.length} de {filtrados.length} agendamento
          {filtrados.length === 1 ? "" : "s"}
        </p>

        {totalPaginas > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              aria-label="Pagina anterior"
              className="rounded-md border border-admin-border p-2 text-astro-muted transition hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPagina(n)}
                aria-current={n === paginaAtual ? "page" : undefined}
                className={
                  n === paginaAtual
                    ? "h-9 w-9 rounded-md bg-astro-blue text-sm font-semibold text-white"
                    : "h-9 w-9 rounded-md border border-admin-border text-sm text-astro-muted transition hover:text-white"
                }
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              aria-label="Proxima pagina"
              className="rounded-md border border-admin-border p-2 text-astro-muted transition hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
