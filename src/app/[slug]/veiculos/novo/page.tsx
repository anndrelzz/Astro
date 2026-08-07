import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClienteShell } from "../../cliente-shell";
import { NovoVeiculoForm } from "./novo-veiculo-form";

// UC02, tela 08 — cadastro de veiculo. O formulario em si e um Client
// Component (NovoVeiculoForm); a pagina existe para envolve-lo na casca do
// cliente, que le a sessao no servidor.
export default async function NovoVeiculoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Mesma porta das demais telas do cliente: slug inexistente e 404, e sessao
  // de outra estetica volta ao login DESTA. Sem isso a casca montaria com o
  // usuario de um tenant e a marca de outro. A gravacao ja e protegida pela
  // rota /api/veiculos; aqui e a tela que precisa dizer a verdade.
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login?callbackUrl=/${slug}/veiculos/novo`);
  }

  return (
    <ClienteShell slug={slug}>
      <NovoVeiculoForm />
    </ClienteShell>
  );
}
