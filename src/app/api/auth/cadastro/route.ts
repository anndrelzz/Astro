import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { lerJson, respostaDadosInvalidos } from "@/back/api-helpers";
import { MAX_CADASTROS_CLIENTE_POR_HORA, resumoDaConexao } from "@/back/autocadastro";
import { prisma } from "@/back/prisma";
import { criarLinkDeConfirmacao, enviarLinkDeConfirmacao } from "@/back/confirmacao-email";
import { withTenant } from "@/back/tenant-db";
import { LIMITES } from "@/compartilhado/validacoes/limites";
import { senhaSchema } from "@/compartilhado/validacoes/senha";

const cadastroSchema = z.object({
  tenantSlug: z.string().min(1),
  nome: z
    .string()
    .min(1, "Informe o nome completo")
    .max(LIMITES.nomePessoa, `Nome muito longo - use ate ${LIMITES.nomePessoa} caracteres`),
  email: z
    .string()
    .email("E-mail invalido")
    .max(LIMITES.email, "E-mail muito longo")
    .transform((v) => v.toLowerCase()),
  telefone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "Telefone invalido - informe DDD + numero (10 ou 11 digitos)",
    }),
  // As mesmas regras do medidor de forca da tela 03 (ver validacoes/senha.ts).
  senha: senhaSchema,
});

// UC01 — cliente cria conta informando nome completo, e-mail, telefone e
// senha. Necessario para acessar os servicos e realizar agendamentos (RN02).
export async function POST(request: Request) {
  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  // OWASP A04 — campo escondido da tela (o mesmo do /start): pessoa nao ve,
  // robo preenche. Responde como se tivesse dado certo, para o robo nao
  // aprender a contornar.
  if (typeof body === "object" && "site" in body && body.site) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const parsed = cadastroSchema.safeParse(body);
  if (!parsed.success) {
    return respostaDadosInvalidos(parsed.error);
  }
  const { tenantSlug, nome, email, telefone, senha } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json({ error: "Estetica nao encontrada" }, { status: 404 });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const cadastroIpHash = resumoDaConexao(request);
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);

  const resultado = await withTenant(tenant.id, async (tx) => {
    // OWASP A04 — no maximo MAX_CADASTROS_CLIENTE_POR_HORA contas por hora da
    // mesma conexao nesta estetica: um robo nao enche a estetica de contas
    // falsas.
    const recentes = await tx.usuario.count({
      where: { tenantId: tenant.id, cadastroIpHash, criadoEm: { gt: umaHoraAtras } },
    });
    if (recentes >= MAX_CADASTROS_CLIENTE_POR_HORA) {
      return { error: "Muitos cadastros feitos desta conexao. Tente de novo em uma hora.", status: 429 } as const;
    }

    const existente = await tx.usuario.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (existente) {
      return { error: "Ja existe uma conta com esse e-mail nesta estetica", status: 409 } as const;
    }

    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome,
        email,
        telefone,
        senhaHash,
        role: "CLIENTE",
        cadastroIpHash,
      },
    });
    // A conta nasce sem o e-mail confirmado: os avisos por e-mail so saem
    // depois do link (ver back/confirmacao-email.ts).
    const link = await criarLinkDeConfirmacao(tx, usuario, tenant.slug);
    return { usuario, link } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  if (resultado.link) {
    await enviarLinkDeConfirmacao(resultado.usuario, tenant, resultado.link);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
