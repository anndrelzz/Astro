"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Copy, Upload } from "lucide-react";

// UC12, RF13 — identidade visual da estetica (tela "Identidade visual" do
// mockup do admin). Antes esta secao vivia dentro de /configuracoes.
//
// A paleta de atalho reproduz a do mockup; o seletor de cor livre continua
// disponivel, entao o admin nao fica preso as opcoes sugeridas.

const PALETA = [
  "#2563eb",
  "#ea580c",
  "#a855f7",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#3f3f46",
];

export function IdentidadeAdmin({
  logoUrlInicial,
  corInicial,
  tenantNome,
}: {
  logoUrlInicial: string | null;
  corInicial: string;
  tenantNome: string;
}) {
  const router = useRouter();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
  const [cor, setCor] = useState(corInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function enviarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setSucesso(null);
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
      setErro(json?.error ?? "Nao foi possivel enviar o logo.");
      return;
    }

    const json = await resposta.json();
    setLogoUrl(json.logoUrl);
    setSucesso("Logo atualizado.");
    router.refresh();
  }

  // Envia apenas a cor: a rota aceita atualizacao parcial, entao a chave PIX e
  // as demais configuracoes ficam intocadas.
  async function salvarCor() {
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    const resposta = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corPrimaria: cor }),
    });

    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel salvar a cor.");
      return;
    }
    setSucesso("Identidade visual publicada.");
    router.refresh();
  }

  async function copiarHex() {
    try {
      await navigator.clipboard.writeText(cor.toUpperCase());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponivel - ignora */
    }
  }

  const iniciais = tenantNome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-astro-muted">
          Aplicada no site publico que o cliente enxerga.
        </p>
        <button
          onClick={salvarCor}
          disabled={salvando}
          className="flex items-center gap-2 rounded-lg bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {salvando ? "Publicando..." : "Publicar alteracoes"}
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {sucesso}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Logo */}
        <section className="rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
          <p className="astro-label">Logo</p>

          <div className="mt-4 flex items-center justify-center rounded-xl border border-admin-border bg-admin-bg p-8">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${tenantNome}`}
                className="max-h-24 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-astro-blue text-sm font-semibold text-white">
                  {iniciais}
                </span>
                <div>
                  <p className="font-semibold text-white">{tenantNome}</p>
                  <p className="astro-label">Sem logo enviado</p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={inputArquivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={enviarLogo}
            className="hidden"
          />
          <button
            onClick={() => inputArquivo.current?.click()}
            disabled={enviandoLogo}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-admin-border bg-admin-surface-2 py-2.5 text-sm font-semibold text-slate-100 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {enviandoLogo ? "Enviando..." : logoUrl ? "Substituir logo" : "Enviar logo"}
          </button>
          <p className="mt-2 text-center font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted">
            PNG, JPG ou WEBP · ate 2MB · fundo transparente recomendado
          </p>
        </section>

        {/* Cor primaria */}
        <section className="rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
          <p className="astro-label">Cor primaria</p>

          <div className="mt-4 flex items-center gap-4 rounded-xl border border-admin-border bg-admin-bg p-4">
            <span
              className="h-14 w-14 shrink-0 rounded-xl border border-white/10"
              style={{ backgroundColor: cor }}
            />
            <div className="min-w-0">
              <p className="font-mono text-lg font-semibold text-white">
                {cor.toUpperCase()}
              </p>
              <p className="text-sm text-astro-muted">
                Aplicada em botoes, links e destaques
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {PALETA.map((opcao) => {
              const ativa = opcao.toLowerCase() === cor.toLowerCase();
              return (
                <button
                  key={opcao}
                  onClick={() => setCor(opcao)}
                  aria-label={`Usar a cor ${opcao}`}
                  style={{ backgroundColor: opcao }}
                  className={
                    ativa
                      ? "flex h-10 w-10 items-center justify-center rounded-lg ring-2 ring-white ring-offset-2 ring-offset-astro-surface"
                      : "h-10 w-10 rounded-lg"
                  }
                >
                  {ativa && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2">
            <span className="astro-label">Hex</span>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              aria-label="Escolher cor livre"
              className="h-7 w-9 shrink-0 rounded border border-admin-border bg-transparent"
            />
            <span className="flex-1 font-mono text-sm text-slate-100">
              {cor.toUpperCase()}
            </span>
            <button
              onClick={copiarHex}
              className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted hover:text-white"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
