import type { ReactNode } from "react";

// Cabecalho de cada tela do painel, conforme o mockup: trilha em maiuscula
// espacada, titulo grande e, a direita, a acao principal daquela tela.
//
// A busca com atalho e o sino de notificacoes aparecem no desenho mas ainda nao
// existem no sistema - entram quando forem implementados de verdade, nao como
// enfeite sem funcao.
export function AdminHeader({
  trilha,
  titulo,
  acao,
}: {
  trilha: string;
  titulo: string;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="astro-label">{trilha}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {titulo}
        </h1>
      </div>
      {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
    </header>
  );
}

// Card padrao do painel: superficie um tom acima do fundo, borda sutil.
export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-admin-border bg-admin-surface ${className}`}
    >
      {children}
    </section>
  );
}
