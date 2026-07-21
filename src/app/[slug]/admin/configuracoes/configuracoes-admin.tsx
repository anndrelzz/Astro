"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Config = {
  pixChaveCopiaCola: string;
  cancelamentoHorasLimite: number;
  capacidadeSimultanea: number;
  intervaloMinutos: number;
  corPrimaria: string;
};

type HorarioDia = {
  diaSemana: number;
  nome: string;
  ativo: boolean;
  horaInicio: string;
  horaFim: string;
};

export function ConfiguracoesAdmin({
  configInicial,
  horariosIniciais,
  logoUrlInicial,
}: {
  configInicial: Config;
  horariosIniciais: HorarioDia[];
  logoUrlInicial: string | null;
}) {
  const router = useRouter();
  const [config, setConfig] = useState(configInicial);
  const [horarios, setHorarios] = useState(horariosIniciais);
  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [erroHorarios, setErroHorarios] = useState<string | null>(null);
  const [erroLogo, setErroLogo] = useState<string | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [salvandoHorarios, setSalvandoHorarios] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function enviarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErroLogo(null);
    setEnviandoLogo(true);

    const formData = new FormData();
    formData.append("logo", arquivo);

    const resposta = await fetch("/api/tenant/logo", {
      method: "POST",
      body: formData,
    });

    setEnviandoLogo(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErroLogo(json?.error ?? "Nao foi possivel enviar o logo.");
      return;
    }

    const json = await resposta.json();
    setLogoUrl(json.logoUrl);
    router.refresh();
  }

  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault();
    setErroConfig(null);
    setSucesso(null);
    setSalvandoConfig(true);

    const resposta = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    setSalvandoConfig(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErroConfig(json?.error ?? "Nao foi possivel salvar.");
      return;
    }
    setSucesso("Configuracoes salvas.");
    router.refresh();
  }

  async function salvarHorarios(e: React.FormEvent) {
    e.preventDefault();
    setErroHorarios(null);
    setSucesso(null);
    setSalvandoHorarios(true);

    const resposta = await fetch("/api/tenant/horarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        horarios.map(({ diaSemana, ativo, horaInicio, horaFim }) => ({
          diaSemana,
          ativo,
          horaInicio,
          horaFim,
        }))
      ),
    });

    setSalvandoHorarios(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErroHorarios(json?.error ?? "Nao foi possivel salvar.");
      return;
    }
    setSucesso("Grade de horarios salva.");
    router.refresh();
  }

  function atualizarDia(diaSemana: number, campo: keyof HorarioDia, valor: string | boolean) {
    setHorarios((atual) =>
      atual.map((h) => (h.diaSemana === diaSemana ? { ...h, [campo]: valor } : h))
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

      <div className="max-w-md space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Identidade visual (RF13)
        </h2>
        {erroLogo && <p className="text-sm text-red-600">{erroLogo}</p>}

        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da estetica"
              className="h-16 w-16 rounded object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-500 dark:border-zinc-700">
              Sem logo
            </div>
          )}
          <div>
            <label className="block text-sm text-zinc-600 dark:text-zinc-400">
              Enviar logo (PNG, JPG, WEBP ou SVG - max. 2MB)
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={enviarLogo}
              disabled={enviandoLogo}
              className="mt-1 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Cor primaria
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={config.corPrimaria}
              onChange={(e) => setConfig({ ...config, corPrimaria: e.target.value })}
              className="h-9 w-14 rounded border border-zinc-300 dark:border-zinc-700"
            />
            <span className="text-sm text-zinc-500">{config.corPrimaria}</span>
          </div>
        </div>
      </div>

      <form
        onSubmit={salvarConfig}
        className="max-w-md space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Pagamento e cancelamento
        </h2>
        {erroConfig && <p className="text-sm text-red-600">{erroConfig}</p>}

        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Chave PIX Copia e Cola (RF17 — vazio desativa PIX, RN10)
          </label>
          <input
            value={config.pixChaveCopiaCola}
            onChange={(e) =>
              setConfig({ ...config, pixChaveCopiaCola: e.target.value })
            }
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Antecedencia minima para cancelamento (horas) — RF18
          </label>
          <input
            type="number"
            min={0}
            value={config.cancelamentoHorasLimite}
            onChange={(e) =>
              setConfig({
                ...config,
                cancelamentoHorasLimite: Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Capacidade simultanea de atendimentos — RN06
          </label>
          <input
            type="number"
            min={1}
            value={config.capacidadeSimultanea}
            onChange={(e) =>
              setConfig({
                ...config,
                capacidadeSimultanea: Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Intervalo entre horarios (minutos)
          </label>
          <input
            type="number"
            min={5}
            step={5}
            value={config.intervaloMinutos}
            onChange={(e) =>
              setConfig({ ...config, intervaloMinutos: Number(e.target.value) })
            }
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          disabled={salvandoConfig}
          className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {salvandoConfig ? "Salvando..." : "Salvar configuracoes"}
        </button>
      </form>

      <form
        onSubmit={salvarHorarios}
        className="max-w-2xl space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Grade de horarios (RF02)
        </h2>
        {erroHorarios && <p className="text-sm text-red-600">{erroHorarios}</p>}

        <div className="space-y-2">
          {horarios.map((dia) => (
            <div key={dia.diaSemana} className="flex items-center gap-3 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input
                  type="checkbox"
                  checked={dia.ativo}
                  onChange={(e) =>
                    atualizarDia(dia.diaSemana, "ativo", e.target.checked)
                  }
                />
                {dia.nome}
              </label>
              <input
                type="time"
                value={dia.horaInicio}
                disabled={!dia.ativo}
                onChange={(e) =>
                  atualizarDia(dia.diaSemana, "horaInicio", e.target.value)
                }
                className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span>ate</span>
              <input
                type="time"
                value={dia.horaFim}
                disabled={!dia.ativo}
                onChange={(e) =>
                  atualizarDia(dia.diaSemana, "horaFim", e.target.value)
                }
                className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={salvandoHorarios}
          className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {salvandoHorarios ? "Salvando..." : "Salvar grade de horarios"}
        </button>
      </form>
    </div>
  );
}
