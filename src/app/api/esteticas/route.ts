import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { lerJson, respostaDadosInvalidos } from "@/back/api-helpers";
import {
  cadastrosRecentes,
  criarEstetica,
  EnderecoEmUso,
  MAX_CADASTROS_POR_HORA,
  resumoDaConexao,
} from "@/back/autocadastro";
import { prisma } from "@/back/prisma";
import { MENSAGEM_DO_PROBLEMA, normalizarEndereco, problemaNoEndereco } from "@/compartilhado/endereco-estetica";
import { LIMITES } from "@/compartilhado/validacoes/limites";
import { senhaSchema } from "@/compartilhado/validacoes/senha";

// Na ordem da tela /start: o Zod confere os campos nessa ordem, e o primeiro
// erro e o que a tela mostra (ver respostaDadosInvalidos).
const cadastroSchema = z.object({
  nomeEstetica: z
    .string()
    .trim()
    .min(1, "Informe o nome da estetica")
    .max(LIMITES.nomeEstetica, `Nome muito longo - use ate ${LIMITES.nomeEstetica} caracteres`),
  endereco: z
    .string()
    .transform(normalizarEndereco)
    .superRefine((endereco, ctx) => {
      const problema = problemaNoEndereco(endereco);
      if (problema) ctx.addIssue({ code: "custom", message: MENSAGEM_DO_PROBLEMA[problema] });
    }),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o seu nome")
    .max(LIMITES.nomePessoa, `Nome muito longo - use ate ${LIMITES.nomePessoa} caracteres`),
  email: z
    .string()
    .trim()
    .email("E-mail invalido")
    .max(LIMITES.email, "E-mail muito longo")
    .transform((v) => v.toLowerCase()),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "WhatsApp invalido - informe DDD + numero (10 ou 11 digitos)",
    }),
  senha: senhaSchema,
  aceitouTermos: z.literal(true, { error: "Aceite os Termos de uso e a Politica de privacidade" }),
});

// Autocadastro (decisao do orientador, 30/10; detalhes do Andre, 06/11) — o
// dono preenche a tela /start e a estetica nasce com o Admin dele e os tipos
// de veiculo iniciais. A grade de horarios fica vazia: ele configura no
// primeiro acesso. A cobranca do plano e feita depois, por PIX, fora do
// sistema.
export async function POST(request: Request) {
  const body = await lerJson(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  // Campo escondido da tela: pessoa nao ve, robo preenche. Responde como se
  // tivesse dado certo, para o robo nao aprender a contornar.
  if ("site" in body && body.site) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const parsed = cadastroSchema.safeParse(body);
  if (!parsed.success) {
    return respostaDadosInvalidos(parsed.error);
  }
  const dados = parsed.data;

  const cadastroIpHash = resumoDaConexao(request);
  if ((await cadastrosRecentes(cadastroIpHash)) >= MAX_CADASTROS_POR_HORA) {
    return NextResponse.json(
      { error: "Muitos cadastros feitos desta conexao. Tente de novo em uma hora." },
      { status: 429 }
    );
  }

  try {
    const { tenant } = await criarEstetica(prisma, {
      nomeEstetica: dados.nomeEstetica,
      slug: dados.endereco,
      nomeAdmin: dados.nome,
      email: dados.email,
      senhaHash: await bcrypt.hash(dados.senha, 10),
      whatsapp: dados.whatsapp,
      cadastroIpHash,
    });
    return NextResponse.json({ ok: true, slug: tenant.slug }, { status: 201 });
  } catch (erro) {
    if (erro instanceof EnderecoEmUso) {
      return NextResponse.json({ error: MENSAGEM_DO_PROBLEMA["em-uso"], campo: "endereco" }, { status: 409 });
    }
    throw erro;
  }
}
