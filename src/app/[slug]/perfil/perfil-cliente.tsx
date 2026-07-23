"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Plus,
  Pencil,
  User,
  Mail,
  Phone,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ThemeColor } from "@/components/ui/theme-color";

type Veiculo = {
  id: string;
  marca: string;
  modelo: string;
  placa: string;
  ano: number;
  cor: string;
  segmento: string;
};

export function PerfilCliente({
  slug,
  nome,
  email,
  telefone,
  desde,
  totalAgendamentos,
  veiculos,
}: {
  slug: string;
  nome: string;
  email: string;
  telefone: string;
  desde: string;
  totalAgendamentos: number;
  veiculos: Veiculo[];
}) {
  const [editando, setEditando] = useState(false);
  const inicial = nome.trim()[0]?.toUpperCase() ?? "U";

  return (
    <div className="min-h-dvh bg-[#f6f8fb] pb-28">
      <ThemeColor color="#0b1120" />

      {/* Cabecalho escuro */}
      <div className="astro-dark rounded-b-[2rem] px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href={`/${slug}`}
            aria-label="Voltar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-semibold text-white">Meu perfil</h1>
          <span className="h-11 w-11" />
        </div>

        <div className="mx-auto mt-4 flex max-w-md flex-col items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl font-bold text-white">
              {inicial}
            </div>
            <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-astro-bg bg-astro-blue">
              <BadgeCheck className="h-4 w-4 text-white" />
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-white">{nome}</h2>
          <p className="astro-label mt-0.5">Cliente desde · {desde}</p>
        </div>
      </div>

      <main className="mx-auto -mt-4 max-w-md space-y-5 px-5">
        {/* Estatisticas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-zinc-900">
              {totalAgendamentos}
            </p>
            <p className="astro-label mt-0.5">Agendamentos</p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-zinc-900">
              {veiculos.length}
            </p>
            <p className="astro-label mt-0.5">Veículos</p>
          </div>
        </div>

        {/* Dados do cliente */}
        <section>
          <div className="flex items-center justify-between px-1">
            <p className="astro-label">Dados do cliente</p>
            <button
              onClick={() => setEditando(true)}
              className="text-sm font-semibold text-astro-blue"
            >
              Editar
            </button>
          </div>
          <div className="mt-2 divide-y divide-zinc-100 rounded-2xl border border-zinc-100 bg-white">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-zinc-500">E-mail</span>
              <span className="text-sm font-medium text-zinc-900">{email}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-zinc-500">Telefone</span>
              <span className="text-sm font-medium text-zinc-900">
                {telefone ? formatarTelefone(telefone) : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* Meus veiculos */}
        <section>
          <div className="flex items-center justify-between px-1">
            <p className="astro-label">Meus veículos</p>
            <Link
              href={`/${slug}/veiculos/novo?callbackUrl=/${slug}/perfil`}
              className="text-sm font-semibold text-astro-blue"
            >
              + Adicionar
            </Link>
          </div>

          <div className="mt-2 space-y-3">
            {veiculos.map((v, i) => (
              <div
                key={v.id}
                className={
                  i === 0
                    ? "flex items-center gap-3 rounded-2xl border border-astro-blue/30 bg-white p-3 shadow-lg shadow-astro-blue/10 ring-1 ring-astro-blue/20"
                    : "flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3"
                }
              >
                <div className="astro-dark flex h-14 w-16 shrink-0 items-center justify-center rounded-xl">
                  <span className="text-[0.6rem] font-semibold tracking-wider text-white/80">
                    {v.segmento}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="astro-label !text-astro-blue">
                      {v.segmento} · {v.ano}
                    </span>
                    {i === 0 && (
                      <span className="rounded bg-astro-bg px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-white">
                        Principal
                      </span>
                    )}
                  </div>
                  <h3 className="truncate font-bold text-zinc-900">
                    {v.marca} {v.modelo}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">{v.placa}</span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-zinc-300" />
                      {v.cor}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {veiculos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-8 text-center text-sm text-zinc-400">
                Nenhum veículo cadastrado ainda.
              </p>
            )}

            <Link
              href={`/${slug}/veiculos/novo?callbackUrl=/${slug}/perfil`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-astro-blue/40 bg-astro-blue/5 py-3.5 text-sm font-semibold text-astro-blue"
            >
              <Plus className="h-4 w-4" />
              Cadastrar novo veículo
            </Link>
          </div>
        </section>
      </main>

      <BottomNav slug={slug} />

      {/* Tela 05 — modal Editar perfil */}
      {editando && (
        <ModalEditar
          nome={nome}
          email={email}
          telefone={telefone}
          onFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}

// (00) 00000-0000 — apenas para exibicao.
function formatarTelefone(digitos: string) {
  const d = digitos.replace(/\D/g, "");
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

function ModalEditar({
  nome,
  email,
  telefone,
  onFechar,
}: {
  nome: string;
  email: string;
  telefone: string;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    nome,
    telefone: telefone ? formatarTelefone(telefone) : "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inicial = nome.trim()[0]?.toUpperCase() ?? "U";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const resposta = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSalvando(false);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível salvar.");
      return;
    }
    onFechar();
    router.refresh();
  }

  const campoCls =
    "flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3";
  const inputCls =
    "w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-t-3xl bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
        {/* Puxador */}
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-200" />

        <div className="flex items-start justify-between">
          <div>
            <p className="astro-label">Editar perfil</p>
            <h2 className="text-xl font-bold text-zinc-900">Seus dados</h2>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar (foto meramente visual — sem campo no modelo) */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-astro-bg text-2xl font-bold text-white">
              {inicial}
            </div>
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-astro-blue">
              <Camera className="h-3.5 w-3.5 text-white" />
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Toque na câmera para adicionar uma foto
          </p>
        </div>

        <form onSubmit={salvar} className="mt-5 space-y-4">
          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {erro}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="astro-label">Nome completo</label>
            <div className={campoCls}>
              <User className="h-4 w-4 text-zinc-400" />
              <input
                className={inputCls}
                value={form.nome}
                onChange={(e) =>
                  setForm((a) => ({ ...a, nome: e.target.value }))
                }
                required
              />
              <Pencil className="h-4 w-4 text-astro-blue" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">E-mail</label>
            <div className={`${campoCls} bg-zinc-50`}>
              <Mail className="h-4 w-4 text-zinc-400" />
              <input
                className={`${inputCls} text-zinc-400`}
                value={email}
                readOnly
                aria-label="E-mail (não editável)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="astro-label">Telefone</label>
            <div className={campoCls}>
              <Phone className="h-4 w-4 text-zinc-400" />
              <input
                className={inputCls}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) =>
                  setForm((a) => ({ ...a, telefone: e.target.value }))
                }
                required
              />
              <Pencil className="h-4 w-4 text-astro-blue" />
            </div>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="mt-2 w-full rounded-2xl bg-gradient-to-r from-astro-blue to-astro-blue-bright py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="w-full py-1 text-sm font-semibold text-astro-blue"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}
