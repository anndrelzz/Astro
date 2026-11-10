"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Link2, Lock, Mail, Phone, Store, User } from "lucide-react";
import { Logo } from "@/front/componentes/astro";
import { FundoOndas } from "@/front/componentes/fundo-ondas";
import { SuccessScreen } from "@/front/componentes/success-screen";
import { ThemeColor } from "@/front/componentes/theme-color";
import { CampoAuth, REGRAS_SENHA } from "@/front/login/auth-form";
import {
  enderecoEnquantoDigita,
  MENSAGEM_DO_PROBLEMA,
  normalizarEndereco,
  problemaNoEndereco,
  sugerirEndereco,
} from "@/compartilhado/endereco-estetica";
import { DOMINIO } from "@/compartilhado/dominio";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// Autocadastro (decisao do orientador, 30/10; detalhes do Andre, 06/11) — a
// tela /start, aberta pelo botao do plano na landing. O dono cria a estetica
// e entra direto no painel dela, sem confirmar o e-mail antes.
//
// O endereco do site vem do nome, sem hifen, ate o dono mexer nele: dai em
// diante e dele. Enquanto ele digita, a tela mostra o link como vai ficar e
// pergunta ao servidor se esta livre. A conferencia de verdade e no envio.
//
// Mesmo visual do login e do cadastro de cliente (auth-form.tsx): cartao
// sobre o fundo de ondas, lado colorido na cor do Astro e formulario no lado
// escuro.

// Espera o dono parar de digitar antes de consultar o endereco.
const ESPERA_CONSULTA_MS = 400;

// Campos que a API pode apontar (o `campo` da resposta 400 ou 409).
const CAMPOS = ["nomeEstetica", "endereco", "nome", "email", "whatsapp", "senha", "aceitouTermos"] as const;
type Campo = (typeof CAMPOS)[number];

type Consulta = { para: string; disponivel: boolean; motivo?: keyof typeof MENSAGEM_DO_PROBLEMA };

export function CadastroEstetica() {
  const router = useRouter();
  const id = useId();

  const [nomeEstetica, setNomeEstetica] = useState("");
  const [endereco, setEndereco] = useState("");
  // Depois que o dono mexe no endereco, o nome para de sugerir.
  const [enderecoEditado, setEnderecoEditado] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  // Campo escondido: pessoa nao ve, robo preenche (ver POST /api/esteticas).
  const [site, setSite] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<{ campo: Campo; mensagem: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  // Mesmo motivo do auth-form: sem JS, o botao faria um envio nativo.
  const [montado, setMontado] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMontado(true), []);

  const enderecoFinal = normalizarEndereco(endereco);
  const problemaLocal = enderecoFinal ? problemaNoEndereco(enderecoFinal) : null;

  // Pergunta ao servidor so quando a regra local ja aceitou.
  useEffect(() => {
    if (!enderecoFinal || problemaLocal) return;
    let valendo = true;
    const espera = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/esteticas/endereco?valor=${encodeURIComponent(enderecoFinal)}`);
        const json = await resposta.json();
        if (valendo) setConsulta({ para: enderecoFinal, disponivel: json.disponivel, motivo: json.motivo });
      } catch {
        // Sem resposta, a tela so nao avisa: o envio confere de novo.
      }
    }, ESPERA_CONSULTA_MS);
    return () => {
      valendo = false;
      clearTimeout(espera);
    };
  }, [enderecoFinal, problemaLocal]);

  const consultaAtual = consulta?.para === enderecoFinal ? consulta : null;
  const avisoEndereco = problemaLocal
    ? MENSAGEM_DO_PROBLEMA[problemaLocal]
    : consultaAtual && !consultaAtual.disponivel
      ? MENSAGEM_DO_PROBLEMA[consultaAtual.motivo ?? "em-uso"]
      : undefined;

  const atendidas = REGRAS_SENHA.filter((r) => r.ok(senha)).length;
  const erroDo = (campo: Campo) => (erroCampo?.campo === campo ? erroCampo.mensagem : undefined);

  // Mexeu no campo errado: o aviso dele ja nao vale.
  function limparErro(campo: Campo) {
    setErroCampo((atual) => (atual?.campo === campo ? null : atual));
  }

  function alterarNomeEstetica(valor: string) {
    setNomeEstetica(valor);
    if (!enderecoEditado) setEndereco(sugerirEndereco(valor));
    limparErro("nomeEstetica");
  }

  function alterarEndereco(valor: string) {
    setEndereco(enderecoEnquantoDigita(valor));
    setEnderecoEditado(true);
    limparErro("endereco");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setErroCampo(null);
    setCarregando(true);

    const resposta = await fetch("/api/esteticas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomeEstetica,
        endereco: enderecoFinal,
        nome,
        email,
        whatsapp,
        senha,
        aceitouTermos,
        site,
      }),
    });
    const json = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      if (json?.error && CAMPOS.includes(json.campo)) {
        setErroCampo({ campo: json.campo, mensagem: json.error });
      } else {
        setErro(json?.error ?? "Não foi possível criar a estética. Tente de novo.");
      }
      setCarregando(false);
      return;
    }

    const slug: string = json.slug;
    const entrou = await signIn("credentials", { email, password: senha, tenantSlug: slug, redirect: false });
    if (entrou?.error) {
      // A estetica ja existe: so o login automatico falhou. Ele entra pela
      // tela de login da estetica nova.
      router.push(`/${slug}/login`);
      return;
    }

    setSucesso(true);
    setTimeout(() => {
      router.push(`/${slug}/admin`);
      router.refresh();
    }, 2300);
  }

  // Campos em pares no computador (nome da estetica e endereco, nome e
  // WhatsApp, e-mail e senha): o formulario cabe na tela sem rolar, como o
  // cadastro de cliente.
  const par = "space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0";

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center bg-black px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:p-6 [@media(min-height:820px)]:lg:p-10">
      <ThemeColor color="#000000" />
      <FundoOndas />

      <AnimatePresence>
        {sucesso && <SuccessScreen title="Estética criada!" subtitle="Abrindo o seu painel…" />}
      </AnimatePresence>

      <div className="relative w-full max-w-5xl">
        {/* Mesmo cartao do login (auth-form.tsx): o painel colorido fica por
            baixo, absoluto, com a borda em curva; o formulario na metade
            direita. transform-gpu: recorte dos cantos no Safari. */}
        <div className="relative transform-gpu overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b0b0f] shadow-[0_40px_120px_-40px_var(--color-astro-blue)] lg:grid lg:min-h-[34rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:rounded-[2rem]">
          <PainelAstro />
          <div aria-hidden className="hidden lg:block" />

          {/* Formulario */}
          <div className="relative flex flex-col px-5 pt-1 pb-4 lg:px-10 lg:py-7">
            <div className="lg:my-auto">
              <h1 className="text-2xl font-bold text-white">Cadastre sua estética</h1>
              <p className="mt-1 hidden text-sm text-astro-muted lg:block">Em poucos minutos o seu site está no ar.</p>

              <form onSubmit={handleSubmit} className="mt-2 space-y-2 lg:mt-4 lg:space-y-3">
                {erro && (
                  <p
                    role="alert"
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
                  >
                    {erro}
                  </p>
                )}

                <div>
                  <div className={par}>
                    <CampoAuth
                      id={`${id}-estetica`}
                      rotulo="Nome da estética"
                      icone={<Store className="h-4 w-4" />}
                      autoComplete="organization"
                      placeholder="Estética do João"
                      maxLength={LIMITES.nomeEstetica}
                      value={nomeEstetica}
                      onChange={(e) => alterarNomeEstetica(e.target.value)}
                      erro={erroDo("nomeEstetica")}
                      required
                    />
                    <CampoAuth
                      id={`${id}-endereco`}
                      rotulo="Endereço do site"
                      icone={<Link2 className="h-4 w-4" />}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="esteticadojoao"
                      value={endereco}
                      onChange={(e) => alterarEndereco(e.target.value)}
                      erro={erroDo("endereco") ?? avisoEndereco}
                      required
                    />
                  </div>
                  <p className="mt-1 truncate px-4 text-xs text-astro-muted">
                    Seu link: <span className="font-medium text-white">{`${DOMINIO}/${enderecoFinal || "seuendereco"}`}</span>
                    {consultaAtual?.disponivel && !erroDo("endereco") && (
                      <span className="ml-2 font-medium text-emerald-300">Endereço disponível</span>
                    )}
                  </p>
                </div>

                <div className={par}>
                  <CampoAuth
                    id={`${id}-nome`}
                    rotulo="Seu nome"
                    icone={<User className="h-4 w-4" />}
                    autoComplete="name"
                    placeholder="Nome do responsável"
                    maxLength={LIMITES.nomePessoa}
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      limparErro("nome");
                    }}
                    erro={erroDo("nome")}
                    required
                  />
                  <CampoAuth
                    id={`${id}-whatsapp`}
                    rotulo="WhatsApp"
                    icone={<Phone className="h-4 w-4" />}
                    autoComplete="tel"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={whatsapp}
                    onChange={(e) => {
                      setWhatsapp(e.target.value);
                      limparErro("whatsapp");
                    }}
                    erro={erroDo("whatsapp")}
                    required
                  />
                </div>

                <div className={par}>
                  <CampoAuth
                    id={`${id}-email`}
                    rotulo="E-mail"
                    icone={<Mail className="h-4 w-4" />}
                    autoComplete="email"
                    type="email"
                    placeholder="voce@email.com"
                    maxLength={LIMITES.email}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      limparErro("email");
                    }}
                    erro={erroDo("email")}
                    required
                  />
                  <div>
                    <CampoAuth
                      id={`${id}-senha`}
                      rotulo="Senha"
                      icone={<Lock className="h-4 w-4" />}
                      autoComplete="new-password"
                      type={mostrarSenha ? "text" : "password"}
                      placeholder="••••••••"
                      maxLength={LIMITES.senha}
                      minLength={8}
                      value={senha}
                      onChange={(e) => {
                        setSenha(e.target.value);
                        limparErro("senha");
                      }}
                      erro={erroDo("senha")}
                      required
                      direita={
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((v) => !v)}
                          className="grid h-8 w-8 place-items-center rounded-full text-astro-muted hover:text-white"
                          aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                    <div className="flex gap-1.5 pt-1.5" aria-hidden>
                      {REGRAS_SENHA.map((regra, i) => (
                        <span
                          key={regra.rotulo}
                          className={`h-1 flex-1 rounded-full ${senha.length > 0 && i < atendidas ? "bg-astro-blue-bright" : "bg-white/10"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-astro-muted">
                  Senha com no mínimo {REGRAS_SENHA.map((r) => r.rotulo).join(", ")}.
                </p>

                {/* Isca para robo: fora da tela, fora do Tab e fora do leitor de tela. */}
                <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
                  <label>
                    Não preencha
                    <input
                      type="text"
                      name="site"
                      tabIndex={-1}
                      autoComplete="off"
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                    />
                  </label>
                </div>

                <div>
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-astro-muted lg:text-sm lg:leading-normal">
                    <input
                      type="checkbox"
                      checked={aceitouTermos}
                      onChange={(e) => {
                        setAceitouTermos(e.target.checked);
                        limparErro("aceitouTermos");
                      }}
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 accent-astro-blue"
                    />
                    <span>
                      {/* Nova aba: quem le os termos nao perde o que ja preencheu. */}
                      Li e aceito os{" "}
                      <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                        Termos de uso
                      </a>{" "}
                      e a{" "}
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                        Política de privacidade
                      </a>{" "}
                      da Astro.
                    </span>
                  </label>
                  {erroDo("aceitouTermos") && (
                    <p className="mt-1 px-4 text-xs font-medium text-red-300">{erroDo("aceitouTermos")}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={carregando || !montado}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-astro-blue px-5 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_var(--color-astro-blue)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {carregando ? "Criando…" : !montado ? "Carregando…" : "Criar minha estética"}
                  {!carregando && montado && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lado colorido do cartao, igual ao do login (login/painel-marca.tsx): mesmo
// degrade, aneis, borda em curva (.painel-auth, em globals.css) e sombra ao
// longo da curva. No lugar da marca da estetica, a do Astro: quem chega aqui
// ainda nao tem estetica. No celular vira a faixa do topo, so com o logo e o
// titulo, para sobrar espaco para o formulario.
function PainelAstro() {
  return (
    <aside className="relative lg:absolute lg:inset-y-0 lg:left-0 lg:w-[56%]">
      <div
        className="painel-auth relative h-full overflow-hidden rounded-t-[1.75rem] px-5 pt-4 pb-8 text-white lg:flex lg:flex-col lg:justify-between lg:rounded-none lg:rounded-l-[2rem] lg:p-10 lg:pr-[14%]"
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full border border-white/20 shadow-[0_0_0_44px_rgba(255,255,255,0.04),0_0_0_100px_rgba(255,255,255,0.03)]"
        />

        <div className="relative">
          <Logo className="h-8 lg:h-9" />
        </div>

        <div className="relative mt-3 lg:mt-0">
          <h2 className="text-xl leading-tight font-bold lg:text-4xl">Sua estética com agendamento online.</h2>
          <ul className="mt-5 hidden space-y-3 lg:block">
            {[
              "Site próprio, com o endereço que você escolher",
              "Clientes agendam sozinhos, 24 horas por dia",
              "Cobrança do plano depois, por PIX",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div aria-hidden className="painel-auth-sombra pointer-events-none absolute inset-0">
        <div className="painel-auth-inverso h-full w-full rounded-t-[1.75rem] bg-[#0b0b0f] lg:rounded-none lg:rounded-l-[2rem]" />
      </div>
    </aside>
  );
}
