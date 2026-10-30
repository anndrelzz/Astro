"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Car, Check, ChevronLeft, ChevronRight, MessageCircle, MoreHorizontal, Search, TrendingUp } from "lucide-react";
import type { StatusAgendamento } from "@/generated/prisma/enums";
import { Modal } from "@/front/admin/modal";

// RF11, UC10 — agenda do painel em linha do tempo.
//
// Cada dia vira uma lista vertical: um agendamento embaixo do outro, na ordem
// em que a estetica atende, com os espacos livres entre eles. O cartao poe o
// SERVICO em destaque (e o que o dono prepara), com o cliente embaixo.
//
// Troca de dia (dentro da semana), filtro por situacao e busca rodam aqui,
// sobre a semana que o servidor ja enviou. Trocar de semana navega
// (?dia=AAAA-MM-DD).
//
// As acoes sao as mesmas de antes: confirmar o pagamento, confirmar com
// acrescimo (RN — politica de acrescimo da estetica) e cancelar.

export type DiaSemana = {
  chave: string;
  sigla: string;
  numero: number;
  nome: string;
  /** null = a estetica nao abre neste dia da semana */
  abreMin: number | null;
  fechaMin: number | null;
};

export type ItemAgendamento = {
  id: string;
  /** "AAAA-MM-DD" no fuso da estetica */
  dia: string;
  /** minutos desde a meia-noite, no fuso da estetica */
  inicioMin: number;
  fimMin: number;
  fimISO: string;
  duracaoMin: number;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  veiculo: string;
  veiculoAno: number;
  placa: string;
  servicoNome: string;
  valor: number;
  // Acrescimo lancado pelo Admin na avaliacao presencial. Nulo = sem acrescimo.
  acrescimoAplicado: number | null;
  status: StatusAgendamento;
};

type Filtro = "todos" | StatusAgendamento;

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "CONFIRMADO", rotulo: "Confirmados" },
  { chave: "PIX_PENDENTE", rotulo: "PIX pendente" },
  { chave: "PENDENTE_PAGAMENTO", rotulo: "No local" },
  { chave: "CONCLUIDO", rotulo: "Concluídos" },
  { chave: "CANCELADO", rotulo: "Cancelados" },
];

// Nenhuma rota do sistema atribui o status CONCLUIDO (nem automatico, nem
// botao do admin) — sem isso o filtro "Concluidos" mostraria zero para sempre.
// Mesmo truque do historico do cliente (UC05): um agendamento ativo cujo
// horario final ja passou e tratado como concluido so para exibicao/filtro,
// sem tocar o status gravado no banco. O "agora" vem do servidor, para a tela
// toda usar o mesmo relogio.
function statusEfetivo(item: ItemAgendamento, agoraMs: number): StatusAgendamento {
  if (item.status === "CANCELADO" || item.status === "CONCLUIDO") return item.status;
  return new Date(item.fimISO).getTime() < agoraMs ? "CONCLUIDO" : item.status;
}

const ESTILO: Record<StatusAgendamento, { rotulo: string; borda: string; fundo: string; selo: string }> = {
  CONFIRMADO: {
    rotulo: "Confirmado",
    borda: "border-l-emerald-400",
    fundo: "bg-[linear-gradient(90deg,rgba(52,211,153,0.10),transparent_60%)]",
    selo: "bg-emerald-400/15 text-emerald-300",
  },
  PIX_PENDENTE: {
    rotulo: "PIX pendente",
    borda: "border-l-amber-400",
    fundo: "bg-[linear-gradient(90deg,rgba(251,191,36,0.10),transparent_60%)]",
    selo: "bg-amber-400/15 text-amber-300",
  },
  PENDENTE_PAGAMENTO: {
    rotulo: "Paga no local",
    borda: "border-l-sky-300",
    fundo: "bg-[linear-gradient(90deg,rgba(125,211,252,0.10),transparent_60%)]",
    selo: "bg-sky-400/15 text-sky-300",
  },
  CONCLUIDO: {
    rotulo: "Concluído",
    borda: "border-l-emerald-400",
    fundo: "bg-[linear-gradient(90deg,rgba(52,211,153,0.10),transparent_60%)]",
    selo: "bg-emerald-400/15 text-emerald-300",
  },
  CANCELADO: {
    rotulo: "Cancelado",
    borda: "border-l-red-400",
    fundo: "opacity-70",
    selo: "bg-red-400/15 text-red-300",
  },
};

// A cor do cartao segue o horario: concluido em verde (ESTILO.CONCLUIDO),
// em andamento com a cor da situacao e a luz na borda, e o que ainda vai
// acontecer na cor da estetica. O selo continua dizendo a situacao.
const FUTURO = {
  borda: "border-l-astro-blue-bright",
  fundo: "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-astro-blue)_14%,transparent),transparent_60%)]",
};

// Menor servico que costuma caber num espaco livre; abaixo disso o espaco e
// so um intervalo.
const MENOR_SERVICO_MIN = 40;

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function formatarReal(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function formatarTelefone(t: string) {
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

// Link do WhatsApp do cliente (wa.me so aceita digitos, com o 55 do Brasil).
function linkWhatsApp(telefone: string) {
  const d = telefone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

export function AgendamentosLista({
  slug,
  dias,
  diaInicial,
  semanaAnterior,
  proximaSemana,
  hoje,
  agoraISO,
  agoraMin,
  capacidade,
  itens,
  acrescimoCondicaoPercent,
}: {
  slug: string;
  dias: DiaSemana[];
  diaInicial: string;
  semanaAnterior: string;
  proximaSemana: string;
  hoje: string;
  agoraISO: string;
  agoraMin: number;
  capacidade: number;
  itens: ItemAgendamento[];
  // Politica de acrescimo da estetica. Nulo = nao cobra acrescimo, e o botao
  // de lancar nem aparece.
  acrescimoCondicaoPercent: number | null;
}) {
  const router = useRouter();
  const agoraMs = new Date(agoraISO).getTime();

  const [diaSel, setDiaSel] = useState(diaInicial);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Agendamento com o modal de acrescimo aberto.
  const [acrescimoAlvo, setAcrescimoAlvo] = useState<ItemAgendamento | null>(null);
  // O Admin pode digitar pelo percentual OU pelo total cobrado — na correria
  // ele viu "servico de 150, cobrei 180" e nao pensou em porcentagem nenhuma.
  // Os dois campos escrevem no MESMO estado, o acrescimo em reais, e cada um
  // reexibe esse valor na sua unidade. Guardar os dois separados abriria a
  // porta para eles discordarem.
  const [acrescimoReais, setAcrescimoReais] = useState(0);
  // Qual campo esta sob o cursor: o outro e reformatado a partir do estado, e
  // este fica como o Admin digitou (senao "1" vira "1,00" no meio da digitacao).
  const [campoEditando, setCampoEditando] = useState<"percent" | "total" | null>(null);
  const [textoDigitado, setTextoDigitado] = useState("");

  const dia = dias.find((d) => d.chave === diaSel) ?? dias[0];
  const doDia = useMemo(() => itens.filter((i) => i.dia === dia.chave), [itens, dia.chave]);

  const contagens = useMemo(() => {
    const m = new Map<Filtro, number>();
    m.set("todos", doDia.filter((i) => i.status !== "CANCELADO").length);
    for (const i of doDia) {
      const s = statusEfetivo(i, agoraMs);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [doDia, agoraMs]);

  const termo = busca.trim().toLowerCase();
  const lista = doDia
    .filter((i) => {
      const s = statusEfetivo(i, agoraMs);
      // "Todos" e a agenda do dia: cancelados so aparecem no filtro proprio.
      if (filtro === "todos" ? s === "CANCELADO" : s !== filtro) return false;
      if (!termo) return true;
      return [i.clienteNome, i.placa, i.servicoNome, i.veiculo].some((c) => c.toLowerCase().includes(termo));
    })
    .sort((a, b) => a.inicioMin - b.inicioMin);
  // Os espacos livres so fazem sentido olhando o dia inteiro.
  const mostrarLivres = filtro === "todos" && !termo && dia.abreMin !== null;

  function irParaSemana(chave: string) {
    router.push(`/${slug}/admin/agendamentos?dia=${chave}`);
  }

  async function agir(id: string, acao: "confirmar-pagamento" | "cancelar", acrescimo?: number) {
    setProcessando(id);
    setErro(null);
    const resposta = await fetch(`/api/agendamentos/${id}/${acao}`, {
      method: "POST",
      headers: acrescimo ? { "Content-Type": "application/json" } : undefined,
      body: acrescimo ? JSON.stringify({ acrescimo }) : undefined,
    });
    setProcessando(null);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível completar a ação.");
      return;
    }
    setAberto(null);
    router.refresh();
  }

  // Calculo ao vivo do modal. A fonte e sempre `acrescimoReais`; percentual e
  // total sao duas leituras dele.
  const base = acrescimoAlvo?.valor ?? 0;
  const valorAcrescimo = acrescimoReais;
  const totalComAcrescimo = base + valorAcrescimo;
  const percentNumero = base > 0 ? (valorAcrescimo / base) * 100 : 0;
  const textoPercent =
    campoEditando === "percent" ? textoDigitado : valorAcrescimo > 0 ? String(Math.round(percentNumero * 100) / 100) : "";
  const textoTotal =
    campoEditando === "total" ? textoDigitado : valorAcrescimo > 0 ? totalComAcrescimo.toFixed(2) : "";

  function limparAcrescimo() {
    setAcrescimoAlvo(null);
    setAcrescimoReais(0);
    setCampoEditando(null);
    setTextoDigitado("");
  }

  // Monta a linha do tempo: cartoes e, entre eles, os espacos livres.
  const linhas: ({ tipo: "ag"; item: ItemAgendamento } | { tipo: "livre"; de: number; ate: number })[] = [];
  let cursor = dia.abreMin ?? 0;
  for (const item of lista) {
    if (mostrarLivres && item.inicioMin > cursor) linhas.push({ tipo: "livre", de: cursor, ate: item.inicioMin });
    linhas.push({ tipo: "ag", item });
    cursor = Math.max(cursor, item.fimMin);
  }
  if (mostrarLivres && dia.fechaMin !== null && cursor < dia.fechaMin) {
    linhas.push({ tipo: "livre", de: cursor, ate: dia.fechaMin });
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">Agendamentos</h1>

      {/* Filtro por situacao (do dia escolhido) */}
      <div role="group" aria-label="Situação" className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => {
          const ativo = filtro === f.chave;
          return (
            <button
              key={f.chave}
              type="button"
              aria-pressed={ativo}
              onClick={() => {
                setFiltro(f.chave);
                setAberto(null);
              }}
              className={
                ativo
                  ? "flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black"
                  : "flex items-center gap-1.5 rounded-full border border-admin-border px-3 py-1.5 text-xs font-semibold text-astro-muted transition hover:text-white"
              }
            >
              {f.rotulo}
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[0.6rem] ${ativo ? "bg-black text-white" : "bg-admin-surface-2 text-slate-200"}`}
              >
                {contagens.get(f.chave) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label="Agenda do dia" className="rounded-3xl border border-admin-border bg-admin-surface p-4 sm:p-5">
        {/* Topo: dias da semana a esquerda, busca a direita */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-4">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => irParaSemana(semanaAnterior)}
              aria-label="Semana anterior"
              className="rounded-full p-2 text-astro-muted transition hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div role="group" aria-label="Dia" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
              {dias.map((d) => {
                const qtd = itens.filter((i) => i.dia === d.chave && i.status !== "CANCELADO").length;
                const ativo = d.chave === dia.chave;
                return (
                  <button
                    key={d.chave}
                    type="button"
                    aria-pressed={ativo}
                    aria-label={`${d.nome}${d.abreMin === null ? ", fechado" : `, ${qtd} agendamento${qtd === 1 ? "" : "s"}`}`}
                    onClick={() => {
                      setDiaSel(d.chave);
                      setAberto(null);
                    }}
                    className={`flex shrink-0 items-baseline gap-1.5 rounded-full px-3 py-2 text-[0.8rem] transition ${
                      ativo ? "bg-astro-blue text-white" : "text-astro-muted hover:bg-white/5"
                    } ${d.abreMin === null ? "opacity-50" : ""}`}
                  >
                    {d.sigla}
                    <b className={`text-[0.95rem] ${ativo ? "text-white" : "text-slate-100"}`}>{d.numero}</b>
                    {qtd > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-mono text-[0.6rem] ${ativo ? "bg-white/25 text-white" : "bg-admin-surface-2"}`}
                      >
                        {qtd}
                      </span>
                    )}
                    {d.chave === hoje && !ativo && <span className="h-1.5 w-1.5 self-center rounded-full bg-astro-blue-bright" />}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => irParaSemana(proximaSemana)}
              aria-label="Próxima semana"
              className="rounded-full p-2 text-astro-muted transition hover:bg-white/5 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <label className="flex min-w-0 flex-[0_1_18rem] items-center gap-2 rounded-full border border-admin-border bg-admin-bg px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-astro-muted" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, placa ou serviço"
              aria-label="Buscar agendamento"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-astro-muted"
            />
          </label>
        </div>

        {erro && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{erro}</p>
        )}

        {/* Linha do tempo */}
        <div className="mt-3">
          {dia.abreMin === null && lista.length === 0 ? (
            <Vazio texto="A estética não abre neste dia." />
          ) : linhas.length === 0 ? (
            <Vazio
              texto={
                termo || filtro !== "todos"
                  ? "Nenhum agendamento com esse filtro neste dia."
                  : "Nenhum agendamento ainda neste dia."
              }
            />
          ) : (
            <ol>
              {linhas.map((l) =>
                l.tipo === "livre" ? (
                  <EspacoLivre
                    key={`livre-${l.de}`}
                    de={l.de}
                    ate={l.ate}
                    agoraMin={dia.chave === hoje ? agoraMin : null}
                    capacidade={capacidade}
                  />
                ) : (
                  <Cartao
                    key={l.item.id}
                    item={l.item}
                    status={statusEfetivo(l.item, agoraMs)}
                    emAndamento={
                      dia.chave === hoje &&
                      l.item.status !== "CANCELADO" &&
                      l.item.inicioMin <= agoraMin &&
                      agoraMin < l.item.fimMin
                    }
                    agoraMin={agoraMin}
                    aberto={aberto === l.item.id}
                    alternar={() => setAberto(aberto === l.item.id ? null : l.item.id)}
                    processando={processando === l.item.id}
                    confirmar={() => agir(l.item.id, "confirmar-pagamento")}
                    cancelar={() => agir(l.item.id, "cancelar")}
                    comAcrescimo={acrescimoCondicaoPercent !== null ? () => setAcrescimoAlvo(l.item) : null}
                  />
                )
              )}
            </ol>
          )}
        </div>
      </section>

      {/* Lancamento do acrescimo por condicao do veiculo.
          O Admin digita o percentual e ve o total em reais atualizar, porque e
          em reais que ele cobra — "30%" nao diz quanto entra no caixa. */}
      {acrescimoAlvo && (
        <Modal
          aberto
          onFechar={limparAcrescimo}
          titulo="Confirmar com acréscimo"
          rodape={
            <>
              <button
                type="button"
                onClick={() => {
                  agir(acrescimoAlvo.id, "confirmar-pagamento", valorAcrescimo);
                  limparAcrescimo();
                }}
                disabled={valorAcrescimo <= 0 || processando === acrescimoAlvo.id}
                className="rounded-lg bg-astro-blue px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                Confirmar {formatarReal(totalComAcrescimo)}
              </button>
              <button
                type="button"
                onClick={limparAcrescimo}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                Voltar
              </button>
            </>
          }
        >
          <p className="text-sm text-astro-muted">
            {acrescimoAlvo.clienteNome} · {acrescimoAlvo.servicoNome} · {acrescimoAlvo.veiculo}
          </p>

          {/* Dois caminhos para a mesma informacao. O da direita e o que ele
              costuma ter na cabeca: viu o servico de 150 e cobrou 180. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="astro-label" htmlFor="acrescimo-percent">
                Acréscimo
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="acrescimo-percent"
                  type="number"
                  min={0}
                  step="1"
                  value={textoPercent}
                  onFocus={() => {
                    setCampoEditando("percent");
                    setTextoDigitado(textoPercent);
                  }}
                  onChange={(e) => {
                    setTextoDigitado(e.target.value);
                    setAcrescimoReais((base * (Number(e.target.value) || 0)) / 100);
                  }}
                  onBlur={() => setCampoEditando(null)}
                  placeholder={String(acrescimoCondicaoPercent ?? 0)}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100"
                />
                <span className="text-sm text-astro-muted">%</span>
              </div>
            </div>

            <div>
              <label className="astro-label" htmlFor="acrescimo-total">
                Ou o total cobrado
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-astro-muted">R$</span>
                <input
                  id="acrescimo-total"
                  type="number"
                  min={0}
                  step="0.01"
                  value={textoTotal}
                  onFocus={() => {
                    setCampoEditando("total");
                    setTextoDigitado(textoTotal);
                  }}
                  onChange={(e) => {
                    setTextoDigitado(e.target.value);
                    // Total abaixo do combinado nao e acrescimo negativo: e o
                    // Admin ainda digitando (ex.: "1" antes de "180").
                    const total = Number(e.target.value) || 0;
                    setAcrescimoReais(Math.max(0, total - base));
                  }}
                  onBlur={() => setCampoEditando(null)}
                  placeholder={base.toFixed(2)}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-astro-muted">Combinado no agendamento</span>
              <span className="font-mono text-slate-200">{formatarReal(acrescimoAlvo.valor)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-astro-muted">Acréscimo</span>
              <span className="font-mono text-amber-300">+ {formatarReal(valorAcrescimo)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="font-semibold text-white">Total cobrado</span>
              <span className="font-mono text-base font-bold text-white">{formatarReal(totalComAcrescimo)}</span>
            </div>
          </div>

          {/* O cliente viu um teto no agendamento. Passar dele nao e bloqueado
              — quem avalia o carro e o Admin — mas precisa ser uma decisao
              consciente, nao um numero digitado sem contexto. */}
          {acrescimoCondicaoPercent !== null && percentNumero > acrescimoCondicaoPercent && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              O cliente foi avisado de até {acrescimoCondicaoPercent}% (
              {formatarReal(acrescimoAlvo.valor * (1 + acrescimoCondicaoPercent / 100))}). Você está cobrando acima disso.
            </p>
          )}

          <p className="mt-3 text-xs text-astro-muted">
            {acrescimoAlvo.status === "PIX_PENDENTE"
              ? `O cliente pagou ${formatarReal(acrescimoAlvo.valor)} por PIX. Os ${formatarReal(valorAcrescimo)} são recebidos no local.`
              : "O valor total é recebido no local."}
          </p>
        </Modal>
      )}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="mt-2 rounded-2xl border border-dashed border-admin-border px-4 py-10 text-center text-sm text-astro-muted">
      {texto}
    </p>
  );
}

// Faixa tracejada entre dois agendamentos. A altura cresce um pouco com o
// tamanho do espaco, sem empurrar o dia para baixo.
function EspacoLivre({
  de,
  ate,
  agoraMin,
  capacidade,
}: {
  de: number;
  ate: number;
  agoraMin: number | null;
  capacidade: number;
}) {
  const min = ate - de;
  const temAgora = agoraMin !== null && agoraMin >= de && agoraMin < ate;
  return (
    <li className="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] sm:grid-cols-[4.25rem_1.5rem_minmax(0,1fr)]">
      <span className="pt-3 font-mono text-xs text-astro-muted">{hhmm(de)}</span>
      <span className="relative before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-admin-border" />
      <div
        className="relative my-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-dashed border-admin-border px-3.5 py-2 text-[0.8rem] text-astro-muted"
        style={{ minHeight: Math.min(Math.max(min * 0.25, 36), 64) }}
      >
        <span>
          <b className="font-semibold text-slate-100">Livre</b> · {hhmm(de)} às {hhmm(ate)} ({formatarDuracao(min)})
        </span>
        <span>
          {min >= MENOR_SERVICO_MIN
            ? `cabe mais ${capacidade === 1 ? "um carro" : "carros"}`
            : "intervalo curto"}
        </span>
        {temAgora && (
          <span
            className="absolute -left-7 right-0 border-t-2 border-red-500"
            style={{ top: `${((agoraMin - de) / min) * 100}%` }}
          >
            <span className="absolute -top-1.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="absolute -top-4 right-0 font-mono text-[0.65rem] font-bold text-red-400">
              agora {hhmm(agoraMin)}
            </span>
          </span>
        )}
      </div>
    </li>
  );
}

function Cartao({
  item,
  status,
  emAndamento,
  agoraMin,
  aberto,
  alternar,
  processando,
  confirmar,
  cancelar,
  comAcrescimo,
}: {
  item: ItemAgendamento;
  status: StatusAgendamento;
  emAndamento: boolean;
  agoraMin: number;
  aberto: boolean;
  alternar: () => void;
  processando: boolean;
  confirmar: () => void;
  cancelar: () => void;
  comAcrescimo: (() => void) | null;
}) {
  const estilo = ESTILO[status];
  const futuro = !emAndamento && status !== "CONCLUIDO" && status !== "CANCELADO";
  const tom = futuro ? FUTURO : estilo;
  const podeConfirmar = item.status === "PIX_PENDENTE" || item.status === "PENDENTE_PAGAMENTO";
  const podeCancelar = status !== "CANCELADO" && status !== "CONCLUIDO";
  const whatsapp = linkWhatsApp(item.clienteTelefone);
  const progresso = Math.round(((agoraMin - item.inicioMin) / item.duracaoMin) * 100);

  return (
    <li className="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] sm:grid-cols-[4.25rem_1.5rem_minmax(0,1fr)]">
      <span className="pt-5 font-mono text-sm font-bold text-white">
        {hhmm(item.inicioMin)}
        <small className="block text-[0.65rem] font-medium text-astro-muted">até {hhmm(item.fimMin)}</small>
      </span>
      <span className="relative before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-admin-border">
        <span className="absolute top-6 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-[3px] border-astro-blue-bright bg-admin-surface" />
      </span>

      <article
        className={`my-1.5 rounded-2xl border border-admin-border border-l-4 bg-admin-surface-2/40 px-4 py-3.5 ${tom.borda} ${tom.fundo} ${
          emAndamento ? "borda-viva shadow-[0_18px_50px_-20px_var(--color-astro-blue)]" : ""
        }`}
        style={{ minHeight: 70 + Math.round(item.duracaoMin * 0.35) }}
      >
        {/* Posicoes fixas por tamanho de tela. Celular: tudo empilhado.
            Tablet: 2 colunas (servico | situacao; carro | botoes).
            Computador: 4 colunas numa linha so. */}
        <div className="grid items-center gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_15rem_8rem_14rem]">
          {/* Servico em destaque, cliente embaixo */}
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            <h3 className="text-base leading-snug font-bold tracking-tight text-white">
              {item.servicoNome}
              <small className="ml-2 font-mono text-xs font-medium whitespace-nowrap text-astro-muted">
                {formatarDuracao(item.duracaoMin)}
              </small>
            </h3>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">{item.clienteNome}</p>
          </div>

          <p className="flex min-w-0 items-center gap-2 text-xs text-slate-200 md:col-start-1 md:row-start-2 xl:col-start-2 xl:row-start-1">
            <Car className="h-3.5 w-3.5 shrink-0 text-astro-muted" />
            <span className="truncate">{item.veiculo}</span>
            <span className="shrink-0 rounded border border-zinc-300 border-t-[3px] border-t-blue-700 bg-white px-1.5 font-mono text-[0.65rem] font-bold tracking-wider text-zinc-900">
              {item.placa}
            </span>
          </p>

          <div className="flex items-center gap-2 md:col-start-2 md:row-start-1 md:flex-col md:items-end xl:col-start-3 xl:items-center">
            <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap ${estilo.selo}`}>
              {emAndamento ? "Em andamento" : estilo.rotulo}
            </span>
            <span className="font-mono text-sm font-bold whitespace-nowrap text-white">
              {formatarReal(item.valor)}
              {item.acrescimoAplicado !== null && (
                <span className="block text-[0.7rem] font-semibold text-amber-300">
                  + {formatarReal(item.acrescimoAplicado)}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 md:col-start-2 md:row-start-2 md:justify-end xl:col-start-4 xl:row-start-1">
            {podeConfirmar && (
              <button
                type="button"
                onClick={confirmar}
                disabled={processando}
                className="rounded-full bg-astro-blue px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {processando ? "Confirmando..." : item.status === "PIX_PENDENTE" ? "Confirmar PIX" : "Recebi no local"}
              </button>
            )}
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Conversar com ${item.clienteNome} no WhatsApp`}
                title="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-admin-border text-slate-200 transition hover:border-astro-blue-bright hover:text-astro-blue-bright"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
            <button
              type="button"
              onClick={alternar}
              aria-expanded={aberto}
              aria-label={aberto ? "Fechar detalhes" : "Ver detalhes"}
              title="Detalhes"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-admin-border text-slate-200 transition hover:border-astro-blue-bright hover:text-astro-blue-bright"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {emAndamento && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10" title="Andamento do serviço">
            <div className="h-full bg-astro-blue" style={{ width: `${Math.min(Math.max(progresso, 0), 100)}%` }} />
          </div>
        )}

        {/* Detalhes e as demais acoes */}
        {aberto && (
          <div className="mt-3 grid gap-3 border-t border-admin-border pt-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Detalhe rotulo="Telefone" valor={formatarTelefone(item.clienteTelefone) || "sem telefone"} />
              <Detalhe rotulo="E-mail" valor={item.clienteEmail} />
              <Detalhe rotulo="Veículo" valor={`${item.veiculo} ${item.veiculoAno} · ${item.placa}`} />
              <Detalhe rotulo="Horário" valor={`${hhmm(item.inicioMin)} às ${hhmm(item.fimMin)}`} />
            </dl>
            <div className="flex flex-wrap gap-2">
              {/* So aparece quando a estetica tem politica de acrescimo
                  configurada: sem ela, o botao seria um caminho para cobrar o
                  que nunca foi avisado ao cliente. */}
              {podeConfirmar && comAcrescimo && (
                <button
                  type="button"
                  onClick={comAcrescimo}
                  disabled={processando}
                  className="flex items-center gap-2 rounded-full border border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Confirmar com acréscimo
                </button>
              )}
              {podeCancelar && (
                <button
                  type="button"
                  onClick={cancelar}
                  disabled={processando}
                  className="flex items-center gap-2 rounded-full border border-red-500/40 px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancelar
                </button>
              )}
              {!podeConfirmar && !podeCancelar && (
                <span className="flex items-center gap-1.5 text-xs text-astro-muted">
                  <Check className="h-3.5 w-3.5" />
                  Nenhuma ação disponível para esta situação.
                </span>
              )}
            </div>
          </div>
        )}
      </article>
    </li>
  );
}

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 text-astro-muted">{rotulo}</dt>
      <dd className="truncate text-slate-200">{valor}</dd>
    </div>
  );
}
