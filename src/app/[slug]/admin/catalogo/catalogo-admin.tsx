"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { LIMITES } from "@/lib/validations/limites";
import { FundoOndas } from "../fundo-ondas";
import { Modal } from "../modal";

type Segmento = { id: string; nome: string; ordem: number };

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  duracaoMin: number;
  precos: Record<string, number>;
};

function formatarDuracao(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

const inputCls =
  "w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2.5 text-sm text-slate-100 placeholder:text-astro-muted";

// Tempos mais comuns, escolhidos com um toque no modal. Qualquer outro valor
// continua possivel pelo "Outro".
const DURACOES = [30, 40, 45, 60, 90, 120, 180, 240, 300];

// UC08, RF01, RN01 revisada — o catalogo da estetica: os tipos de veiculo que
// ela atende, e um card por servico com a duracao, a faixa de preco e o preco
// de cada tipo. Clicar no card abre o modal com tudo que se edita no servico.
export function CatalogoAdmin({
  segmentos,
  servicos,
}: {
  segmentos: Segmento[];
  servicos: Servico[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Segmento sendo criado/renomeado, e servico sendo editado.
  const [novoSegmento, setNovoSegmento] = useState<string | null>(null);
  const [copiarDe, setCopiarDe] = useState<string>("");
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [servicoEdit, setServicoEdit] = useState<Servico | null>(null);
  // Duracao fora da lista de DURACOES: mostra o campo livre no modal.
  const [duracaoLivre, setDuracaoLivre] = useState(false);

  async function chamar(url: string, metodo: string, corpo?: unknown) {
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(url, {
        method: metodo,
        headers: corpo ? { "Content-Type": "application/json" } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.error ?? "Nao foi possivel salvar");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErro("Falha de conexao");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function criarSegmento() {
    const nome = novoSegmento?.trim();
    if (!nome) return;
    const ok = await chamar("/api/segmentos", "POST", {
      nome,
      ordem: segmentos.length,
      copiarPrecosDe: copiarDe || null,
    });
    if (ok) {
      setNovoSegmento(null);
      setCopiarDe("");
    }
  }

  async function salvarServico() {
    if (!servicoEdit) return;
    const corpo = {
      nome: servicoEdit.nome,
      descricao: servicoEdit.descricao ?? undefined,
      ativo: servicoEdit.ativo,
      duracaoMin: servicoEdit.duracaoMin,
      precos: segmentos.map((s) => ({
        segmentoId: s.id,
        valor: servicoEdit.precos[s.id] ?? 0,
      })),
    };
    const novo = servicoEdit.id === "";
    const ok = await chamar(
      novo ? "/api/servicos" : `/api/servicos/${servicoEdit.id}`,
      novo ? "POST" : "PATCH",
      corpo
    );
    if (ok) setServicoEdit(null);
  }

  const servicoVazio: Servico = {
    id: "",
    nome: "",
    descricao: null,
    ativo: true,
    duracaoMin: 60,
    precos: Object.fromEntries(segmentos.map((s) => [s.id, 0])),
  };

  function editar(s: Servico) {
    setServicoEdit(s);
    setDuracaoLivre(!DURACOES.includes(s.duracaoMin));
  }

  const ativos = servicos.filter((s) => s.ativo).length;
  const pausados = servicos.length - ativos;

  return (
    <div>
      <FundoOndas />

      {/* Topo no padrao do Dashboard: titulo direto, sem capa. */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Catálogo</h1>
          <p className="mt-1.5 text-astro-muted">
            Os serviços que você oferece e quanto custa cada um, por tipo de veículo.
          </p>
        </div>
        {segmentos.length > 0 && (
          <button
            type="button"
            onClick={() => editar(servicoVazio)}
            className="flex items-center gap-2 rounded-full bg-astro-blue px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_var(--color-astro-blue)] transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </button>
        )}
      </div>

      {erro && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* ---------------------------------------------------------------
          Tipos de veiculo. Ficam em cima porque definem os precos: sem
          tipo nenhum, nao ha onde por preco.
          --------------------------------------------------------------- */}
      {/* Mesmo cartao do faturamento no Dashboard: degrade da cor da
          estetica, aneis no canto e a luz correndo na borda. */}
      <section
        className="borda-viva relative mb-8 overflow-hidden rounded-3xl p-5 text-white sm:p-6"
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

        <div className="relative">
          <h2 className="text-base font-semibold text-white">Tipos de veículo</h2>
          <p className="mt-0.5 text-sm text-white/75">
            O cliente escolhe um deles ao cadastrar o carro, e é ele que define o preço.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {segmentos.map((s) =>
              renomeando?.id === s.id ? (
                <span key={s.id} className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={renomeando.nome}
                    onChange={(e) => setRenomeando({ id: s.id, nome: e.target.value })}
                    className={`${inputCls} w-40`}
                  />
                  <button
                    onClick={async () => {
                      const ok = await chamar(`/api/segmentos/${s.id}`, "PATCH", {
                        nome: renomeando.nome.trim(),
                      });
                      if (ok) setRenomeando(null);
                    }}
                    disabled={salvando}
                    aria-label="Salvar nome"
                    className="rounded-lg bg-astro-blue p-2 text-white disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setRenomeando(null)}
                    aria-label="Cancelar"
                    className="rounded-lg border border-admin-border p-2 text-astro-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                // Os icones so aparecem no hover (e no foco por teclado, senao
                // some para quem navega por Tab). Com muitos tipos cadastrados,
                // dois icones em cada pastilha viram ruido — a acao e ocasional,
                // o nome e o que se le o tempo todo.
                <span
                  key={s.id}
                  className="group flex min-h-10 items-center rounded-full border border-white/20 bg-white/[0.12] py-1.5 pr-2 pl-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/[0.18]"
                >
                  {s.nome}
                  <span className="ml-1 flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={() => setRenomeando({ id: s.id, nome: s.nome })}
                      aria-label={`Renomear ${s.nome}`}
                      className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => chamar(`/api/segmentos/${s.id}`, "DELETE")}
                      disabled={salvando}
                      aria-label={`Remover ${s.nome}`}
                      className="rounded-full p-1 text-white/70 transition hover:bg-red-500/25 hover:text-red-200 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </span>
              )
            )}

            {novoSegmento === null ? (
              <button
                onClick={() => setNovoSegmento("")}
                className="flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-white/40 px-4 py-1.5 text-sm text-white/80 transition hover:border-white hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar tipo
              </button>
            ) : (
              <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-admin-border bg-admin-bg p-3">
                <div className="min-w-[12rem] flex-1">
                  <label className="text-sm text-astro-muted">Nome</label>
                  <input
                    autoFocus
                    value={novoSegmento}
                    onChange={(e) => setNovoSegmento(e.target.value)}
                    placeholder="Picape grande"
                    className={`${inputCls} mt-1`}
                  />
                </div>
                {/* Todo servico precisa de preco para todo tipo. Copiar de um tipo
                    parecido evita digitar um preco por servico, e o Admin ajusta
                    so o que difere. */}
                <div className="min-w-[12rem] flex-1">
                  <label className="text-sm text-astro-muted">Copiar preços de</label>
                  <select
                    value={copiarDe}
                    onChange={(e) => setCopiarDe(e.target.value)}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">Começar do zero</option>
                    {segmentos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={criarSegmento}
                  disabled={salvando || !novoSegmento.trim()}
                  className="rounded-full bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => {
                    setNovoSegmento(null);
                    setCopiarDe("");
                  }}
                  className="rounded-full border border-admin-border px-4 py-2.5 text-sm text-astro-muted"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Servicos em cards. O card resume (duracao, faixa de preco e o
          preco de cada tipo); clicar em qualquer parte dele abre a edicao.
          --------------------------------------------------------------- */}
      {segmentos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-admin-border px-5 py-8 text-center text-sm text-astro-muted">
          Cadastre ao menos um tipo de veículo para começar a montar o catálogo.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Serviços</h2>
            <span className="text-sm text-astro-muted">
              {ativos} {ativos === 1 ? "ativo" : "ativos"}
              {pausados > 0 && ` · ${pausados} ${pausados === 1 ? "pausado" : "pausados"}`}
            </span>
          </div>

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
            {servicos.map((s) => (
              <CardServico key={s.id} servico={s} segmentos={segmentos} onEditar={() => editar(s)} />
            ))}

            <button
              type="button"
              onClick={() => editar(servicoVazio)}
              className="group flex min-h-56 flex-col items-center justify-center gap-2.5 rounded-3xl border border-dashed border-white/20 bg-black/20 font-semibold backdrop-blur-sm text-astro-muted transition hover:border-astro-blue/60 hover:text-white"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.08] transition group-hover:bg-astro-blue group-hover:text-white">
                <Plus className="h-5 w-5" />
              </span>
              Novo serviço
            </button>
          </div>
        </>
      )}

      {/* Edicao do servico: dados + o preco de cada tipo. */}
      <Modal
        aberto={servicoEdit !== null}
        onFechar={() => setServicoEdit(null)}
        titulo={servicoEdit?.id === "" ? "Novo serviço" : (servicoEdit?.nome ?? "")}
        rodape={
          <>
            <button
              type="button"
              onClick={() => setServicoEdit(null)}
              className="ml-auto rounded-full border border-admin-border px-5 py-2.5 text-sm text-astro-muted transition hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarServico}
              disabled={salvando || !servicoEdit?.nome.trim()}
              className="rounded-full bg-astro-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {servicoEdit && (
          <div className="grid gap-5">
            <div className="grid gap-3">
              <label className="block text-sm text-astro-muted">
                Nome do serviço
                <input
                  value={servicoEdit.nome}
                  maxLength={LIMITES.nomeServico}
                  onChange={(e) => setServicoEdit({ ...servicoEdit, nome: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </label>
              <label className="block text-sm text-astro-muted">
                Descrição
                <textarea
                  rows={2}
                  value={servicoEdit.descricao ?? ""}
                  onChange={(e) => setServicoEdit({ ...servicoEdit, descricao: e.target.value })}
                  placeholder="Aparece para o cliente na hora de agendar"
                  className={`${inputCls} mt-1.5 resize-none`}
                />
              </label>
            </div>

            {/* Duracao: os tempos comuns em um toque; "Outro" abre o campo
                para qualquer valor (de 5 em 5 minutos, como antes). */}
            <div role="group" className="border-t border-white/10 pt-4">
              <p className="mb-2.5 text-sm font-semibold text-white">Quanto tempo leva</p>
              <div className="flex flex-wrap gap-1.5">
                {DURACOES.map((d) => {
                  const marcado = !duracaoLivre && servicoEdit.duracaoMin === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => {
                        setDuracaoLivre(false);
                        setServicoEdit({ ...servicoEdit, duracaoMin: d });
                      }}
                      className={`min-h-9 rounded-full border px-3 font-mono text-[0.8rem] font-semibold transition ${
                        marcado
                          ? "border-transparent bg-astro-blue text-white"
                          : "border-admin-border text-astro-muted hover:text-white"
                      }`}
                    >
                      {formatarDuracao(d)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={duracaoLivre}
                  onClick={() => setDuracaoLivre(true)}
                  className={`min-h-9 rounded-full border px-3 text-[0.8rem] font-semibold transition ${
                    duracaoLivre
                      ? "border-transparent bg-astro-blue text-white"
                      : "border-admin-border text-astro-muted hover:text-white"
                  }`}
                >
                  Outro
                </button>
              </div>
              {duracaoLivre && (
                <label className="mt-3 flex items-center gap-2 text-sm text-astro-muted">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={servicoEdit.duracaoMin}
                    onChange={(e) => setServicoEdit({ ...servicoEdit, duracaoMin: Number(e.target.value) })}
                    className={`${inputCls} w-28 text-right font-mono`}
                  />
                  minutos
                  <span className="font-mono text-slate-300">= {formatarDuracao(servicoEdit.duracaoMin || 0)}</span>
                </label>
              )}
            </div>

            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                role="switch"
                aria-checked={servicoEdit.ativo}
                onClick={() => setServicoEdit({ ...servicoEdit, ativo: !servicoEdit.ativo })}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-admin-border bg-black/40 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {servicoEdit.ativo ? "Ativo" : "Pausado"}
                  </span>
                  <span className="block text-xs text-astro-muted">
                    {servicoEdit.ativo
                      ? "Aparece para o cliente agendar"
                      : "Fica escondido do cliente até você reativar"}
                  </span>
                </span>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    servicoEdit.ativo ? "bg-emerald-500" : "bg-zinc-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      servicoEdit.ativo ? "translate-x-5" : ""
                    }`}
                  />
                </span>
              </button>
            </div>

            <div role="group" className="border-t border-white/10 pt-4">
              <p className="mb-2.5 text-sm font-semibold text-white">Preço por tipo de veículo</p>
              <div className="grid gap-2">
                {segmentos.map((seg) => (
                  <label key={seg.id} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3">
                    <span className="truncate text-sm text-slate-200">{seg.nome}</span>
                    <span className="flex items-center rounded-lg border border-admin-border bg-admin-bg px-3 focus-within:border-astro-blue">
                      <span className="text-xs text-astro-muted">R$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={servicoEdit.precos[seg.id] ?? 0}
                        onChange={(e) =>
                          setServicoEdit({
                            ...servicoEdit,
                            precos: { ...servicoEdit.precos, [seg.id]: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-transparent py-2 pl-2 text-right font-mono text-sm font-semibold text-white outline-none"
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function reais(valor: number) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function CardServico({
  servico: s,
  segmentos,
  onEditar,
}: {
  servico: Servico;
  segmentos: Segmento[];
  onEditar: () => void;
}) {
  const definidos = segmentos.map((seg) => s.precos[seg.id] ?? 0).filter((v) => v > 0);
  const min = Math.min(...definidos);
  const max = Math.max(...definidos);

  return (
    <button
      type="button"
      onClick={onEditar}
      aria-label={`Editar ${s.nome}`}
      className={`vidro group relative flex min-h-56 flex-col gap-3.5 rounded-3xl p-5 text-left transition hover:-translate-y-0.5 hover:!border-astro-blue-bright/60 ${
        s.ativo ? "" : "opacity-55 hover:opacity-85"
      }`}
    >
      <span className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-white/15 text-astro-muted transition group-hover:border-transparent group-hover:bg-astro-blue group-hover:text-white">
        <Pencil className="h-4 w-4" />
      </span>

      <span className="block pr-11">
        <span className="block text-[1.05rem] leading-snug font-bold tracking-tight text-white">{s.nome}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-xs font-semibold text-astro-muted">
            <Clock className="h-3 w-3" />
            {formatarDuracao(s.duracaoMin)}
          </span>
          {!s.ativo && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Pausado
            </span>
          )}
        </span>
      </span>

      {s.descricao && <span className="line-clamp-2 text-sm text-astro-muted">{s.descricao}</span>}

      <span className="mt-auto block">
        <span className="block text-xs text-astro-muted">Preço</span>
        {definidos.length === 0 ? (
          <span className="text-lg font-semibold text-amber-300">A definir</span>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-white">
            R$ {reais(min)}
            {max !== min && (
              <>
                <span className="mx-1.5 text-base font-medium text-astro-muted">a</span>R$ {reais(max)}
              </>
            )}
          </span>
        )}
      </span>

      {/* Zero aqui quase sempre significa "tipo recem-criado e ainda nao
          precificado", nao "de graca" — por isso aparece como "a definir". */}
      <span className="flex flex-wrap gap-x-3 gap-y-1 border-t border-dashed border-white/15 pt-3 text-xs text-astro-muted">
        {segmentos.map((seg) => {
          const valor = s.precos[seg.id] ?? 0;
          return (
            <span key={seg.id}>
              {seg.nome}{" "}
              {valor > 0 ? (
                <b className="font-mono font-semibold text-slate-200">{reais(valor)}</b>
              ) : (
                <b className="font-semibold text-amber-300">a definir</b>
              )}
            </span>
          );
        })}
      </span>
    </button>
  );
}
