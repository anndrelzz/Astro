"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Car, Mail, MessageCircle, Search, Users } from "lucide-react";
import type { ContatoDoAdmin } from "@/compartilhado/contato";
import { iniciais } from "@/compartilhado/iniciais";
import { FUSO } from "@/compartilhado/fuso";
import { Modal } from "@/front/admin/modal";

// Aba Clientes do painel (decisao do orientador, 30/10). O dono ve quem ja se
// cadastrou, os carros e o historico de cada um, e acha quem sumiu para
// chamar no WhatsApp.

type Status = "PENDENTE_PAGAMENTO" | "PIX_PENDENTE" | "CONFIRMADO" | "CONCLUIDO" | "CANCELADO";

export type ClienteDoPainel = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  desdeISO: string;
  veiculos: { id: string; descricao: string; placa: string; segmento: string }[];
  /** Do mais recente para o mais antigo. `valor` ja inclui o acrescimo. */
  agendamentos: {
    id: string;
    dataISO: string;
    fimISO: string;
    servico: string;
    placa: string;
    status: Status;
    valor: number;
    pago: boolean;
  }[];
};

type Filtro = "todos" | "novos" | "sumidos" | "nunca";

const DIA_MS = 24 * 60 * 60 * 1000;
// "Novo" = cadastrou nos ultimos 30 dias. "Sem voltar" = o ultimo atendimento
// foi ha mais de 60 dias e nao ha nada marcado: e quem o dono quer chamar.
const NOVO_DIAS = 30;
const SUMIDO_DIAS = 60;

// Mesma largura do `lg:` do Tailwind (64rem): dali para cima o detalhe fica no
// painel ao lado da lista; abaixo, no modal.
const TELA_DE_COMPUTADOR = "(min-width: 64rem)";

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "novos", rotulo: "Novos" },
  { chave: "sumidos", rotulo: "Sem voltar" },
  { chave: "nunca", rotulo: "Nunca agendaram" },
];

const SELO: Record<Status, { rotulo: string; cls: string }> = {
  CONFIRMADO: { rotulo: "Confirmado", cls: "bg-emerald-400/15 text-emerald-300" },
  PIX_PENDENTE: { rotulo: "PIX pendente", cls: "bg-amber-400/15 text-amber-300" },
  PENDENTE_PAGAMENTO: { rotulo: "Paga no local", cls: "bg-sky-400/15 text-sky-300" },
  CONCLUIDO: { rotulo: "Concluído", cls: "bg-emerald-400/15 text-emerald-300" },
  CANCELADO: { rotulo: "Cancelado", cls: "bg-red-400/15 text-red-300" },
};

// Mesmo truque da agenda: ativo com o horario final ja passado e mostrado
// como concluido, sem mexer no status gravado.
function statusEfetivo(a: ClienteDoPainel["agendamentos"][number], agoraMs: number): Status {
  if (a.status === "CANCELADO" || a.status === "CONCLUIDO") return a.status;
  return new Date(a.fimISO).getTime() < agoraMs ? "CONCLUIDO" : a.status;
}

export function resumoDoCliente(c: ClienteDoPainel, agoraMs: number) {
  const validos = c.agendamentos.filter((a) => a.status !== "CANCELADO");
  const passados = validos.filter((a) => new Date(a.dataISO).getTime() <= agoraMs);
  const futuros = validos.filter((a) => new Date(a.dataISO).getTime() > agoraMs);
  const ultimo = passados[0] ?? null;
  const proximo = futuros.at(-1) ?? null;
  const totalGasto = validos.filter((a) => a.pago).reduce((soma, a) => soma + a.valor, 0);
  const ultimoMs = ultimo ? new Date(ultimo.dataISO).getTime() : null;
  return {
    agendamentos: validos.length,
    ultimo,
    proximo,
    totalGasto,
    novo: agoraMs - new Date(c.desdeISO).getTime() <= NOVO_DIAS * DIA_MS,
    sumido: ultimoMs !== null && !proximo && agoraMs - ultimoMs > SUMIDO_DIAS * DIA_MS,
    nunca: validos.length === 0,
    // Para ordenar: quem esteve (ou vai estar) na loja mais perto de hoje vem antes.
    referenciaMs: proximo
      ? new Date(proximo.dataISO).getTime()
      : (ultimoMs ?? new Date(c.desdeISO).getTime() - 100 * 365 * DIA_MS),
  };
}

// Busca sem acento e sem pontuacao: "joao" acha "João", "47999" acha
// "(47) 9 9999-...", "fdn-8637" acha "FDN8637".
function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]/g, "");
}

export function bateComBusca(c: ClienteDoPainel, termo: string) {
  const t = normalizar(termo);
  if (!t) return true;
  return [c.nome, c.email, c.telefone, ...c.veiculos.map((v) => v.placa), ...c.agendamentos.map((a) => a.placa)].some(
    (campo) => normalizar(campo).includes(t)
  );
}

function formatarTelefone(t: string) {
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

function linkWhatsApp(telefone: string) {
  const d = telefone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

function formatarReal(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
}

function dataLonga(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dataEHora(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${dia.replace(".", "")} · ${hora}`;
}

export function ClientesAdmin({
  clientes,
  contatosDoAdmin = [],
  agoraISO,
}: {
  clientes: ClienteDoPainel[];
  /** Quem o Admin agendou pelo coringa, agrupado por telefone. */
  contatosDoAdmin?: ContatoDoAdmin[];
  agoraISO: string;
}) {
  const agoraMs = new Date(agoraISO).getTime();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  // No celular o detalhe abre num modal; no computador fica ao lado da lista.
  const [modalAberto, setModalAberto] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);

  const comResumo = useMemo(
    () =>
      clientes
        .map((c) => ({ cliente: c, resumo: resumoDoCliente(c, agoraMs) }))
        .sort((a, b) => b.resumo.referenciaMs - a.resumo.referenciaMs || a.cliente.nome.localeCompare(b.cliente.nome)),
    [clientes, agoraMs]
  );

  const contagens: Record<Filtro, number> = {
    todos: comResumo.length,
    novos: comResumo.filter((c) => c.resumo.novo).length,
    sumidos: comResumo.filter((c) => c.resumo.sumido).length,
    nunca: comResumo.filter((c) => c.resumo.nunca).length,
  };

  const visiveis = comResumo.filter(
    ({ cliente, resumo }) =>
      (filtro === "todos" ||
        (filtro === "novos" && resumo.novo) ||
        (filtro === "sumidos" && resumo.sumido) ||
        (filtro === "nunca" && resumo.nunca)) &&
      bateComBusca(cliente, busca)
  );

  // A mesma busca vale para os agendados pelo Admin: nome, telefone ou placa.
  const termo = normalizar(busca);
  const contatosVisiveis = contatosDoAdmin.filter(
    (c) => !termo || [c.nome, c.telefone, ...c.carros].some((campo) => normalizar(campo).includes(termo))
  );

  const selecionado = comResumo.find((c) => c.cliente.id === selecionadoId) ?? visiveis[0] ?? null;

  // Se a tela cresce para computador com o modal aberto (janela redimensionada,
  // celular girado), o modal fica escondido mas ainda aberto — e trava a
  // pagina. Fecha junto.
  useEffect(() => {
    const consulta = window.matchMedia?.(TELA_DE_COMPUTADOR);
    if (!consulta) return;
    const aoMudar = (e: { matches: boolean }) => {
      if (e.matches) setModalAberto(false);
    };
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  function abrir(id: string) {
    setSelecionadoId(id);
    // O modal so existe no celular. O <dialog> nativo aberto deixa o resto da
    // pagina inerte mesmo escondido pelo lg:hidden: no computador, abrir o
    // modal travava a tela inteira (so saia com F5).
    if (!window.matchMedia?.(TELA_DE_COMPUTADOR).matches) setModalAberto(true);
    // No computador, o detalhe precisa aparecer inteiro: se ele estiver
    // cortado pela borda da tela, a pagina rola ate o topo dele, e o `sticky`
    // o segura ali enquanto a lista continua rolando.
    requestAnimationFrame(() => {
      const painel = painelRef.current;
      if (!painel || painel.offsetParent === null) return;
      const { top, bottom } = painel.getBoundingClientRect();
      if (top < 0 || bottom > window.innerHeight) {
        window.scrollBy({ top: top - 24, behavior: "smooth" });
      }
    });
  }

  return (
    <div>
      <h1 className="mb-7 text-3xl font-bold tracking-tight text-white lg:text-4xl">Clientes</h1>

      {/* Cartao de destaque, no padrao das outras telas do painel. */}
      <section
        className="borda-viva relative mb-6 overflow-hidden rounded-3xl p-5 text-white sm:p-6"
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
          boxShadow:
            "0 24px 60px -24px color-mix(in srgb, var(--color-astro-blue) 80%, transparent), 0 0 50px -10px color-mix(in srgb, var(--color-astro-blue-bright) 45%, transparent)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/20 shadow-[0_0_0_40px_rgba(255,255,255,0.04),0_0_0_90px_rgba(255,255,255,0.03)]"
        />
        <div className="relative grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-sm text-white/75">Clientes</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">{contagens.todos}</p>
          </div>
          <div>
            <p className="text-sm text-white/75">Novos nos últimos {NOVO_DIAS} dias</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">{contagens.novos}</p>
          </div>
          <div>
            <p className="text-sm text-white/75">Sem voltar há mais de {SUMIDO_DIAS} dias</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">{contagens.sumidos}</p>
            <p className="mt-1 text-xs text-white/70">Uma mensagem no WhatsApp pode trazer de volta.</p>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar clientes">
          {FILTROS.map((f) => {
            const ativo = filtro === f.chave;
            return (
              <button
                key={f.chave}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(f.chave)}
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
                  {contagens[f.chave]}
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex min-w-0 flex-[0_1_20rem] items-center gap-2 rounded-full border border-admin-border bg-admin-bg px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-astro-muted" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, telefone, e-mail ou placa"
            aria-label="Buscar cliente"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-astro-muted"
          />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-admin-border bg-admin-surface p-3 sm:p-4" aria-label="Lista de clientes">
          {visiveis.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-admin-border p-8 text-center text-sm text-astro-muted">
              {clientes.length === 0
                ? "Quando alguém criar conta na sua estética, aparece aqui."
                : "Nenhum cliente encontrado com essa busca."}
            </p>
          ) : (
            <ul className="grid gap-2">
              {visiveis.map(({ cliente, resumo }) => {
                const ativo = selecionado?.cliente.id === cliente.id;
                return (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() => abrir(cliente.id)}
                      aria-current={ativo ? "true" : undefined}
                      className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        ativo
                          ? "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-astro-blue)_22%,transparent),transparent_75%)] ring-1 ring-astro-blue-bright/50"
                          : "bg-admin-surface-2 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${
                          ativo ? "bg-astro-blue" : "bg-admin-border"
                        }`}
                      >
                        {iniciais(cliente.nome)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{cliente.nome}</span>
                          {resumo.novo && (
                            <span className="rounded-full bg-astro-blue/20 px-2 py-0.5 text-[0.6rem] font-semibold text-astro-blue-bright">
                              Novo
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-astro-muted">
                          {cliente.telefone ? formatarTelefone(cliente.telefone) : cliente.email}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-xs font-semibold text-slate-200">
                          {resumo.agendamentos} {resumo.agendamentos === 1 ? "agendamento" : "agendamentos"}
                        </span>
                        <span className="block text-[0.7rem] text-astro-muted">
                          {resumo.proximo
                            ? `Próximo ${dataCurta(resumo.proximo.dataISO)}`
                            : resumo.ultimo
                              ? `Último ${dataCurta(resumo.ultimo.dataISO)}`
                              : "Nunca agendou"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Computador: detalhe fixo ao lado da lista. */}
        <aside className="hidden lg:block">
          <div ref={painelRef} className="sticky top-6">
            {selecionado && <DetalheDoCliente {...selecionado} agoraMs={agoraMs} cabeNaTela />}
          </div>
        </aside>
      </div>

      {/* Quem chamou no WhatsApp ou no Instagram e foi agendado pelo Admin,
          pelo coringa: nao tem conta, entao fica fora da lista de cima. */}
      {contatosDoAdmin.length > 0 && (
        <section
          aria-label="Agendado pelo Admin"
          className="mt-5 rounded-3xl border border-admin-border bg-admin-surface p-4 sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Agendado pelo Admin</h2>
            <span className="text-xs text-astro-muted">Quem chamou no WhatsApp ou no Instagram</span>
          </div>
          {contatosVisiveis.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-admin-border p-6 text-center text-sm text-astro-muted">
              Ninguém agendado pelo Admin com essa busca.
            </p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {contatosVisiveis.map((c) => {
                const whatsapp = linkWhatsApp(c.telefone);
                return (
                  <li
                    key={c.telefone}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-admin-surface-2 px-3 py-2.5"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-border text-xs font-bold text-white">
                      {iniciais(c.nome)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{c.nome}</span>
                      <span className="block truncate text-xs text-astro-muted">
                        {formatarTelefone(c.telefone)} · {c.carros.join(", ")}
                      </span>
                      <span className="block text-[0.7rem] text-astro-muted">
                        {c.agendamentos} {c.agendamentos === 1 ? "agendamento" : "agendamentos"}
                        {c.proximoISO
                          ? ` · próximo ${dataCurta(c.proximoISO)}`
                          : c.ultimoISO
                            ? ` · último ${dataCurta(c.ultimoISO)}`
                            : ""}
                      </span>
                    </span>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp de ${c.nome}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-astro-blue text-white transition hover:brightness-110"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Celular: o mesmo detalhe num modal. */}
      <div className="lg:hidden">
        <Modal aberto={modalAberto && !!selecionado} onFechar={() => setModalAberto(false)} titulo={selecionado?.cliente.nome ?? ""}>
          {selecionado && <DetalheDoCliente {...selecionado} agoraMs={agoraMs} semCabecalho />}
        </Modal>
      </div>
    </div>
  );
}

function DetalheDoCliente({
  cliente,
  resumo,
  agoraMs,
  semCabecalho = false,
  cabeNaTela = false,
}: {
  cliente: ClienteDoPainel;
  resumo: ReturnType<typeof resumoDoCliente>;
  agoraMs: number;
  semCabecalho?: boolean;
  /** Limita a altura a da tela; o que sobrar rola so na lista de agendamentos. */
  cabeNaTela?: boolean;
}) {
  const whatsapp = linkWhatsApp(cliente.telefone);
  return (
    <section
      className={`rounded-3xl border border-admin-border bg-admin-surface p-5 ${
        cabeNaTela ? "flex max-h-[calc(100dvh-3rem)] flex-col" : ""
      }`}
      aria-label={`Detalhes de ${cliente.nome}`}
    >
      {!semCabecalho && (
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-astro-blue text-sm font-bold text-white">
            {iniciais(cliente.nome)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-white">{cliente.nome}</h2>
            <p className="text-xs text-astro-muted">Cliente desde {dataLonga(cliente.desdeISO)}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-astro-blue px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp {formatarTelefone(cliente.telefone)}
          </a>
        )}
        <a
          href={`mailto:${cliente.email}`}
          className="flex min-w-0 items-center gap-2 rounded-full border border-admin-border px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-astro-blue"
        >
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">{cliente.email}</span>
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-admin-surface-2 px-4 py-3">
          <p className="text-xs text-astro-muted">Total pago</p>
          <p className="mt-0.5 text-lg font-bold text-white">{formatarReal(resumo.totalGasto)}</p>
        </div>
        <div className="rounded-2xl bg-admin-surface-2 px-4 py-3">
          <p className="text-xs text-astro-muted">Próximo</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {resumo.proximo ? dataEHora(resumo.proximo.dataISO) : "Nada marcado"}
          </p>
        </div>
      </div>

      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-white">
        <Car className="h-4 w-4 text-astro-muted" />
        Garagem
      </h3>
      {cliente.veiculos.length === 0 ? (
        <p className="mt-2 text-sm text-astro-muted">Nenhum carro cadastrado.</p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {cliente.veiculos.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl bg-admin-surface-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-100">
                {v.descricao} <span className="text-astro-muted">· {v.segmento}</span>
              </span>
              <span className="rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[0.7rem] text-white">{v.placa}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-white">
        <Users className="h-4 w-4 text-astro-muted" />
        Agendamentos
      </h3>
      {cliente.agendamentos.length === 0 ? (
        <p className="mt-2 text-sm text-astro-muted">Ainda não agendou.</p>
      ) : (
        // So esta lista rola: nome, contato, total e garagem ficam sempre a vista.
        <ul className={`mt-2 grid content-start gap-1.5 ${cabeNaTela ? "min-h-0 flex-1 overflow-y-auto pr-1" : ""}`}>
          {cliente.agendamentos.map((a) => {
            const selo = SELO[statusEfetivo(a, agoraMs)];
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-admin-surface-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-slate-100">{a.servico}</span>
                  <span className="block text-xs text-astro-muted">
                    {dataEHora(a.dataISO)} · {formatarReal(a.valor)}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${selo.cls}`}>{selo.rotulo}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
