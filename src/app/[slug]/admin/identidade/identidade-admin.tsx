"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Copy, Upload } from "lucide-react";

// UC12, RF13 — identidade visual da estetica (tela "Identidade visual" do
// mockup do admin). Antes esta secao vivia dentro de /configuracoes.
//
// Sem paleta de atalho: o seletor nativo abre a paleta completa do sistema
// (roda de cores + gradiente), entao o admin testa qualquer tom livremente
// em vez de escolher entre opcoes pre-fixadas.

// Formula de luminancia relativa do WCAG 2.1, com branco fixo do outro lado:
// e o texto que o app sobrepoe na cor primaria (botoes, nav ativa, etc.),
// nunca preto. Abaixo de 4.5:1 (AA para texto normal) o contraste fica ruim.
function contrasteComBranco(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminancia = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return 1.05 / (luminancia + 0.05);
}

const LIMITE_CONTRASTE_AA = 4.5;

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

  const contrasteBaixo = contrasteComBranco(cor) < LIMITE_CONTRASTE_AA;

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
          <p className="mt-1 text-sm text-astro-muted">
            Aplicada em botoes, links e destaques, no site do cliente e no Admin.
          </p>

          <label className="mt-4 flex cursor-pointer items-center gap-4 rounded-xl border border-admin-border bg-admin-bg p-4 transition hover:border-astro-blue/50">
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              aria-label="Escolher cor primaria"
              className="h-16 w-16 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-transparent p-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-lg font-semibold text-white">
                {cor.toUpperCase()}
              </p>
              <p className="text-sm text-astro-muted">
                Toque no quadrado para abrir a paleta completa
              </p>
            </div>
          </label>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2">
            <span className="astro-label">Hex</span>
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

          {contrasteBaixo && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Essa cor é muito clara para o texto branco dos botões — pode
              ficar difícil de ler no site e no Admin.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
