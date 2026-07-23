"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, Clock, X } from "lucide-react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ThemeColor } from "@/components/ui/theme-color";

type Item = {
  id: string;
  dataHoraISO: string;
  duracaoMin: number;
  servicoNome: string;
  veiculoMarcaModelo: string;
  segmento: string;
  valor: number;
  status: string;
  podeCancelar: boolean;
};

type Categoria = "todos" | "proximo" | "concluido" | "cancelado";

// Categoriza pelo status persistido: concluido, cancelado ou "proximo"
// (qualquer estado ativo — pendente/confirmado/pix).
function categoria(status: string): Exclude<Categoria, "todos"> {
  if (status === "CANCELADO") return "cancelado";
  if (status === "CONCLUIDO") return "concluido";
  return "proximo";
}

const FILTROS: { chave: Categoria; label: string }[] = [
  { chave: "todos", label: "Todos" },
  { chave: "proximo", label: "Próximos" },
  { chave: "concluido", label: "Concluídos" },
  { chave: "cancelado", label: "Cancelados" },
];

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Formata "10:00 – 11:00" a partir do inicio + duracao.
function faixaHorario(iso: string, duracaoMin: number) {
  const inicio = new Date(iso);
  const fim = new Date(inicio.getTime() + duracaoMin * 60000);
  const hm = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${hm(inicio)} – ${hm(fim)}`;
}

export function HistoricoLista({
  slug,
  itens,
  horasLimite,
}: {
  slug: string;
  itens: Item[];
  horasLimite: number;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Categoria>("todos");
  const [alvo, setAlvo] = useState<Item | null>(null); // agendamento no modal de cancelar
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const visiveis =
    filtro === "todos"
      ? itens
      : itens.filter((i) => categoria(i.status) === filtro);

  async function confirmarCancelamento() {
    if (!alvo) return;
    setCancelando(true);
    setErro(null);
    const resposta = await fetch(`/api/agendamentos/${alvo.id}/cancelar`, {
      method: "POST",
    });
    setCancelando(false);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível cancelar.");
      return;
    }
    setAlvo(null);
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[#f6f8fb] pb-28">
      <ThemeColor color="#f6f8fb" />

      {/* Cabecalho */}
      <header className="mx-auto max-w-md px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-end justify-between">
          <div>
            <p className="astro-label">
              {String(itens.length).padStart(2, "0")} registros
            </p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">
              Meus agendamentos
            </h1>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          {FILTROS.map((f) => {
            const ativo = filtro === f.chave;
            return (
              <button
                key={f.chave}
                onClick={() => setFiltro(f.chave)}
                className={
                  ativo
                    ? "flex shrink-0 items-center gap-1.5 rounded-full bg-astro-bg px-4 py-2 text-sm font-semibold text-white"
                    : "shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500"
                }
              >
                {ativo && <span className="h-1.5 w-1.5 rounded-full bg-astro-blue-bright" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Lista */}
      <main className="mx-auto mt-4 max-w-md space-y-3 px-5">
        {visiveis.map((item) => (
          <Card key={item.id} item={item} onCancelar={() => setAlvo(item)} />
        ))}
        {visiveis.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-400">
            Nenhum agendamento aqui.
          </p>
        )}
      </main>

      <BottomNav slug={slug} />

      {/* Tela 14 — modal de cancelamento */}
      {alvo && (
        <ModalCancelar
          item={alvo}
          horasLimite={horasLimite}
          cancelando={cancelando}
          erro={erro}
          onFechar={() => {
            setAlvo(null);
            setErro(null);
          }}
          onConfirmar={confirmarCancelamento}
        />
      )}
    </div>
  );
}

// Card de agendamento (data + status + servico + preco).
function Card({ item, onCancelar }: { item: Item; onCancelar: () => void }) {
  const data = new Date(item.dataHoraISO);
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const dia = data.getDate();
  const ano = data.getFullYear();
  const cat = categoria(item.status);

  const badge = {
    proximo: { txt: "Próximo", cls: "text-astro-blue-bright" },
    concluido: { txt: "Concluído", cls: "text-zinc-400" },
    cancelado: { txt: "Cancelado", cls: "text-red-500" },
  }[cat];

  const proximo = cat === "proximo";

  return (
    <div
      className={
        proximo
          ? "flex items-stretch gap-3 rounded-2xl border border-astro-blue/30 bg-white p-3 shadow-lg shadow-astro-blue/10 ring-1 ring-astro-blue/20"
          : "flex items-stretch gap-3 rounded-2xl border border-zinc-100 bg-white p-3"
      }
    >
      {/* Bloco de data */}
      <div
        className={
          proximo
            ? "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-astro-blue py-2 text-white"
            : "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-astro-bg py-2 text-white"
        }
      >
        <span className="text-[0.6rem] font-medium opacity-70">{mes}</span>
        <span className="text-xl font-bold leading-none">{dia}</span>
        <span className="text-[0.6rem] opacity-50">{ano}</span>
      </div>

      {/* Conteudo */}
      <div className="min-w-0 flex-1">
        <p className={`astro-label !text-[0.62rem] ${badge.cls}`}>
          • {badge.txt}
        </p>
        <h3 className="mt-0.5 truncate font-bold text-zinc-900">
          {item.servicoNome}
        </h3>
        <p className="text-xs text-zinc-500">
          {item.veiculoMarcaModelo} · {item.segmento}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{faixaHorario(item.dataHoraISO, item.duracaoMin)}</span>
          <span className="font-semibold text-zinc-900">
            {BRL(item.valor)}
          </span>
        </div>
      </div>

      {/* Acao cancelar (so em proximos dentro do prazo) */}
      {item.podeCancelar && (
        <button
          onClick={onCancelar}
          aria-label="Cancelar agendamento"
          className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Tela 14 — modal de confirmacao de cancelamento (destrutivo, vermelho).
function ModalCancelar({
  item,
  horasLimite,
  cancelando,
  erro,
  onFechar,
  onConfirmar,
}: {
  item: Item;
  horasLimite: number;
  cancelando: boolean;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const data = new Date(item.dataHoraISO);
  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
  const diaMes = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const faixa = faixaHorario(item.dataHoraISO, item.duracaoMin);
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <Trash2 className="h-6 w-6 text-red-500" />
        </div>

        <h2 className="mt-4 text-lg font-bold text-zinc-900">
          Cancelar agendamento?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Tem certeza que deseja cancelar o serviço de{" "}
          <span className="font-semibold text-zinc-700">
            {item.servicoNome}
          </span>{" "}
          agendado para{" "}
          <span className="font-semibold text-zinc-700 first-letter:uppercase">
            {diaSemana}, {diaMes}
          </span>{" "}
          às <span className="font-semibold text-zinc-700">{faixa}</span>?
        </p>

        {/* Resumo */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 text-left">
          <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-astro-bg py-1.5 text-white">
            <span className="text-[0.55rem] opacity-70">{mes}</span>
            <span className="text-lg font-bold leading-none">
              {data.getDate()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-zinc-900">
              {item.servicoNome}
            </p>
            <p className="text-xs text-zinc-500">{faixa}</p>
            <p className="text-xs text-zinc-500">
              {item.veiculoMarcaModelo} · {item.segmento}
            </p>
          </div>
          <span className="shrink-0 font-bold text-zinc-900">
            {BRL(item.valor)}
          </span>
        </div>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <button
          onClick={onConfirmar}
          disabled={cancelando}
          className="mt-5 w-full rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-600 disabled:opacity-50"
        >
          {cancelando ? "Cancelando..." : "Sim, cancelar agendamento"}
        </button>
        <button
          onClick={onFechar}
          disabled={cancelando}
          className="mt-2 w-full py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700"
        >
          Manter agendamento
        </button>

        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Prazo minimo, mantido do comportamento RF18 */}
        <p className="sr-only">
          Cancelamento permitido com no mínimo {horasLimite}h de antecedência.
        </p>
      </div>
    </div>
  );
}
