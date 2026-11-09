import { notFound } from "next/navigation";
import { prisma } from "@/back/prisma";
import { EsqueciSenhaForm } from "@/front/login/esqueci-senha";

// RFC 6.2 — pedir o link de criar uma senha nova. Mostra o nome e o logo da
// estetica, como o login, para o cliente confirmar que esta no lugar certo.
export default async function EsqueciSenhaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { nome: true, logoUrl: true },
  });
  if (!tenant) notFound();

  return <EsqueciSenhaForm slug={slug} estetica={tenant} />;
}
