"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CalendarDays, Car, Clock, CreditCard, Ban, X } from "lucide-react";
import { ThemeColor } from "@/components/ui/theme-color";
import { FUSO, partesNoFuso } from "@/lib/fuso";

type Item = {
  id: string;
  dataHoraISO: string;
  duracaoMin: number;
  servicoNome: string;
  veiculoMarcaModelo: string;
  placa: string;
  segmento: string;
  valor: number;
  // Acrescimo cobrado na avaliacao presencial. O cliente aceitou a
  // possibilidade ao agendar; esconder o que foi cobrado seria estranho.
  acrescimoAplicado: number | null;
  status: string;
  formaPagamento: string;
};

type Categoria = "todos" | "proximo" | "concluido" | "cancelado";

// Item com as duas decisoes que dependem da hora ja resolvidas pelo componente
// pai. As linhas e os cartoes recebem isto pronto e nao olham o relogio.
type ItemComEstado = Item & {
  cat: Exclude<Categoria, "todos">;
  cancelavel: boolean;
};

// As duas funcoes abaixo dependem da hora atual, e recebem esse instante como
// argumento em vez de chamar Date.now() por conta propria. Antes o "pode
// cancelar" vinha decidido pelo servidor (congelado no render) e a categoria
// era calculada aqui: dois relogios decidindo sobre a mesma linha, o que
// permitia o selo dizer "Concluido" com o botao "Cancelar" ainda ativo.
// Recebendo `agora` de fora, as duas respondem sobre o mesmo instante.

// Categoriza pelo status persistido, mas "concluido" tambem cobre qualquer
// agendamento ativo cujo horario ja passou — nenhuma rota do sistema atribui
// esse status automaticamente, entao sem isso um agendamento antigo nunca
// cancelado ficaria em "Proximo" para sempre.
function categoria(
  item: Pick<Item, "status" | "dataHoraISO" | "duracaoMin">,
  agora: number
): Exclude<Categoria, "todos"> {
  if (item.status === "CANCELADO") return "cancelado";
  const fim = new Date(item.dataHoraISO).getTime() + item.duracaoMin * 60000;
  if (item.status === "CONCLUIDO" || fim < agora) return "concluido";
  return "proximo";
}

// RN11 — o cliente so cancela fora da janela configurada pelo Admin. A rota
// revalida isso antes de gravar; aqui e so para nao oferecer um botao que vai
// ser recusado.
function podeCancelar(item: Item, horasLimite: number, agora: number) {
  if (item.status === "CANCELADO" || item.status === "CONCLUIDO") return false;
  const horasAte = (new Date(item.dataHoraISO).getTime() - agora) / (1000 * 60 * 60);
  return horasAte >= horasLimite;
}

const FILTROS: { chave: Categoria; label: string }[] = [
  { chave: "todos", label: "Todos" },
  { chave: "proximo", label: "Próximos" },
  { chave: "concluido", label: "Concluídos" },
  { chave: "cancelado", label: "Cancelados" },
];

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// O mockup mostra a forma de pagamento sob o nome do servico ("via PIX").
const FORMA_ROTULO: Record<string, string> = { PIX: "PIX", LOCAL: "No local" };

// Estilos do selo de status, compartilhados pelo card do celular e pela linha
// da tabela do desktop.
const BADGE = {
  proximo: { txt: "Próximo", cls: "text-astro-blue-bright" },
  concluido: { txt: "Concluído", cls: "text-zinc-400" },
  cancelado: { txt: "Cancelado", cls: "text-red-500" },
} as const;

// Como o cliente le cada status no resumo (os mesmos textos do cartao de
// proximo horario da home).
const SITUACAO: Record<string, string> = {
  CONFIRMADO: "Confirmado",
  PIX_PENDENTE: "PIX aguardando confirmação",
  PENDENTE_PAGAMENTO: "Pagamento no local",
  CANCELADO: "Cancelado",
  CONCLUIDO: "Concluído",
};

// Formata "10:00 – 11:00" a partir do inicio + duracao.
function faixaHorario(iso: string, duracaoMin: number) {
  const inicio = new Date(iso);
  const fim = new Date(inicio.getTime() + duracaoMin * 60000);
  const hm = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
  return `${hm(inicio)} – ${hm(fim)}`;
}

export function HistoricoLista({
  itens,
  horasLimite,
}: {
  itens: Item[];
  horasLimite: number;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Categoria>("proximo");
  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");
  const [alvo, setAlvo] = useState<Item | null>(null); // agendamento no modal de cancelar
  const [aberto, setAberto] = useState<ItemComEstado | null>(null); // agendamento no resumo
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Um unico Date.now() alimenta a categoria E o "pode cancelar" de todas as
  // linhas — era a divergencia entre esses dois que deixava o selo dizer
  // "Concluido" com o botao "Cancelar" ainda ativo.
  //
  // react-hooks/purity reclama porque useMemo roda durante a renderizacao, e
  // ler o relogio ali torna o componente nao-idempotente. A regra esta certa no
  // geral; aqui a lista E sobre tempo, e as tres saidas que o React oferece
  // saem pior: guardar em estado e atualizar por efeito cai na regra irma
  // (set-state-in-effect); comecar em zero marca todo agendamento como
  // cancelavel no primeiro minuto; e useSyncExternalStore exige um cache de
  // modulo que, no servidor, congela na hora em que o processo subiu e
  // reintroduz divergencia de hidratacao.
  //
  // O risco que a regra protege — valor mudar sozinho entre renders — e o
  // comportamento desejado aqui, e a rota de cancelamento revalida a janela
  // antes de gravar (RN11), entao a tela nunca e a unica guarda.
  const comEstado = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const agora = Date.now();
    return itens.map((i) => ({
      ...i,
      cat: categoria(i, agora),
      cancelavel: podeCancelar(i, horasLimite, agora),
    }));
  }, [itens, horasLimite]);

  const visiveis = useMemo(() => {
    const filtrados =
      filtro === "todos" ? comEstado : comEstado.filter((i) => i.cat === filtro);

    // A pagina ja entrega em ordem decrescente; inverter cobre "Mais antigos"
    // sem uma segunda consulta ao banco.
    return ordem === "recentes" ? filtrados : [...filtrados].reverse();
  }, [comEstado, filtro, ordem]);

  // Contadores dos quatro indicadores do topo (tela 13). Contam sobre a lista
  // inteira, nao sobre o filtro — eles sao o panorama que orienta o filtro.
  const contagem = useMemo(() => {
    const c = { todos: comEstado.length, proximo: 0, concluido: 0, cancelado: 0 };
    for (const i of comEstado) c[i.cat]++;
    return c;
  }, [comEstado]);

  const INDICADORES = [
    { rotulo: "Total", valor: contagem.todos, cls: "text-zinc-900" },
    { rotulo: "Próximo", valor: contagem.proximo, cls: "text-astro-blue" },
    { rotulo: "Concluídos", valor: contagem.concluido, cls: "text-zinc-900" },
    { rotulo: "Cancelado", valor: contagem.cancelado, cls: "text-red-500" },
  ];

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
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+7.5rem)] lg:min-h-0 lg:pb-10">
      <ThemeColor color="#f6f8fb" />

      {/* Cabecalho — celular. No desktop o titulo vem da casca. */}
      <header className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] lg:hidden">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Meus agendamentos
            </h1>
          </div>
        </div>
      </header>

      {/* Indicadores — so no desktop (tela 13). No celular a contagem cabe na
          linha "NN registros" do cabecalho, e quatro cartoes empilhados
          empurrariam a lista para fora da primeira tela. */}
      <div className="hidden gap-4 px-8 lg:grid lg:grid-cols-4">
        {INDICADORES.map((ind) => (
          <div
            key={ind.rotulo}
            className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm"
          >
            <p className="astro-label">{ind.rotulo}</p>
            <p className={`mt-1 text-3xl font-bold ${ind.cls}`}>
              {String(ind.valor).padStart(2, "0")}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros, e a ordenacao ao lado no desktop */}
      <div className="mx-auto mt-4 max-w-md px-4 lg:mx-0 lg:max-w-none lg:px-8">
        <div className="lg:flex lg:items-center lg:justify-between lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-zinc-100 lg:bg-white lg:p-4">
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:pb-0">
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

          <label className="hidden items-center gap-2 lg:flex">
            <span className="astro-label whitespace-nowrap">Ordenar por</span>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as "recentes" | "antigos")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 focus:border-astro-blue focus:outline-none"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigos">Mais antigos</option>
            </select>
          </label>
        </div>
      </div>

      {/* Lista em cartoes — celular */}
      <main className="mx-auto mt-4 max-w-md space-y-3 px-4 lg:hidden">
        {visiveis.map((item) => (
          <Card
            key={item.id}
            item={item}
            onAbrir={() => setAberto(item)}
            onCancelar={() => setAlvo(item)}
          />
        ))}
        {visiveis.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-400">
            Nenhum agendamento aqui.
          </p>
        )}
      </main>

      {/* Tabela — desktop. Com a tela larga, os mesmos campos viram colunas
          alinhadas: comparar seis agendamentos vira leitura vertical, em vez
          de caçar o preço em seis cartoes. */}
      <div className="hidden px-8 lg:block">
        <div className="overflow-hidden rounded-b-2xl border border-zinc-100 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                {["Data", "Serviço", "Veículo", "Horário", "Valor", "Ações"].map(
                  (col) => (
                    <th key={col} className="astro-label px-4 py-3 font-normal">
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visiveis.map((item) => (
                <Linha
                  key={item.id}
                  item={item}
                  onAbrir={() => setAberto(item)}
                  onCancelar={() => setAlvo(item)}
                />
              ))}
            </tbody>
          </table>

          {visiveis.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-zinc-400">
              Nenhum agendamento aqui.
            </p>
          )}
        </div>
      </div>


      {/* Resumo do agendamento tocado. O "Cancelar" dele passa a vez para o
          modal de cancelamento, um aviso de cada vez. */}
      {aberto && (
        <ModalResumo
          item={aberto}
          onFechar={() => setAberto(null)}
          onCancelar={() => {
            setAlvo(aberto);
            setAberto(null);
          }}
        />
      )}

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

// Linha da tabela do desktop. Mesmos dados do Card, dispostos em colunas.
function Linha({
  item,
  onAbrir,
  onCancelar,
}: {
  item: ItemComEstado;
  onAbrir: () => void;
  onCancelar: () => void;
}) {
  const data = new Date(item.dataHoraISO);
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short", timeZone: FUSO })
    .replace(".", "")
    .toUpperCase();
  const cat = item.cat;
  const badge = BADGE[cat];
  const proximo = cat === "proximo";

  return (
    <tr
      {...abreAoTocar(onAbrir, `Ver resumo de ${item.servicoNome}`)}
      className="cursor-pointer align-middle transition hover:bg-zinc-50/60 focus-visible:bg-zinc-50 focus-visible:outline-none"
    >
      <td className="px-4 py-3">
        <div
          className={
            proximo
              ? "flex w-14 flex-col items-center justify-center rounded-xl bg-astro-blue py-2 text-white"
              : "flex w-14 flex-col items-center justify-center rounded-xl bg-astro-bg py-2 text-white"
          }
        >
          <span className="text-[0.6rem] font-medium opacity-70">{mes}</span>
          <span className="text-lg font-bold leading-none">{partesNoFuso(data).dia}</span>
          <span className="text-[0.55rem] opacity-50">{partesNoFuso(data).ano}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <p className={`astro-label !text-[0.62rem] ${badge.cls}`}>
          • {badge.txt}
        </p>
        <p className="mt-0.5 font-bold text-zinc-900">{item.servicoNome}</p>
        <p className="text-xs text-zinc-500">
          via {FORMA_ROTULO[item.formaPagamento] ?? item.formaPagamento}
        </p>
      </td>

      <td className="px-4 py-3 text-sm text-zinc-700">
        {item.veiculoMarcaModelo} · {item.segmento}
      </td>

      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-zinc-500">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {faixaHorario(item.dataHoraISO, item.duracaoMin)}
        </span>
      </td>

      <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900">
        {BRL(item.valor)}
        {item.acrescimoAplicado !== null && (
          <span className="ml-1 text-xs font-normal text-amber-600">
            + {BRL(item.acrescimoAplicado)}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {/* So aparece quando o cancelamento e permitido (RF18). Fora do prazo
            a celula fica vazia: um botao desabilitado convidaria ao clique. */}
        {item.cancelavel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancelar();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Cancelar ${item.servicoNome}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100"
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

// Card de agendamento (data + status + servico + preco).
// O cartao inteiro abre o resumo; a lixeira dentro dele so cancela.
function Card({
  item,
  onAbrir,
  onCancelar,
}: {
  item: ItemComEstado;
  onAbrir: () => void;
  onCancelar: () => void;
}) {
  const data = new Date(item.dataHoraISO);
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short", timeZone: FUSO })
    .replace(".", "")
    .toUpperCase();
  const { dia, ano } = partesNoFuso(data);
  const cat = item.cat;
  const badge = BADGE[cat];
  const proximo = cat === "proximo";

  return (
    <div
      {...abreAoTocar(onAbrir, `Ver resumo de ${item.servicoNome}`)}
      className={`flex cursor-pointer items-stretch gap-3 rounded-2xl bg-white p-3 transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-astro-blue ${
        proximo
          ? "border border-astro-blue/30 shadow-lg shadow-astro-blue/10 ring-1 ring-astro-blue/20"
          : "border border-zinc-200/80 shadow-[0_8px_24px_-18px_rgb(15_23_42/0.3)]"
      }`}
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
        {item.acrescimoAplicado !== null && (
          <span className="ml-1 text-xs font-normal text-amber-600">
            + {BRL(item.acrescimoAplicado)}
          </span>
        )}
          </span>
        </div>
      </div>

      {/* Acao cancelar (so em proximos dentro do prazo) */}
      {item.cancelavel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancelar();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Cancelar agendamento"
          className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100"
        >
          <Ban className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Cartao e linha abrem o resumo ao toque. Nao sao <button> porque ja tem a
// lixeira dentro (botao dentro de botao nao vale); entao recebem papel de
// botao, foco pelo Tab e Enter/Espaco, como um botao de verdade.
function abreAoTocar(onAbrir: () => void, rotulo: string) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": rotulo,
    onClick: onAbrir,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onAbrir();
      }
    },
  };
}

// Resumo de um agendamento: tudo o que o cartao mostra apertado, por extenso,
// e os atalhos que fazem sentido para ele (pagar o PIX, cancelar).
function ModalResumo({
  item,
  onFechar,
  onCancelar,
}: {
  item: ItemComEstado;
  onFechar: () => void;
  onCancelar: () => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  const data = new Date(item.dataHoraISO);
  const diaExtenso = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: FUSO,
  });
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short", timeZone: FUSO })
    .replace(".", "")
    .toUpperCase();
  const badge = BADGE[item.cat];
  const proximo = item.cat === "proximo";
  const pixAberto = proximo && item.status === "PIX_PENDENTE";
  // Horario que ja passou sem ser cancelado conta como feito, como no filtro.
  const situacao = item.cat === "concluido" ? "Concluído" : (SITUACAO[item.status] ?? item.status);

  const linhas = [
    { icone: CalendarDays, rotulo: "Data", valor: diaExtenso },
    { icone: Clock, rotulo: "Horário", valor: faixaHorario(item.dataHoraISO, item.duracaoMin) },
    {
      icone: Car,
      rotulo: "Veículo",
      valor: `${item.veiculoMarcaModelo} · ${item.segmento}`,
      extra: item.placa,
    },
    {
      icone: CreditCard,
      rotulo: "Pagamento",
      valor: FORMA_ROTULO[item.formaPagamento] ?? item.formaPagamento,
      extra: situacao,
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 animate-[escurecer_250ms_ease-out] bg-black/40 backdrop-blur-sm motion-reduce:animate-none"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-resumo"
        className="relative w-full max-w-sm animate-[subir_400ms_cubic-bezier(0.22,1,0.36,1)] rounded-3xl bg-white p-6 shadow-2xl motion-reduce:animate-none"
      >
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div
            className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2 text-white ${
              proximo ? "bg-astro-blue" : "bg-astro-bg"
            }`}
          >
            <span className="text-[0.6rem] font-medium opacity-70">{mes}</span>
            <span className="text-xl font-bold leading-none">{partesNoFuso(data).dia}</span>
            <span className="text-[0.6rem] opacity-50">{partesNoFuso(data).ano}</span>
          </div>
          <div className="min-w-0">
            <p className={`astro-label !text-[0.62rem] ${badge.cls}`}>• {badge.txt}</p>
            <h2 id="titulo-resumo" className="mt-0.5 font-bold leading-snug text-zinc-900">
              {item.servicoNome}
            </h2>
          </div>
        </div>

        <dl className="mt-5 divide-y divide-zinc-100 rounded-2xl bg-zinc-50 px-4">
          {linhas.map(({ icone: Icone, rotulo, valor, extra }) => (
            <div key={rotulo} className="flex items-start gap-3 py-3">
              <Icone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <dt className="w-20 shrink-0 text-sm text-zinc-500">{rotulo}</dt>
              <dd className="min-w-0 flex-1 text-right text-sm font-medium text-zinc-900">
                <span className="block first-letter:uppercase">{valor}</span>
                {extra && <span className="block text-xs font-normal text-zinc-500">{extra}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-end justify-between px-1">
          <span className="text-sm text-zinc-500">Valor</span>
          <span className="text-right">
            <span className="text-xl font-bold text-zinc-900">{BRL(item.valor)}</span>
            {item.acrescimoAplicado !== null && (
              <span className="block text-xs text-amber-600">
                + {BRL(item.acrescimoAplicado)} de acréscimo, pago no local
              </span>
            )}
          </span>
        </div>

        {pixAberto && (
          <Link
            href={`/${slug}/pagamento/${item.id}`}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_var(--color-astro-blue)] transition hover:brightness-110"
          >
            Ver código PIX
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        {item.cancelavel && (
          <button
            onClick={onCancelar}
            className={`${pixAberto ? "mt-2" : "mt-5"} w-full rounded-full py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50`}
          >
            Cancelar agendamento
          </button>
        )}
      </div>
    </div>,
    document.body,
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
  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long", timeZone: FUSO });
  const diaMes = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSO,
  });
  const faixa = faixaHorario(item.dataHoraISO, item.duracaoMin);
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short", timeZone: FUSO })
    .replace(".", "")
    .toUpperCase();

  // Vai direto para o <body>: dentro da pagina ficaria preso na camada do
  // fundo de pontos (o `isolate` da ClienteShell) e a barra do cliente, que
  // vem do layout, passaria por cima. Entra subindo, como o aviso da home.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 animate-[escurecer_250ms_ease-out] bg-black/40 backdrop-blur-sm motion-reduce:animate-none"
      />

      {/* Card */}
      <div className="relative w-full max-w-sm animate-[subir_400ms_cubic-bezier(0.22,1,0.36,1)] rounded-3xl bg-white p-6 text-center shadow-2xl motion-reduce:animate-none">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <Ban className="h-6 w-6 text-red-500" />
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
              {partesNoFuso(data).dia}
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
        {item.acrescimoAplicado !== null && (
          <span className="ml-1 text-xs font-normal text-amber-600">
            + {BRL(item.acrescimoAplicado)}
          </span>
        )}
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
    </div>,
    document.body,
  );
}
