"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const SEGMENTOS = [
  { value: "HATCH", label: "Hatch" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "PICKUP", label: "Pickup" },
  { value: "VAN", label: "Van" },
];

// UC02, tela 08 — cadastro de veiculo. RN04: apos salvar, retorna ao fluxo
// de agendamento (callbackUrl) quando acessado a partir do "Agendar".
export default function NovoVeiculoPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${slug}`;

  const [form, setForm] = useState({
    segmento: "SUV",
    marca: "",
    modelo: "",
    placa: "",
    ano: "",
    cor: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function set(campo: string, valor: string) {
    setForm((a) => ({ ...a, [campo]: valor }));
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
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível cadastrar o veículo. Confira os dados.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-astro-blue focus:outline-none";

  return (
    <div className="min-h-screen bg-white">
      {/* Cabecalho escuro */}
      <div className="astro-dark px-5 pb-10 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href={callbackUrl}
            aria-label="Voltar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-semibold text-white">Novo veículo</h1>
          <span className="h-11 w-11" />
        </div>
      </div>

      {/* Formulario (sheet claro) */}
      <div className="mx-auto -mt-4 max-w-md rounded-t-3xl bg-white px-5 pb-10 pt-6">
        <p className="astro-label">Passo 01 · Dados do veículo</p>
        <h2 className="mt-1 text-2xl font-bold text-zinc-900">Cadastrar veículo</h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {erro}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="astro-label">Segmento</label>
            <select
              value={form.segmento}
              onChange={(e) => set("segmento", e.target.value)}
              className={inputCls}
            >
              {SEGMENTOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">Marca</label>
            <input
              className={inputCls}
              placeholder="Ex: Jeep"
              value={form.marca}
              onChange={(e) => set("marca", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">Modelo</label>
            <input
              className={inputCls}
              placeholder="Ex: Compass Limited"
              value={form.modelo}
              onChange={(e) => set("modelo", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">Placa</label>
            <input
              className={inputCls}
              placeholder="ABC-1234 ou ABC1D23"
              value={form.placa}
              onChange={(e) => set("placa", e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">Ano</label>
            <input
              type="number"
              className={inputCls}
              placeholder="2023"
              value={form.ano}
              onChange={(e) => set("ano", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">Cor</label>
            <input
              className={inputCls}
              placeholder="Ex: Preto Carbon"
              value={form.cor}
              onChange={(e) => set("cor", e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 w-full rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            {carregando ? "Salvando..." : "Cadastrar veículo"}
          </button>
        </form>
      </div>
    </div>
  );
}
