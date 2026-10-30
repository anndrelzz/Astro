import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/back/auth";
import { tipoDaImagem } from "@/back/imagem";
import { prisma } from "@/back/prisma";

// SVG deliberadamente fora dos formatos aceitos: e um formato XML que pode
// conter <script> e handlers (onload, etc.) executados pelo navegador quando o
// arquivo e aberto diretamente pela URL - risco real de XSS armazenado
// (confirmado em teste manual antes desta correcao). tipoDaImagem so reconhece
// PNG, JPEG e WEBP.
const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2MB

// UC12, RF13 — Admin faz upload de logo aplicado no site publico.
// Os bytes ficam na tabela logo_tenant e sao entregues por
// /api/tenant/logo/[tenantId] (ver o model LogoTenant para o porque).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  const arquivo = formData.get("logo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "Arquivo muito grande - maximo de 2MB" },
      { status: 400 }
    );
  }

  // O tipo vem do conteudo do arquivo, nao do que o navegador declarou.
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDaImagem(bytes);
  if (!tipo) {
    return NextResponse.json(
      { error: "Formato invalido - use PNG, JPG ou WEBP" },
      { status: 400 }
    );
  }

  const tenantId = session.user.tenantId;
  // A versao no endereco muda a cada envio: o navegador guarda a imagem em
  // cache por tempo indeterminado e, com endereco novo, busca a nova na hora.
  const logoUrl = `/api/tenant/logo/${tenantId}?v=${randomUUID()}`;

  await prisma.$transaction([
    prisma.logoTenant.upsert({
      where: { tenantId },
      create: { tenantId, dados: bytes, tipo },
      update: { dados: bytes, tipo },
    }),
    prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl } }),
  ]);

  return NextResponse.json({ logoUrl });
}
