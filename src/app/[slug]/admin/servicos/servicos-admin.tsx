"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminHeader } from "../admin-header";
import { Modal } from "../modal";

// UC08, RF01 — catalogo de servicos com preco por segmento (mockup do admin).
//
// Criar e editar acontecem em modal, nao em painel lateral: a lista fica com a
// largura toda para as sete colunas, e o botao "Editar" em cada linha torna a
// acao visivel — clicar na linha era um gesto que nada na tela anunciava.

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  duracaoMin: number;
  precoHatch: number;
  precoSedan: number;
  precoSuv: number;
  precoPickup: number;
  precoVan: number;
  vendasNoMes: number;
};

type Rascunho = Omit<Servico, "id" | "vendasNoMes">;

const SEGMENTOS = [
  { chave: "precoHatch", rotulo: "Hatch" },
  { chave: "precoSedan", rotulo: "Sedan" },
  { chave: "precoSuv", rotulo: "SUV" },
  { chave: "precoPickup", rotulo: "Pickup" },
  { chave: "precoVan", rotulo: "Van" },
] as const;

// Teto do slider. Nao limita o valor: o campo numerico ao lado aceita acima
// disso; o slider so cobre a faixa comum de precos de estetica automotiva.
const TETO_SLIDER = 1500;

const VAZIO: Rascunho = {
  nome: "",
  descricao: "",
  ativo: true,
  duracaoMin: 60,
  precoHatch: 0,
  precoSedan: 0,
  precoSuv: 0,
  precoPickup: 0,
  precoVan: 0,
};

function formatarDuracao(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h 00`;
}

export function ServicosAdmin({ servicosIniciais }: { servicosIniciais: Servico[] }) {
  const router = useRouter();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ativos = servicosIniciais.filter((s) => s.ativo).length;
  const criando = editandoId === null;

  function abrirNovo() {
    setEditandoId(null);
    setRascunho(VAZIO);
    setErro(null);
    setSucesso(null);
    setModalAberto(true);
  }

  function abrirEdicao(s: Servico) {
    setEditandoId(s.id);
    setRascunho({
      nome: s.nome,
      descricao: s.descricao ?? "",
      ativo: s.ativo,
      duracaoMin: s.duracaoMin,
      precoHatch: s.precoHatch,
      precoSedan: s.precoSedan,
      precoSuv: s.precoSuv,
      precoPickup: s.precoPickup,
      precoVan: s.precoVan,
    });
    setErro(null);
    setSucesso(null);
    setModalAberto(true);
  }

  function fechar() {
    setModalAberto(false);
    setErro(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    const url = criando ? "/api/servicos" : `/api/servicos/${editandoId}`;
    const resposta = await fetch(url, {
      method: criando ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rascunho),
    });

    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel salvar o servico.");
      return;
    }

    setSucesso(criando ? "Servico criado." : "Servico salvo.");
    fechar();
    router.refresh();
  }

  async function remover() {
    if (!editandoId) return;
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    const resposta = await fetch(`/api/servicos/${editandoId}`, { method: "DELETE" });

    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      // A rota recusa remover servico com agendamento vinculado — apagar
      // destruiria o registro do que ja foi vendido. Pausar e a saida.
      setErro(
        json?.error ??
          "Nao foi possivel remover. Se ha agendamentos vinculados, pause o servico em vez de remover."
      );
      return;
    }

    setSucesso("Servico removido.");
    fechar();
    router.refresh();
  }

  return (
    <div>
      <AdminHeader
        trilha={`Catalogo · ${ativos} servico${ativos === 1 ? "" : "s"} ativo${ativos === 1 ? "" : "s"}`}
        titulo="Servicos"
        acao={
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 rounded-lg bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25"
          >
            <Plus className="h-4 w-4" />
            Novo servico
          </button>
        }
      />

      {erro && !modalAberto && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {sucesso}
        </p>
      )}

      {/* Lista com a largura toda */}
      <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-admin-border">
                <th className="astro-label px-4 py-3 text-left">Servico</th>
                {SEGMENTOS.map((s) => (
                  <th key={s.chave} className="astro-label w-20 px-2 py-3 text-right">
                    {s.rotulo}
                  </th>
                ))}
                <th className="astro-label w-20 px-4 py-3 text-right">Mes</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {servicosIniciais.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-admin-border/60 transition last:border-0 hover:bg-white/[0.03] ${
                    s.ativo ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{s.nome}</p>
                      {!s.ativo && (
                        <span className="flex items-center gap-1.5 rounded-full bg-admin-surface-2 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-astro-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-astro-muted" />
                          Pausado
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-astro-muted">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{formatarDuracao(s.duracaoMin)}</span>
                      {s.descricao && <span className="truncate">· {s.descricao}</span>}
                    </p>
                  </td>
                  {SEGMENTOS.map((seg) => (
                    <td
                      key={seg.chave}
                      className="px-2 py-3.5 text-right font-mono text-slate-200"
                    >
                      {s[seg.chave]}
                    </td>
                  ))}
                  <td className="px-4 py-3.5 text-right font-mono text-astro-muted">
                    {s.vendasNoMes}×
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => abrirEdicao(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-astro-blue hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {servicosIniciais.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-white">Nenhum servico cadastrado.</p>
            <p className="mt-1 text-sm text-astro-muted">
              Sem servico no catalogo, o cliente nao tem o que agendar.
            </p>
          </div>
        )}
      </div>

      {/* Modal de criar / editar */}
      <Modal
        aberto={modalAberto}
        onFechar={fechar}
        subtitulo={criando ? "Novo servico" : "Editar servico"}
        titulo={criando ? "Cadastrar servico" : rascunho.nome || "Sem nome"}
        rodape={
          <>
            {!criando && (
              <button
                type="button"
                onClick={remover}
                disabled={salvando}
                className="flex items-center gap-2 rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            )}
            <button
              type="button"
              onClick={fechar}
              className="ml-auto rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-servico"
              disabled={salvando}
              className="flex items-center gap-2 rounded-lg bg-astro-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-servico" onSubmit={salvar} className="space-y-4">
          {erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {erro}
            </p>
          )}

          <div>
            <label className="astro-label">Nome do servico</label>
            <input
              value={rascunho.nome}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label className="astro-label">Descricao</label>
            <textarea
              value={rascunho.descricao ?? ""}
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
              rows={3}
              maxLength={280}
              placeholder="Aparece no card do servico para o cliente"
              className="mt-1 w-full resize-none rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-slate-100 placeholder:text-astro-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="astro-label">Duracao (min)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={rascunho.duracaoMin}
                onChange={(e) =>
                  setRascunho({ ...rascunho, duracaoMin: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="astro-label">Status</label>
              <label className="mt-1 flex h-[38px] cursor-pointer items-center justify-between rounded-lg border border-admin-border bg-admin-bg px-3">
                <span className="text-sm text-slate-100">
                  {rascunho.ativo ? "Ativo" : "Pausado"}
                </span>
                <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={rascunho.ativo}
                    onChange={(e) => setRascunho({ ...rascunho, ativo: e.target.checked })}
                    className="peer sr-only"
                  />
                  <span className="h-5 w-9 rounded-full bg-admin-surface-2 transition peer-checked:bg-astro-blue" />
                  <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
                </span>
              </label>
            </div>
          </div>

          <div>
            <p className="astro-label">Preco por segmento de veiculo</p>
            <div className="mt-3 space-y-3">
              {SEGMENTOS.map((seg) => (
                <div key={seg.chave} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-sm text-slate-200">{seg.rotulo}</span>
                  <input
                    type="range"
                    min={0}
                    max={TETO_SLIDER}
                    step={10}
                    value={Math.min(rascunho[seg.chave], TETO_SLIDER)}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, [seg.chave]: Number(e.target.value) })
                    }
                    aria-label={`Preco para ${seg.rotulo}`}
                    className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-admin-surface-2 accent-astro-blue"
                  />
                  <div className="flex w-24 shrink-0 items-center gap-1 rounded-lg border border-admin-border bg-admin-bg px-2 py-1.5">
                    <span className="font-mono text-[0.65rem] text-astro-muted">R$</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={rascunho[seg.chave]}
                      onChange={(e) =>
                        setRascunho({ ...rascunho, [seg.chave]: Number(e.target.value) })
                      }
                      aria-label={`Valor para ${seg.rotulo}`}
                      className="w-full bg-transparent text-right font-mono text-sm text-slate-100 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
