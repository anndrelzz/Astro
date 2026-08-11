import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModalRota } from "@/components/ui/modal-rota";
import { NovoVeiculoForm } from "../../../veiculos/novo/novo-veiculo-form";

// UC02, tela 08 — versao em modal do cadastro de veiculo.
//
// Rota interceptada: quem chega aqui por um clique dentro do app ve o
// formulario como pop-up sobre a tela onde estava. Quem abre a URL direto, ou
// recarrega a pagina, cai na tela cheia de /[slug]/veiculos/novo — inclusive o
// redirecionamento do agendar sem veiculo (RN04), que e navegacao dura e
// portanto nao e interceptada.
//
// A guarda de sessao se repete aqui de proposito: interceptada ou nao, a rota
// e uma porta, e cada porta confere quem entra.
export default async function NovoVeiculoModal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
    <ModalRota titulo="Cadastrar veículo" rotulo="Passo 01 · Dados do veículo">
      <NovoVeiculoForm emModal />
    </ModalRota>
  );
}
