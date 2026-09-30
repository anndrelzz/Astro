"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, Pencil, Plus, Trash2, X } from "lucide-react";

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
  "w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-slate-100 placeholder:text-astro-muted";

// UC08, RF01, RN01 revisada — o catalogo da estetica numa grade so: os tipos de
// veiculo que ela atende sao as COLUNAS, os servicos sao as LINHAS, e a celula
// e o preco daquele servico para aquele tipo.
//
// O formato segue o trabalho real do Admin: ele preenche isso uma vez na
// implantacao e depois so reajusta precos. Reajuste e edicao de celula numa
// grade, nao sete formularios abertos um a um.
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Catálogo</h1>
        <p className="mt-1 text-sm text-astro-muted">
          Os tipos de veículo que você atende, seus serviços e o preço de cada
          combinação.
        </p>
      </div>

      {erro && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* ---------------------------------------------------------------
          Tipos de veiculo — as COLUNAS da grade abaixo.
          Ficam em cima porque definem a forma da tabela: sem tipo nenhum,
          nao ha onde por preco, e a grade nao tem o que mostrar.
          --------------------------------------------------------------- */}
      <section className="mb-6 rounded-2xl border border-admin-border bg-admin-surface p-5">
        <p className="astro-label">Tipos de veículo que você atende</p>
        <p className="mt-1 text-xs text-astro-muted">
          É o que o cliente escolhe ao cadastrar o carro, e o que define o preço.
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
              <span
                key={s.id}
                className="group flex items-center gap-2 rounded-full border border-admin-border bg-admin-bg py-1.5 pl-4 pr-2 text-sm text-slate-100"
              >
                {s.nome}
                <button
                  onClick={() => setRenomeando({ id: s.id, nome: s.nome })}
                  aria-label={`Renomear ${s.nome}`}
                  className="text-astro-muted transition hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => chamar(`/api/segmentos/${s.id}`, "DELETE")}
                  disabled={salvando}
                  aria-label={`Remover ${s.nome}`}
                  className="text-astro-muted transition hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            )
          )}

          {novoSegmento === null ? (
            <button
              onClick={() => setNovoSegmento("")}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-admin-border px-4 py-1.5 text-sm text-astro-muted transition hover:border-astro-blue hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar tipo
            </button>
          ) : (
            <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-admin-border bg-admin-bg p-3">
              <div className="min-w-[12rem] flex-1">
                <label className="astro-label">Nome</label>
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
                <label className="astro-label">Copiar preços de</label>
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
                className="rounded-lg bg-astro-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setNovoSegmento(null);
                  setCopiarDe("");
                }}
                className="rounded-lg border border-admin-border px-4 py-2 text-sm text-astro-muted"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------
          A grade: servicos nas linhas, tipos nas colunas.
          --------------------------------------------------------------- */}
      {segmentos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-admin-border px-5 py-8 text-center text-sm text-astro-muted">
          Cadastre ao menos um tipo de veículo para começar a montar o catálogo.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-admin-border">
                  <th className="astro-label px-4 py-3 text-left">Serviço</th>
                  {segmentos.map((s) => (
                    <th key={s.id} className="astro-label w-24 px-2 py-3 text-right">
                      {s.nome}
                    </th>
                  ))}
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
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
                      {/* So a duracao. A descricao sai daqui: e o texto mais
                          longo da linha e empurrava as colunas de preco, que
                          sao o que se olha nesta tela. Ela continua sendo
                          editada no modal e exibida ao cliente na vitrine. */}
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-astro-muted">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{formatarDuracao(s.duracaoMin)}</span>
                      </p>
                    </td>
                    {segmentos.map((seg) => {
                      const valor = s.precos[seg.id];
                      return (
                        <td
                          key={seg.id}
                          className="px-2 py-3.5 text-right font-mono text-slate-200"
                        >
                          {/* Zero aqui quase sempre significa "tipo recem-criado
                              e ainda nao precificado", nao "de graca" — por isso
                              aparece destacado, e nao como R$ 0,00 normal. */}
                          {valor === undefined || valor === 0 ? (
                            <span className="text-amber-400/80">a definir</span>
                          ) : (
                            valor.toFixed(2).replace(".", ",")
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setServicoEdit(s)}
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

          <div className="border-t border-admin-border p-4">
            <button
              onClick={() => setServicoEdit(servicoVazio)}
              className="flex items-center gap-1.5 rounded-lg bg-astro-blue px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Novo serviço
            </button>
          </div>
        </div>
      )}

      {/* Edicao do servico: dados + a coluna de precos daquela linha. */}
      {servicoEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-admin-border bg-admin-surface p-5 sm:rounded-2xl">
            <h2 className="text-lg font-bold text-white">
              {servicoEdit.id === "" ? "Novo serviço" : servicoEdit.nome}
            </h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="astro-label">Nome do serviço</label>
                <input
                  value={servicoEdit.nome}
                  onChange={(e) =>
                    setServicoEdit({ ...servicoEdit, nome: e.target.value })
                  }
                  className={`${inputCls} mt-1`}
                />
              </div>

              <div>
                <label className="astro-label">Descrição</label>
                <textarea
                  rows={2}
                  value={servicoEdit.descricao ?? ""}
                  onChange={(e) =>
                    setServicoEdit({ ...servicoEdit, descricao: e.target.value })
                  }
                  placeholder="Aparece no card do serviço para o cliente"
                  className={`${inputCls} mt-1 resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="astro-label">Duração (min)</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={servicoEdit.duracaoMin}
                    onChange={(e) =>
                      setServicoEdit({
                        ...servicoEdit,
                        duracaoMin: Number(e.target.value),
                      })
                    }
                    className={`${inputCls} mt-1`}
                  />
                </div>
                <div>
                  <label className="astro-label">Status</label>
                  <label className="mt-1 flex h-[38px] cursor-pointer items-center justify-between rounded-lg border border-admin-border bg-admin-bg px-3">
                    <span className="text-sm text-slate-100">
                      {servicoEdit.ativo ? "Ativo" : "Pausado"}
                    </span>
                    <input
                      type="checkbox"
                      checked={servicoEdit.ativo}
                      onChange={(e) =>
                        setServicoEdit({ ...servicoEdit, ativo: e.target.checked })
                      }
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="astro-label">Preço por tipo de veículo</p>
                <div className="mt-2 space-y-2">
                  {segmentos.map((seg) => (
                    <div key={seg.id} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-slate-200">{seg.nome}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={servicoEdit.precos[seg.id] ?? 0}
                        onChange={(e) =>
                          setServicoEdit({
                            ...servicoEdit,
                            precos: {
                              ...servicoEdit.precos,
                              [seg.id]: Number(e.target.value),
                            },
                          })
                        }
                        className={`${inputCls} w-32 text-right font-mono`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={salvarServico}
                disabled={salvando || !servicoEdit.nome.trim()}
                className="flex-1 rounded-lg bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => setServicoEdit(null)}
                className="rounded-lg border border-admin-border px-4 py-2.5 text-sm text-astro-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
