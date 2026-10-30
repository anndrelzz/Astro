"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// UC13, UC14, RF17, RF18 — configuracoes gerais da estetica.
//
// Secoes com atalho ao lado (e marcacao da secao visivel). Uma barra fixa
// embaixo aparece so quando algo mudou, com Descartar e Salvar; a rota aceita
// atualizacao parcial, entao o que nao mudou continua intocado no banco.
// Erros aparecem embaixo do proprio campo, quando o dono sai dele.
//
// Nao entram aqui, por decisao registrada:
//   - Identidade visual (logo e cor) — tem tela propria em /admin/identidade
//   - Capacidade e intervalo entre horarios — ficam na Grade de horarios,
//     onde o dono pensa em horario
//   - Equipe e acessos, Plano e cobranca — Fora do Escopo (RFC 2.6)
//   - CNPJ, razao social, inscricao estadual — sem emissao fiscal (RFC 2.6)

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
  acrescimoCondicaoPercent: number | null;
  cancelamentoHorasLimite: number;
};

type Erros = Partial<Record<keyof Config, string>>;

const SECOES = [
  { id: "gerais", rotulo: "Informações gerais" },
  { id: "endereco", rotulo: "Endereço" },
  { id: "publica", rotulo: "Contato e página" },
  { id: "pagamento", rotulo: "Pagamento e cancelamento" },
];

// RF18 — a antecedencia e escolhida entre opcoes prontas, nao campo livre.
const HORAS_CANCELAMENTO = [1, 2, 4, 8, 12, 24, 48];
// Acrescimo: os valores comuns em um toque; "Outro" abre o campo (1 a 100%).
const ACRESCIMOS = [10, 20, 30];

// "47998123344" -> "(47) 99812-3344"
function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const meio = d.length === 11 ? 7 : 6;
  if (d.length <= meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}

// "89201000" -> "89201-000"
function mascaraCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// Mesmas regras do servidor (compartilhado/validacoes/tenant.ts), com a mensagem
// dizendo o que fazer. Rodam quando o dono sai do campo e ao salvar.
function validar(chave: keyof Config, c: Config): string | undefined {
  const digitos = (v: string) => v.replace(/\D/g, "");
  switch (chave) {
    case "nome":
      return c.nome.trim() ? undefined : "Informe o nome da estética.";
    case "telefone":
    case "whatsapp": {
      const n = digitos(c[chave]).length;
      return n === 0 || n === 10 || n === 11 ? undefined : "Informe o DDD e o número completo.";
    }
    case "emailContato":
      return !c.emailContato.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.emailContato.trim())
        ? undefined
        : "Confira o e-mail: falta o @ ou o domínio (ex.: contato@suaestetica.com.br).";
    case "cep": {
      const n = digitos(c.cep).length;
      return n === 0 || n === 8 ? undefined : "O CEP tem 8 números.";
    }
    case "estado":
      return !c.estado || /^[A-Z]{2}$/.test(c.estado) ? undefined : "Use a sigla do estado, com 2 letras (ex.: SC).";
    case "acrescimoCondicaoPercent": {
      const p = c.acrescimoCondicaoPercent;
      return p === null || (Number.isInteger(p) && p >= 1 && p <= 100) ? undefined : "Use um valor entre 1% e 100%.";
    }
  }
}

const VALIDADOS: (keyof Config)[] = ["nome", "telefone", "whatsapp", "emailContato", "cep", "estado", "acrescimoCondicaoPercent"];

export function ConfiguracoesAdmin({ slug, configInicial }: { slug: string; configInicial: Config }) {
  const router = useRouter();

  const inicial: Config = {
    ...configInicial,
    telefone: mascaraTelefone(configInicial.telefone),
    whatsapp: mascaraTelefone(configInicial.whatsapp),
    cep: mascaraCep(configInicial.cep),
  };
  const [config, setConfig] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoAgora, setSalvoAgora] = useState(false);
  const [mostrarChave, setMostrarChave] = useState(false);
  const [buscaCep, setBuscaCep] = useState<"ocioso" | "buscando" | "nao-achou">("ocioso");
  const [acrescimoLivre, setAcrescimoLivre] = useState(
    configInicial.acrescimoCondicaoPercent !== null && !ACRESCIMOS.includes(configInicial.acrescimoCondicaoPercent)
  );
  const [secaoVisivel, setSecaoVisivel] = useState(SECOES[0].id);
  const formulario = useRef<HTMLFormElement>(null);

  const alterado = JSON.stringify(config) !== JSON.stringify(salvo);

  // Fechar ou recarregar a aba com alteracao pendente pede confirmacao.
  useEffect(() => {
    if (!alterado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  // Marca no menu a secao que esta na tela.
  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel) setSecaoVisivel(visivel.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    SECOES.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, []);

  function campo<K extends keyof Config>(chave: K, valor: Config[K]) {
    setConfig((c) => ({ ...c, [chave]: valor }));
    // Campo que estava com erro e foi corrigido: o erro some na hora.
    if (erros[chave]) setErros((e) => ({ ...e, [chave]: validar(chave, { ...config, [chave]: valor }) }));
  }

  function aoSair(chave: keyof Config) {
    setErros((e) => ({ ...e, [chave]: validar(chave, config) }));
  }

  // CEP completo: busca rua, bairro, cidade e estado no ViaCEP (servico
  // publico dos Correios). So preenche; o dono pode corrigir qualquer campo.
  async function aoMudarCep(valor: string) {
    const cep = mascaraCep(valor);
    campo("cep", cep);
    const digitos = cep.replace(/\D/g, "");
    if (digitos.length !== 8) {
      setBuscaCep("ocioso");
      return;
    }
    setBuscaCep("buscando");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const j = await r.json();
      if (!r.ok || j.erro) {
        setBuscaCep("nao-achou");
        return;
      }
      setConfig((c) => ({
        ...c,
        cep,
        rua: j.logradouro || c.rua,
        bairro: j.bairro || c.bairro,
        cidade: j.localidade || c.cidade,
        estado: j.uf || c.estado,
      }));
      setBuscaCep("ocioso");
    } catch {
      setBuscaCep("nao-achou");
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErroGeral(null);

    const novos: Erros = {};
    for (const chave of VALIDADOS) novos[chave] = validar(chave, config);
    setErros(novos);
    const primeiro = VALIDADOS.find((c) => novos[c]);
    if (primeiro) {
      formulario.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }

    setSalvando(true);
    const resposta = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErroGeral(json?.error ?? "Não foi possível salvar. Tente de novo.");
      return;
    }
    setSalvo(config);
    setSalvoAgora(true);
    setTimeout(() => setSalvoAgora(false), 3000);
    router.refresh();
  }

  function descartar() {
    setConfig(salvo);
    setErros({});
    setErroGeral(null);
    setAcrescimoLivre(salvo.acrescimoCondicaoPercent !== null && !ACRESCIMOS.includes(salvo.acrescimoCondicaoPercent));
  }

  const pix = config.pixChaveCopiaCola.trim();
  const acrescimo = config.acrescimoCondicaoPercent;

  return (
    <form ref={formulario} onSubmit={salvar} noValidate>
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Configurações da estética</h1>
        <p className="mt-1.5 text-astro-muted">O que o cliente vê sobre a estética e as regras de pagamento.</p>
      </div>

      {/* Atalhos no celular: uma fileira que rola para o lado */}
      <nav aria-label="Seções" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {SECOES.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold ${
              secaoVisivel === s.id ? "border-transparent bg-white text-black" : "border-admin-border text-astro-muted"
            }`}
          >
            {s.rotulo}
          </a>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Seções" className="hidden lg:block">
          <ul className="sticky top-6 space-y-1">
            {SECOES.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={secaoVisivel === s.id ? "location" : undefined}
                  className={`block rounded-full px-4 py-2 text-sm transition ${
                    secaoVisivel === s.id ? "bg-white/10 font-semibold text-white" : "text-astro-muted hover:text-white"
                  }`}
                >
                  {s.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <Secao id="gerais" titulo="Informações gerais">
            <Campo id="nome" rotulo="Nome da estética" obrigatorio erro={erros.nome} className="sm:col-span-2">
              <input
                id="nome"
                name="nome"
                value={config.nome}
                onChange={(e) => campo("nome", e.target.value)}
                onBlur={() => aoSair("nome")}
                maxLength={120}
                autoComplete="organization"
                aria-invalid={!!erros.nome}
                aria-describedby={erros.nome ? "nome-erro" : undefined}
                className={entrada(!!erros.nome)}
              />
            </Campo>
            <Campo id="descricao" rotulo="Descrição curta" className="sm:col-span-2">
              <textarea
                id="descricao"
                value={config.descricao}
                onChange={(e) => campo("descricao", e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Ex.: Centro de estética automotiva com atendimento por horário marcado."
                className={`${entrada(false)} resize-none`}
              />
              <p className="mt-1.5 flex justify-between gap-3 text-xs text-astro-muted">
                <span>Aparece na página da estética, abaixo do nome.</span>
                <span className="shrink-0 font-mono">{config.descricao.length}/280</span>
              </p>
            </Campo>
          </Secao>

          <Secao id="endereco" titulo="Endereço" descricao="Digite o CEP e o resto se preenche sozinho.">
            <Campo id="cep" rotulo="CEP" erro={erros.cep}>
              <div className="relative">
                <input
                  id="cep"
                  name="cep"
                  value={config.cep}
                  onChange={(e) => aoMudarCep(e.target.value)}
                  onBlur={() => aoSair("cep")}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  aria-invalid={!!erros.cep}
                  aria-describedby={erros.cep ? "cep-erro" : "cep-busca"}
                  className={entrada(!!erros.cep)}
                />
                {buscaCep === "buscando" && (
                  <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-astro-muted" />
                )}
              </div>
              <p id="cep-busca" aria-live="polite" className="mt-1 text-xs text-amber-300">
                {buscaCep === "nao-achou" && "CEP não encontrado. Preencha o endereço à mão."}
              </p>
            </Campo>
            <Campo id="rua" rotulo="Rua" className="sm:col-span-2">
              <input id="rua" value={config.rua} onChange={(e) => campo("rua", e.target.value)} autoComplete="address-line1" className={entrada(false)} />
            </Campo>
            <Campo id="numero" rotulo="Número">
              <input id="numero" value={config.numero} onChange={(e) => campo("numero", e.target.value)} className={entrada(false)} />
            </Campo>
            <Campo id="bairro" rotulo="Bairro">
              <input id="bairro" value={config.bairro} onChange={(e) => campo("bairro", e.target.value)} className={entrada(false)} />
            </Campo>
            <Campo id="cidade" rotulo="Cidade">
              <input id="cidade" value={config.cidade} onChange={(e) => campo("cidade", e.target.value)} autoComplete="address-level2" className={entrada(false)} />
            </Campo>
            <Campo id="estado" rotulo="Estado" erro={erros.estado}>
              <input
                id="estado"
                name="estado"
                value={config.estado}
                onChange={(e) => campo("estado", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                onBlur={() => aoSair("estado")}
                maxLength={2}
                placeholder="SC"
                autoComplete="address-level1"
                aria-invalid={!!erros.estado}
                aria-describedby={erros.estado ? "estado-erro" : undefined}
                className={entrada(!!erros.estado)}
              />
            </Campo>
          </Secao>

          <Secao id="publica" titulo="Contato e página">
            <Campo id="pagina" rotulo="Endereço da página" className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-2 rounded-xl border border-admin-border bg-admin-bg px-3 py-2.5">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-astro-muted" />
                  <span className="font-mono text-sm text-astro-muted">astro.app/</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">{slug}</span>
                </div>
                <a
                  href={`/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-admin-border px-4 py-2.5 text-sm font-semibold text-white transition hover:border-astro-blue"
                >
                  Ver como o cliente vê
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-1.5 text-xs text-astro-muted">
                Definido no cadastro e não muda, para não quebrar os links que você já divulgou.
              </p>
            </Campo>
            <Campo id="telefone" rotulo="Telefone" erro={erros.telefone}>
              <input
                id="telefone"
                name="telefone"
                value={config.telefone}
                onChange={(e) => campo("telefone", mascaraTelefone(e.target.value))}
                onBlur={() => aoSair("telefone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 0000-0000"
                aria-invalid={!!erros.telefone}
                aria-describedby={erros.telefone ? "telefone-erro" : undefined}
                className={entrada(!!erros.telefone)}
              />
            </Campo>
            <Campo id="whatsapp" rotulo="WhatsApp" erro={erros.whatsapp}>
              <input
                id="whatsapp"
                name="whatsapp"
                value={config.whatsapp}
                onChange={(e) => campo("whatsapp", mascaraTelefone(e.target.value))}
                onBlur={() => aoSair("whatsapp")}
                type="tel"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                aria-invalid={!!erros.whatsapp}
                aria-describedby={erros.whatsapp ? "whatsapp-erro" : undefined}
                className={entrada(!!erros.whatsapp)}
              />
            </Campo>
            <Campo id="emailContato" rotulo="E-mail de contato" erro={erros.emailContato} className="sm:col-span-2">
              <input
                id="emailContato"
                name="emailContato"
                type="email"
                value={config.emailContato}
                maxLength={LIMITES.email}
                onChange={(e) => campo("emailContato", e.target.value)}
                onBlur={() => aoSair("emailContato")}
                autoComplete="email"
                placeholder="contato@suaestetica.com.br"
                aria-invalid={!!erros.emailContato}
                aria-describedby={erros.emailContato ? "emailContato-erro" : undefined}
                className={entrada(!!erros.emailContato)}
              />
            </Campo>
          </Secao>

          <Secao id="pagamento" titulo="Pagamento e cancelamento">
            <div className="sm:col-span-2">
              <label htmlFor="pix" className="text-sm font-semibold text-white">
                Chave PIX Copia e Cola
              </label>
              <p className="mt-0.5 text-sm text-astro-muted">Aparece para o cliente na hora de pagar.</p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-admin-border bg-admin-bg px-3 focus-within:border-astro-blue">
                <input
                  id="pix"
                  type={mostrarChave ? "text" : "password"}
                  value={config.pixChaveCopiaCola}
                  maxLength={LIMITES.pixCopiaCola}
                  onChange={(e) => campo("pixChaveCopiaCola", e.target.value)}
                  placeholder="Cole aqui o código gerado pelo seu banco"
                  aria-describedby="pix-aviso"
                  className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-sm text-slate-100 outline-none placeholder:font-sans placeholder:text-astro-muted"
                />
                <button
                  type="button"
                  onClick={() => setMostrarChave((v) => !v)}
                  aria-label={mostrarChave ? "Ocultar chave" : "Mostrar chave"}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-astro-muted hover:text-white"
                >
                  {mostrarChave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div id="pix-aviso" aria-live="polite">
                {!pix ? (
                  <Aviso>PIX desligado: sem a chave, o cliente só pode pagar no local.</Aviso>
                ) : (
                  !pix.startsWith("000201") && (
                    <Aviso>
                      Isso não parece um código PIX Copia e Cola. No app do banco, gere um QR Code de cobrança e copie o
                      código, que começa com 000201.
                    </Aviso>
                  )
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-white">Antecedência mínima para cancelar</p>
              <p className="mt-0.5 text-sm text-astro-muted">Você sempre pode cancelar, a qualquer momento.</p>
              <div role="group" aria-label="Antecedência para cancelar" className="mt-3 flex flex-wrap gap-2">
                {HORAS_CANCELAMENTO.map((horas) => {
                  const ativa = config.cancelamentoHorasLimite === horas;
                  return (
                    <button
                      key={horas}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => campo("cancelamentoHorasLimite", horas)}
                      className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${
                        ativa ? "border-transparent bg-astro-blue text-white" : "border-admin-border text-astro-muted hover:text-white"
                      }`}
                    >
                      {horas}h
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-slate-300">
                O cliente pode cancelar até <b className="text-white">{config.cancelamentoHorasLimite}h antes</b> do horário marcado.
              </p>
            </div>

            {/* Acrescimo por condicao do veiculo: o que o cliente precisa saber
                sobre dinheiro antes de confirmar, junto do PIX e do cancelamento. */}
            <div className="sm:col-span-2">
              <button
                type="button"
                role="switch"
                aria-checked={acrescimo !== null}
                onClick={() => {
                  setAcrescimoLivre(false);
                  campo("acrescimoCondicaoPercent", acrescimo === null ? 20 : null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-admin-border bg-black/40 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">Acréscimo por condição do veículo</span>
                  <span className="block text-xs text-astro-muted">
                    O cliente é avisado antes de confirmar. A diferença é paga no local, mesmo se ele pagou por PIX.
                  </span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${acrescimo !== null ? "bg-emerald-500" : "bg-zinc-600"}`}>
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${acrescimo !== null ? "translate-x-5" : ""}`}
                  />
                </span>
              </button>

              {acrescimo !== null && (
                <div className="mt-3">
                  <p className="text-sm text-astro-muted">Até quanto o valor pode subir:</p>
                  <div role="group" aria-label="Percentual máximo de acréscimo" className="mt-2 flex flex-wrap gap-2">
                    {ACRESCIMOS.map((p) => {
                      const marcado = !acrescimoLivre && acrescimo === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={marcado}
                          onClick={() => {
                            setAcrescimoLivre(false);
                            campo("acrescimoCondicaoPercent", p);
                          }}
                          className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${
                            marcado ? "border-transparent bg-astro-blue text-white" : "border-admin-border text-astro-muted hover:text-white"
                          }`}
                        >
                          {p}%
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      aria-pressed={acrescimoLivre}
                      onClick={() => setAcrescimoLivre(true)}
                      className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${
                        acrescimoLivre ? "border-transparent bg-astro-blue text-white" : "border-admin-border text-astro-muted hover:text-white"
                      }`}
                    >
                      Outro
                    </button>
                  </div>
                  {acrescimoLivre && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        name="acrescimoCondicaoPercent"
                        type="number"
                        min={1}
                        max={100}
                        aria-label="Percentual de acréscimo"
                        value={acrescimo ?? ""}
                        onChange={(e) => campo("acrescimoCondicaoPercent", e.target.value === "" ? 0 : Number(e.target.value))}
                        onBlur={() => aoSair("acrescimoCondicaoPercent")}
                        className={`${entrada(!!erros.acrescimoCondicaoPercent)} w-28 text-right`}
                      />
                      <span className="text-sm text-astro-muted">%</span>
                    </div>
                  )}
                  {erros.acrescimoCondicaoPercent ? (
                    <p className="mt-1.5 text-xs text-red-300" role="alert">
                      {erros.acrescimoCondicaoPercent}
                    </p>
                  ) : (
                    acrescimo > 0 && (
                      <p className="mt-2 text-sm text-slate-300">
                        Exemplo: uma lavagem de R$ 100,00 pode chegar a{" "}
                        <b className="text-white">
                          R$ {(100 + acrescimo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </b>
                        .
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          </Secao>
        </div>
      </div>

      {erroGeral && (
        <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erroGeral}
        </p>
      )}

      {/* Barra de salvar: aparece so quando algo mudou e fica presa na base da
          tela, perto de qualquer campo que o dono esteja editando. */}
      {alterado && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-admin-surface-2/90 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-md">
          <p className="flex items-center gap-2 text-sm text-white">
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            Você tem alterações não salvas
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={descartar}
              className="rounded-full border border-admin-border px-4 py-2.5 text-sm font-semibold text-astro-muted transition hover:text-white"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 rounded-full bg-astro-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmacao curta depois de salvar */}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-30">
        {salvoAgora && (
          <p className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            <Check className="h-4 w-4" />
            Alterações salvas
          </p>
        )}
      </div>
    </form>
  );
}

function entrada(comErro: boolean) {
  return `w-full rounded-xl border bg-admin-bg px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-astro-muted focus:border-astro-blue ${
    comErro ? "border-red-500/70" : "border-admin-border"
  }`;
}

function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold text-white">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-sm text-astro-muted">{descricao}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Campo({
  id,
  rotulo,
  dica,
  erro,
  obrigatorio = false,
  className = "",
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  erro?: string;
  obrigatorio?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm text-slate-300">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-red-300">*</span>}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-xs text-red-300">
          {erro}
        </p>
      ) : (
        dica && <p className="mt-1.5 text-xs text-astro-muted">{dica}</p>
      )}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
