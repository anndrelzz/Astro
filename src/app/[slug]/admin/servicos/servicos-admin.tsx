"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Servico = {
  id: string;
  nome: string;
  duracaoMin: number;
  precoHatch: number;
  precoSedan: number;
  precoSuv: number;
  precoPickup: number;
  precoVan: number;
};

const CAMPOS_PRECO: { chave: keyof Servico; label: string }[] = [
  { chave: "precoHatch", label: "Hatch" },
  { chave: "precoSedan", label: "Sedan" },
  { chave: "precoSuv", label: "SUV" },
  { chave: "precoPickup", label: "Pickup" },
  { chave: "precoVan", label: "Van" },
];

const VAZIO = {
  nome: "",
  duracaoMin: "60",
  precoHatch: "",
  precoSedan: "",
  precoSuv: "",
  precoPickup: "",
  precoVan: "",
};

export function ServicosAdmin({
  servicosIniciais,
}: {
  servicosIniciais: Servico[];
}) {
  const router = useRouter();
  const [servicos, setServicos] = useState(servicosIniciais);
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const resposta = await fetch("/api/servicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setCarregando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel salvar.");
      return;
    }

    const novo = await resposta.json();
    setServicos((atual) => [
      ...atual,
      {
        ...novo,
        precoHatch: Number(novo.precoHatch),
        precoSedan: Number(novo.precoSedan),
        precoSuv: Number(novo.precoSuv),
        precoPickup: Number(novo.precoPickup),
        precoVan: Number(novo.precoVan),
      },
    ]);
    setForm(VAZIO);
    router.refresh();
  }

  async function remover(id: string) {
    setErro(null);
    const resposta = await fetch(`/api/servicos/${id}`, { method: "DELETE" });
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel remover.");
      return;
    }
    setServicos((atual) => atual.filter((s) => s.id !== id));
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-8">
      <ul className="space-y-3">
        {servicos.map((servico) => (
          <li
            key={servico.id}
            className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {servico.nome} — {servico.duracaoMin} min
              </span>
              <button
                onClick={() => remover(servico.id)}
                className="rounded border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
              >
                Remover
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-zinc-600 dark:text-zinc-400">
              {CAMPOS_PRECO.map((c) => (
                <span key={c.chave}>
                  {c.label}: R$ {Number(servico[c.chave]).toFixed(2)}
                </span>
              ))}
            </div>
          </li>
        ))}
        {servicos.length === 0 && (
          <li className="text-zinc-500">Nenhum servico cadastrado ainda.</li>
        )}
      </ul>

      <form
        onSubmit={criar}
        className="max-w-lg space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Novo servico
        </h2>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <input
          placeholder="Nome do servico"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="number"
          placeholder="Duracao (min)"
          value={form.duracaoMin}
          onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="grid grid-cols-2 gap-2">
          {CAMPOS_PRECO.map((c) => (
            <input
              key={c.chave}
              type="number"
              step="0.01"
              placeholder={`Preco ${c.label}`}
              value={form[c.chave as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [c.chave]: e.target.value })}
              required
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {carregando ? "Salvando..." : "Adicionar servico"}
        </button>
      </form>
    </div>
  );
}
