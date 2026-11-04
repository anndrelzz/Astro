import { notFound } from "next/navigation";
import { prisma } from "@/back/prisma";
import { RedefinirSenhaForm } from "@/front/login/esqueci-senha";

// RFC 6.2 — a senha nova, pelo link do e-mail (?token=...). A validade e o
// uso unico do link sao conferidos ao salvar (api/auth/redefinir-senha).
export default async function RedefinirSenhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { nome: true, logoUrl: true },
  });
  if (!tenant) notFound();

  return <RedefinirSenhaForm slug={slug} token={token ?? ""} estetica={tenant} />;
}
