"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Lock, Upload } from "lucide-react";
import { AdminHeader } from "../admin-header";

// UC13, UC14, RF13, RF17, RF18, RN06 — configuracoes gerais da estetica.
//
// Secoes numeradas com um menu de atalho a esquerda, como no mockup. Um unico
// botao "Salvar alteracoes" no topo envia tudo; a rota aceita atualizacao
// parcial, entao o que nao mudou continua intocado no banco.
//
// Nao entram aqui, por decisao registrada:
//   - Equipe e acessos, Plano e cobranca — Fora do Escopo (RFC 2.6)
//   - Notificacoes ao Admin — o sistema hoje so notifica o cliente; seriam
//     interruptores para um envio que nao existe
//   - CNPJ, razao social, inscricao estadual — sem emissao fiscal (RFC 2.6),
//     nenhum consumidor leria esses campos

type Config = {
  nome: string;
  descricao: string;
  telefone: string;
  whatsapp: string;
  emailContato: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  pixChaveCopiaCola: string;
  cancelamentoHorasLimite: number;
  capacidadeSimultanea: number;
  intervaloMinutos: number;
};

const SECOES = [
  { id: "gerais", rotulo: "Informacoes gerais" },
  { id: "endereco", rotulo: "Endereco" },
  { id: "publica", rotulo: "Pagina publica" },
  { id: "identidade", rotulo: "Identidade visual" },
  { id: "pagamento", rotulo: "Pagamento e cancelamento" },
  { id: "atendimento", rotulo: "Atendimento" },
];

// RF18 — o mockup oferece a antecedencia como opcoes prontas, nao campo livre.
const HORAS_CANCELAMENTO = [1, 2, 4, 8, 12, 24, 48];

export function ConfiguracoesAdmin({
  slug,
  configInicial,
  logoUrlInicial,
}: {
  slug: string;
  configInicial: Config;
  logoUrlInicial: string | null;
}) {
  const router = useRouter();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState(configInicial);
  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
  const [mostrarChave, setMostrarChave] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

  function campo<K extends keyof Config>(chave: K, valor: Config[K]) {
    setConfig((c) => ({ ...c, [chave]: valor }));
    setSucesso(null);
  }

  async function enviarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setSucesso(null);
    setEnviandoLogo(true);

    const formData = new FormData();
    formData.append("logo", arquivo);
    const resposta = await fetch("/api/tenant/logo", { method: "POST", body: formData });

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

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    const resposta = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel salvar.");
      return;
    }
    setSucesso("Configuracoes salvas.");
    router.refresh();
  }

  const iniciais = config.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <form onSubmit={salvar}>
      <AdminHeader
        trilha="Configuracoes · Loja"
        titulo="Configuracoes da estetica"
        acao={
          <button
            type="submit"
            disabled={salvando}
            className="flex items-center gap-2 rounded-lg bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {salvando ? "Salvando..." : "Salvar alteracoes"}
          </button>
        }
      />

      {erro && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {sucesso}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Atalhos para as secoes */}
        <nav className="hidden lg:block">
          <ul className="sticky top-6 space-y-1">
            {SECOES.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-astro-muted transition hover:bg-white/5 hover:text-white"
                >
                  {s.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          {/* 01 — Informacoes gerais */}
          <Secao id="gerais" numero="01" rotulo="Informacoes gerais" titulo="Identidade do estabelecimento">
            <Campo rotulo="Nome da estetica" className="sm:col-span-2">
              <input
                value={config.nome}
                onChange={(e) => campo("nome", e.target.value)}
                required
                maxLength={120}
                className={ENTRADA}
              />
            </Campo>

            <Campo
              rotulo="Descricao curta"
              className="sm:col-span-2"
              dica="Aparece na pagina publica, abaixo do nome da estetica."
            >
              <textarea
                value={config.descricao}
                onChange={(e) => campo("descricao", e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Ex.: Centro de estetica automotiva com atendimento por horario marcado."
                className={`${ENTRADA} resize-none`}
              />
            </Campo>
          </Secao>

          {/* 02 — Endereco */}
          <Secao id="endereco" numero="02" rotulo="Endereco" titulo="Onde sua estetica esta">
            <Campo rotulo="CEP">
              <input
                value={config.cep}
                onChange={(e) => campo("cep", e.target.value)}
                inputMode="numeric"
                placeholder="00000-000"
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="Rua" className="sm:col-span-2">
              <input
                value={config.rua}
                onChange={(e) => campo("rua", e.target.value)}
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="Numero">
              <input
                value={config.numero}
                onChange={(e) => campo("numero", e.target.value)}
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="Bairro">
              <input
                value={config.bairro}
                onChange={(e) => campo("bairro", e.target.value)}
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="Cidade">
              <input
                value={config.cidade}
                onChange={(e) => campo("cidade", e.target.value)}
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="Estado">
              <input
                value={config.estado}
                onChange={(e) => campo("estado", e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SC"
                className={`${ENTRADA} uppercase`}
              />
            </Campo>
          </Secao>

          {/* 03 — Pagina publica */}
          <Secao id="publica" numero="03" rotulo="Pagina publica" titulo="Como os clientes te encontram">
            <Campo rotulo="Endereco da pagina" className="sm:col-span-2">
              <div className="flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2">
                <Lock className="h-3.5 w-3.5 shrink-0 text-astro-muted" />
                <span className="font-mono text-sm text-astro-muted">astro.app/</span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">
                  {slug}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-astro-muted">
                O endereco e definido no cadastro e nao muda depois (RN09) —
                altera-lo quebraria todos os links ja divulgados pela estetica.
              </p>
            </Campo>

            <Campo rotulo="Telefone publico">
              <input
                value={config.telefone}
                onChange={(e) => campo("telefone", e.target.value)}
                inputMode="tel"
                placeholder="(00) 0000-0000"
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="WhatsApp">
              <input
                value={config.whatsapp}
                onChange={(e) => campo("whatsapp", e.target.value)}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                className={ENTRADA}
              />
            </Campo>
            <Campo rotulo="E-mail de contato" className="sm:col-span-2">
              <input
                type="email"
                value={config.emailContato}
                onChange={(e) => campo("emailContato", e.target.value)}
                placeholder="contato@suaestetica.com.br"
                className={ENTRADA}
              />
            </Campo>
          </Secao>

          {/* 04 — Identidade visual */}
          <Secao id="identidade" numero="04" rotulo="Identidade visual" titulo="A marca da estetica">
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-5 rounded-xl border border-admin-border bg-admin-bg p-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-border bg-admin-surface">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={`Logo ${config.nome}`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-lg font-bold text-astro-blue-bright">
                      {iniciais || "?"}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Logo da estetica</p>
                  <p className="mt-0.5 text-sm text-astro-muted">
                    Aparece no site publico e no topo do painel.
                  </p>
                  <input
                    ref={inputArquivo}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={enviarLogo}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => inputArquivo.current?.click()}
                    disabled={enviandoLogo}
                    className="mt-3 flex items-center gap-2 rounded-lg border border-admin-border bg-admin-surface-2 px-3.5 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {enviandoLogo
                      ? "Enviando..."
                      : logoUrl
                        ? "Substituir logo"
                        : "Enviar logo"}
                  </button>
                  <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted">
                    PNG, JPG ou WEBP · ate 2MB
                  </p>
                </div>
              </div>
            </div>
          </Secao>

          {/* 05 — Pagamento e cancelamento */}
          <Secao
            id="pagamento"
            numero="05"
            rotulo="Pagamento e cancelamento"
            titulo="Recebimento PIX e regras de cancelamento"
          >
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-white">Chave PIX Copia e Cola</p>
              <p className="mt-0.5 text-sm text-astro-muted">
                Exibida ao cliente na tela de pagamento. Em branco, a opcao PIX nao
                aparece e so resta pagar no local.
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2">
                <input
                  type={mostrarChave ? "text" : "password"}
                  value={config.pixChaveCopiaCola}
                  onChange={(e) => campo("pixChaveCopiaCola", e.target.value)}
                  placeholder="Cole aqui a chave gerada pelo seu banco"
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-100 outline-none placeholder:text-astro-muted"
                />
                <button
                  type="button"
                  onClick={() => setMostrarChave((v) => !v)}
                  aria-label={mostrarChave ? "Ocultar chave" : "Mostrar chave"}
                  className="shrink-0 text-astro-muted hover:text-white"
                >
                  {mostrarChave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-white">
                Antecedencia minima para cancelamento
              </p>
              <p className="mt-0.5 text-sm text-astro-muted">
                Clientes nao poderao cancelar dentro desse periodo. O Admin cancela
                sem restricao.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {HORAS_CANCELAMENTO.map((horas) => {
                  const ativa = config.cancelamentoHorasLimite === horas;
                  return (
                    <button
                      key={horas}
                      type="button"
                      onClick={() => campo("cancelamentoHorasLimite", horas)}
                      className={
                        ativa
                          ? "flex items-center gap-1.5 rounded-lg bg-astro-blue px-4 py-2 text-sm font-semibold text-white"
                          : "rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-200 transition hover:border-astro-blue"
                      }
                    >
                      {ativa && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      {horas}h
                    </button>
                  );
                })}
              </div>
            </div>
          </Secao>

          {/* 06 — Atendimento */}
          <Secao
            id="atendimento"
            numero="06"
            rotulo="Atendimento"
            titulo="Como os horarios sao oferecidos"
          >
            <Campo
              rotulo="Capacidade simultanea"
              dica="Veiculos atendidos ao mesmo tempo em cada horario."
            >
              <input
                type="number"
                min={1}
                value={config.capacidadeSimultanea}
                onChange={(e) => campo("capacidadeSimultanea", Number(e.target.value))}
                className={ENTRADA}
              />
            </Campo>
            <Campo
              rotulo="Intervalo entre horarios"
              dica="De quantos em quantos minutos os horarios sao oferecidos."
            >
              <input
                type="number"
                min={5}
                step={5}
                value={config.intervaloMinutos}
                onChange={(e) => campo("intervaloMinutos", Number(e.target.value))}
                className={ENTRADA}
              />
            </Campo>
          </Secao>
        </div>
      </div>
    </form>
  );
}

const ENTRADA =
  "mt-1 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-slate-100 placeholder:text-astro-muted";

function Secao({
  id,
  numero,
  rotulo,
  titulo,
  children,
}: {
  id: string;
  numero: string;
  rotulo: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6"
    >
      <p className="astro-label">
        {numero} · {rotulo}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-white">{titulo}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Campo({
  rotulo,
  dica,
  className = "",
  children,
}: {
  rotulo: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="astro-label">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-astro-muted">{dica}</span>}
    </label>
  );
}
