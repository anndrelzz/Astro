import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClienteSidebar } from "./cliente-sidebar";

// Casca das telas do cliente logado (mockup de desktop): barra lateral fixa a
// esquerda e area de conteudo a direita. Abaixo de lg ela desaparece por
// completo e a tela volta a ser exatamente o que ja era no celular — a
// navegacao volta a ser a pilula do rodape (BottomNav).
//
// E um componente, e nao um layout.tsx, de proposito: /[slug]/login, /cadastro
// e /confirmado sao telas cheias, sem menu nenhum, e um layout nesse nivel
// envolveria todas elas sem distincao. Como componente, cada tela decide.
export async function ClienteShell({
  slug,
  titulo,
  trilha,
  acoes,
  children,
}: {
  slug: string;
  // Cabecalho do mockup: caminho curto em cima ("CONTA / PERFIL") e titulo
  // grande embaixo ("Meu perfil"). So aparece no desktop.
  titulo?: string;
  trilha?: string[];
  // Canto direito do cabecalho. No mockup e a busca global e o sino; ambos
  // ficaram de fora (nao ha o que buscar entre 3 servicos, e notificacao vai
  // por Telegram). Sobrou como encaixe para o que cada tela precisar — a home
  // usa para o atalho do painel do Admin.
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, whatsapp: true },
  });

  // Defensivo, em duas partes. Toda pagina que usa a casca ja barra quem nao
  // tem sessao antes de chegar aqui; se um caminho novo esquecer, a tela
  // aparece sem menu em vez de quebrar.
  //
  // A segunda condicao e a que importa: a sessao precisa ser DESTA estetica.
  // Sem ela, quem esta logado na estetica A abrindo /estetica-b/... veria a
  // barra lateral da B com o proprio nome e o suporte da B — a casca estaria
  // afirmando um vinculo que nao existe.
  if (!session || !tenant || session.user.tenantId !== tenant.id) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh bg-[#f6f8fb]">
      <ClienteSidebar
        slug={slug}
        usuarioNome={session.user.name ?? "Você"}
        usuarioEmail={session.user.email ?? ""}
        suporteWhatsapp={tenant.whatsapp}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {titulo && (
          <header className="hidden shrink-0 items-start justify-between gap-4 px-8 pb-1 pt-7 lg:flex">
            <div>
              {trilha && trilha.length > 0 && (
                <p className="astro-label">{trilha.join(" / ")}</p>
              )}
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">{titulo}</h1>
            </div>
            {acoes}
          </header>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
