import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getTenantPorSlug } from "@/lib/tenant";
import { withTenant } from "@/lib/tenant-db";
import { CatalogoAdmin } from "./catalogo-admin";

// UC08, RF01, RN01 revisada — a tela onde o Admin monta o catalogo da estetica:
// os tipos de veiculo que ela atende, os servicos, a duracao e o preco de cada
// servico para cada tipo.
//
// Substitui a antiga /admin/servicos. Os precos passaram a depender dos tipos
// (que agora sao configuraveis), entao manter as duas coisas em telas separadas
// obrigaria a ir e voltar para cadastrar um servico — e deixaria o preco
// editavel em dois lugares, que e como duas telas divergem com o tempo.
export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await getTenantPorSlug(slug);
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  const { segmentos, servicos } = await withTenant(tenant.id, async (tx) => {
    // Aposentados ficam de fora da grade: nao recebem carro novo nem preco
    // novo. Continuam no banco porque o historico aponta para eles.
    const segmentos = await tx.segmento.findMany({
      where: { tenantId: tenant.id, ativo: true },
      orderBy: { ordem: "asc" },
    });
    const servicos = await tx.servico.findMany({
      where: { tenantId: tenant.id },
      include: { precos: true },
      orderBy: { nome: "asc" },
    });
    return { segmentos, servicos };
  });

  return (
    <CatalogoAdmin
      segmentos={segmentos.map((s) => ({ id: s.id, nome: s.nome, ordem: s.ordem }))}
      servicos={servicos.map((s) => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        ativo: s.ativo,
        duracaoMin: s.duracaoMin,
        precos: Object.fromEntries(
          s.precos.map((p) => [p.segmentoId, Number(p.valor)])
        ) as Record<string, number>,
      }))}
    />
  );
}
