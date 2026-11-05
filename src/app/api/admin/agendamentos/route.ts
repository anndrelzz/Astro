import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/back/auth";
import { lerJson, respostaDadosInvalidos } from "@/back/api-helpers";
import { obterCoringa } from "@/back/coringa";
import { calcularSlotsDisponiveis, FilaDeAgendamentoOcupada, travarDiaParaAgendamento } from "@/back/slots";
import { withTenant } from "@/back/tenant-db";
import { conferirDataAgendamento, JANELA_AGENDAMENTO_ADMIN_DIAS } from "@/compartilhado/agenda";
import { instanteNoFuso } from "@/compartilhado/fuso";
import { calcularPreco } from "@/compartilhado/precificacao";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// Placa: a mesma normalizacao do cadastro do cliente, mas opcional. Quem chama
// no WhatsApp nem sempre sabe a placa de cabeca.
const PLACA = /^([A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/;

const textoOpcional = (limite: number, nome: string) =>
  z
    .string()
    .trim()
    .max(limite, `${nome} muito longo - use ate ${limite} caracteres`)
    .optional()
    .default("");

// A ordem dos campos e a do formulario: o primeiro erro aponta o primeiro
// campo errado da tela.
const agendamentoAdminSchema = z.object({
  servicoId: z.string().uuid("Escolha o servico"),
  segmentoId: z.string().uuid("Escolha o tipo de veiculo"),
  placa: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
    .refine((v) => v === "" || PLACA.test(v), {
      message: "Placa invalida - use o formato ABC-1234 ou ABC1D23 (Mercosul)",
    }),
  modelo: z
    .string()
    .trim()
    .min(1, "Informe o modelo")
    .max(LIMITES.modeloVeiculo, `Modelo muito longo - use ate ${LIMITES.modeloVeiculo} caracteres`),
  marca: textoOpcional(LIMITES.marcaVeiculo, "Marca"),
  ano: z
    .union([z.literal(""), z.coerce.number().int().min(1950, "Ano invalido").max(2100, "Ano invalido")])
    .optional()
    .default(""),
  cor: textoOpcional(LIMITES.corVeiculo, "Cor"),
  contatoNome: z
    .string()
    .trim()
    .min(1, "Informe o nome de quem chamou")
    .max(LIMITES.nomePessoa, `Nome muito longo - use ate ${LIMITES.nomePessoa} caracteres`),
  contatoTelefone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "Telefone invalido - informe DDD + numero (10 ou 11 digitos)",
    }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
  hora: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horario invalido"),
});

// O Admin agenda quem chamou no WhatsApp ou no Instagram, pelo coringa da
// estetica (decisao do orientador, 30/10; regras combinadas em 04/11):
// - pagamento sempre no local, preco da tabela (servico x tipo de veiculo);
// - ate 60 dias a frente e sem a antecedencia minima do cliente;
// - nunca em horario lotado nem fora da grade (a mesma conferencia do cliente);
// - nenhuma notificacao: o coringa nao tem e-mail nem Telegram de verdade.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = agendamentoAdminSchema.safeParse(body);
  if (!parsed.success) {
    return respostaDadosInvalidos(parsed.error);
  }
  const d = parsed.data;

  const erroData = conferirDataAgendamento(d.data, new Date(), JANELA_AGENDAMENTO_ADMIN_DIAS);
  if (erroData) {
    return NextResponse.json({ error: erroData, campo: "data" }, { status: 400 });
  }

  const tenantId = session.user.tenantId;
  const resultado = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    const servico = await tx.servico.findFirst({
      where: { id: d.servicoId, tenantId, ativo: true },
      include: { precos: true },
    });
    const segmento = await tx.segmento.findFirst({
      where: { id: d.segmentoId, tenantId, ativo: true },
    });
    if (!tenant || !servico || !segmento) {
      return { error: "Servico ou tipo de veiculo nao encontrado", httpStatus: 404 } as const;
    }

    const valor = calcularPreco(servico.precos, segmento.id);
    if (valor === null) {
      return {
        error: `Este servico ainda nao tem preco para ${segmento.nome}. Cadastre o preco no Catalogo.`,
        httpStatus: 409,
      } as const;
    }

    const [ano, mes, dia] = d.data.split("-").map(Number);
    const [h, m] = d.hora.split(":").map(Number);
    const dataHora = instanteNoFuso(ano, mes, dia, h, m);

    // A mesma trava e a mesma conferencia de vaga do agendamento do cliente
    // (RN06), so que sem a antecedencia minima.
    await travarDiaParaAgendamento(tx, tenant.id, dataHora);
    const livres = await calcularSlotsDisponiveis(tx, tenant, servico, dataHora, new Date(), {
      antecedenciaMin: 0,
    });
    if (!livres.includes(d.hora)) {
      return { error: "Horario nao esta mais disponivel", httpStatus: 409 } as const;
    }

    const coringa = await obterCoringa(tx, tenant.id);

    // Placa ja agendada pelo coringa: e o mesmo carro voltando. Sem placa, nao
    // ha como saber, e o carro entra como novo.
    const conhecido = d.placa
      ? await tx.veiculo.findFirst({ where: { usuarioId: coringa.id, placa: d.placa, ativo: true } })
      : null;
    const veiculo =
      conhecido ??
      (await tx.veiculo.create({
        data: {
          tenantId: tenant.id,
          usuarioId: coringa.id,
          segmentoId: segmento.id,
          modelo: d.modelo,
          marca: d.marca,
          placa: d.placa,
          cor: d.cor,
          // Sem ano informado fica 0, e a agenda do Admin esconde o campo.
          ano: d.ano === "" ? 0 : d.ano,
        },
      }));

    const agendamento = await tx.agendamento.create({
      data: {
        tenantId: tenant.id,
        usuarioId: coringa.id,
        veiculoId: veiculo.id,
        servicoId: servico.id,
        dataHora,
        formaPagamento: "LOCAL",
        status: "PENDENTE_PAGAMENTO",
        valor,
        contatoNome: d.contatoNome,
        contatoTelefone: d.contatoTelefone,
      },
    });

    return { id: agendamento.id } as const;
  }).catch((erro) => {
    if (erro instanceof FilaDeAgendamentoOcupada) {
      return {
        error: "Muitas confirmacoes para esse dia agora. Tente de novo em instantes.",
        httpStatus: 503,
      } as const;
    }
    throw erro;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.httpStatus });
  }
  return NextResponse.json(resultado, { status: 201 });
}
