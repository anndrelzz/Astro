"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SEGMENTOS = [
  { value: "HATCH", label: "Hatch" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "PICKUP", label: "Pickup" },
  { value: "VAN", label: "Van" },
];

// UC02 — cadastro de veiculo. RN04: apos salvar, retorna ao fluxo de
// agendamento (callbackUrl), quando acessado a partir do "Agendar".
export default function NovoVeiculoPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${slug}`;

  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    placa: "",
    ano: "",
    cor: "",
    segmento: "HATCH",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function handleChange(campo: string, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const resposta = await fetch("/api/veiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setCarregando(false);

    if (!resposta.ok) {
      setErro("Nao foi possivel cadastrar o veiculo. Confira os dados.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Cadastrar veiculo
        </h1>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <input
          type="text"
          placeholder="Marca"
          value={form.marca}
          onChange={(e) => handleChange("marca", e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="text"
          placeholder="Modelo"
          value={form.modelo}
          onChange={(e) => handleChange("modelo", e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="text"
          placeholder="Placa"
          value={form.placa}
          onChange={(e) => handleChange("placa", e.target.value.toUpperCase())}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="number"
          placeholder="Ano"
          value={form.ano}
          onChange={(e) => handleChange("ano", e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="text"
          placeholder="Cor"
          value={form.cor}
          onChange={(e) => handleChange("cor", e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={form.segmento}
          onChange={(e) => handleChange("segmento", e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {SEGMENTOS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-zinc-900 py-2 text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {carregando ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
