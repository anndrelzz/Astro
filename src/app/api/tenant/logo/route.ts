import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// SVG deliberadamente fora da lista: e um formato XML que pode conter
// <script> e handlers (onload, etc.) executados pelo navegador quando o
// arquivo e aberto diretamente pela URL - risco real de XSS armazenado
// (confirmado em teste manual antes desta correcao).
const TIPOS_ACEITOS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2MB

// UC12, RF13 — Admin faz upload de logo aplicado no site publico.
// Armazenamento local em dev; producao deve migrar para Azure Blob
// Storage (ver stack tecnologica do RFC) - disco local nao e persistente
// entre deploys/restarts do App Service.
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

  const extensao = TIPOS_ACEITOS[arquivo.type];
  if (!extensao) {
    return NextResponse.json(
      { error: "Formato invalido - use PNG, JPG ou WEBP" },
      { status: 400 }
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "Arquivo muito grande - maximo de 2MB" },
      { status: 400 }
    );
  }

  const tenantAtual = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { logoUrl: true },
  });

  const nomeArquivo = `${session.user.tenantId}-${randomUUID()}.${extensao}`;
  const diretorio = path.join(process.cwd(), "public", "uploads", "logos");
  await mkdir(diretorio, { recursive: true });

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  await writeFile(path.join(diretorio, nomeArquivo), bytes);

  const logoUrl = `/uploads/logos/${nomeArquivo}`;
  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { logoUrl },
  });

  // Remove o logo antigo para nao acumular arquivos orfaos no disco.
  if (tenantAtual?.logoUrl?.startsWith("/uploads/logos/")) {
    const caminhoAntigo = path.join(process.cwd(), "public", tenantAtual.logoUrl);
    await unlink(caminhoAntigo).catch(() => {});
  }

  return NextResponse.json({ logoUrl });
}
