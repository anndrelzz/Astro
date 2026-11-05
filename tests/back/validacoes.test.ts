import { describe, expect, test } from "vitest";
import { LIMITES } from "@/compartilhado/validacoes/limites";
import { segmentoNovoSchema, segmentoSchema } from "@/compartilhado/validacoes/segmento";
import { servicoSchema } from "@/compartilhado/validacoes/servico";
import { horarioDiaSchema, horariosSchema, tenantConfigSchema } from "@/compartilhado/validacoes/tenant";
import { veiculoSchema } from "@/compartilhado/validacoes/veiculo";

// Regras que o servidor aplica a tudo o que chega dos formularios. A tela
// confere antes, mas quem decide e o servidor: um pedido montado na mao passa
// por aqui do mesmo jeito.

const UUID = "11111111-1111-4111-8111-111111111111";

// Primeira mensagem de erro, para comparar com o texto que a tela mostra.
function erro(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.success ? null : resultado.error!.issues[0].message;
}

describe("veiculoSchema", () => {
  const valido = {
    marca: "Toyota",
    modelo: "Corolla",
    placa: "ABC1D23",
    ano: 2022,
    cor: "Prata",
    segmentoId: UUID,
  };

  test("aceita placa Mercosul", () => {
    expect(veiculoSchema.parse(valido).placa).toBe("ABC1D23");
  });

  test("aceita placa antiga, com ou sem hifen, e guarda sem hifen", () => {
    expect(veiculoSchema.parse({ ...valido, placa: "ABC-1234" }).placa).toBe("ABC1234");
    expect(veiculoSchema.parse({ ...valido, placa: "ABC1234" }).placa).toBe("ABC1234");
  });

  test("placa em minusculas e com espacos e normalizada", () => {
    expect(veiculoSchema.parse({ ...valido, placa: " abc 1d23 " }).placa).toBe("ABC1D23");
  });

  test("recusa placa fora dos dois padroes", () => {
    for (const placa of ["AB1D23", "ABCD123", "1234ABC", "ABC1DD3", ""]) {
      expect(erro(veiculoSchema.safeParse({ ...valido, placa }))).toBe(
        "Placa invalida - use o formato ABC-1234 ou ABC1D23 (Mercosul)"
      );
    }
  });

  test("ano chega como texto do formulario e vira numero", () => {
    expect(veiculoSchema.parse({ ...valido, ano: "2020" }).ano).toBe(2020);
  });

  test("ano vai de 1950 ate o ano que vem", () => {
    const anoQueVem = new Date().getFullYear() + 1;
    expect(veiculoSchema.safeParse({ ...valido, ano: 1950 }).success).toBe(true);
    expect(veiculoSchema.safeParse({ ...valido, ano: anoQueVem }).success).toBe(true);
    expect(erro(veiculoSchema.safeParse({ ...valido, ano: 1949 }))).toBe("Ano invalido");
    expect(erro(veiculoSchema.safeParse({ ...valido, ano: anoQueVem + 1 }))).toBe("Ano invalido");
  });

  test("campos de texto obrigatorios e com limite", () => {
    expect(erro(veiculoSchema.safeParse({ ...valido, marca: "" }))).toBe("Informe a marca");
    expect(
      veiculoSchema.safeParse({ ...valido, modelo: "x".repeat(LIMITES.modeloVeiculo + 1) }).success
    ).toBe(false);
    expect(veiculoSchema.safeParse({ ...valido, cor: "x".repeat(LIMITES.corVeiculo) }).success).toBe(
      true
    );
  });

  test("tipo de veiculo precisa ser um id valido", () => {
    expect(erro(veiculoSchema.safeParse({ ...valido, segmentoId: "sedan" }))).toBe(
      "Escolha o tipo de veiculo"
    );
  });
});

describe("servicoSchema", () => {
  const valido = {
    nome: "Lavagem completa",
    duracaoMin: 60,
    precos: [{ segmentoId: UUID, valor: 80 }],
  };

  test("servico novo fica ativo e sem descricao por padrao", () => {
    expect(servicoSchema.parse(valido)).toMatchObject({ ativo: true, descricao: null });
  });

  test("descricao so de espacos vira null", () => {
    expect(servicoSchema.parse({ ...valido, descricao: "   " }).descricao).toBeNull();
  });

  test("duracao minima de 5 minutos", () => {
    expect(erro(servicoSchema.safeParse({ ...valido, duracaoMin: 4 }))).toBe(
      "Duracao minima de 5 minutos"
    );
  });

  test("nome obrigatorio e com limite", () => {
    expect(erro(servicoSchema.safeParse({ ...valido, nome: "" }))).toBe("Informe o nome do servico");
    expect(
      servicoSchema.safeParse({ ...valido, nome: "x".repeat(LIMITES.nomeServico + 1) }).success
    ).toBe(false);
  });

  test("precisa de ao menos um preco, e preco nao pode ser negativo", () => {
    expect(erro(servicoSchema.safeParse({ ...valido, precos: [] }))).toBe(
      "Informe o preco para cada tipo de veiculo"
    );
    expect(
      erro(servicoSchema.safeParse({ ...valido, precos: [{ segmentoId: UUID, valor: -1 }] }))
    ).toBe("Preco invalido");
  });
});

describe("segmentoSchema", () => {
  test("tira os espacos do nome", () => {
    expect(segmentoSchema.parse({ nome: "  Picape grande ", ordem: "2" })).toEqual({
      nome: "Picape grande",
      ordem: 2,
    });
  });

  test("nome vazio ou com mais de 30 letras e recusado", () => {
    expect(erro(segmentoSchema.safeParse({ nome: "   ", ordem: 0 }))).toBe(
      "Informe o nome do tipo de veiculo"
    );
    expect(erro(segmentoSchema.safeParse({ nome: "x".repeat(31), ordem: 0 }))).toBe(
      "Nome muito longo - use ate 30 caracteres"
    );
  });

  test("segmento novo pode copiar os precos de outro", () => {
    expect(segmentoNovoSchema.parse({ nome: "Van", ordem: 3, copiarPrecosDe: UUID })).toMatchObject({
      copiarPrecosDe: UUID,
    });
    expect(segmentoNovoSchema.safeParse({ nome: "Van", ordem: 3, copiarPrecosDe: "sedan" }).success).toBe(
      false
    );
  });
});

describe("tenantConfigSchema", () => {
  test("atualizacao precisa de ao menos um campo", () => {
    expect(erro(tenantConfigSchema.safeParse({}))).toBe("Informe ao menos um campo para atualizar");
  });

  test("telefone e WhatsApp ficam so com os numeros", () => {
    expect(tenantConfigSchema.parse({ whatsapp: "(47) 99999-1234" }).whatsapp).toBe("47999991234");
    expect(tenantConfigSchema.parse({ telefone: "(47) 3333-1234" }).telefone).toBe("4733331234");
  });

  test("telefone sem DDD e recusado", () => {
    expect(erro(tenantConfigSchema.safeParse({ whatsapp: "99999-1234" }))).toBe(
      "Telefone inválido: informe o DDD e o número completo"
    );
  });

  test("campo opcional vazio vira null", () => {
    const r = tenantConfigSchema.parse({ whatsapp: "", descricao: "  ", emailContato: "" });
    expect(r).toMatchObject({ whatsapp: null, descricao: null, emailContato: null });
  });

  test("e-mail de contato precisa ser valido", () => {
    expect(erro(tenantConfigSchema.safeParse({ emailContato: "contato@" }))).toBe("E-mail inválido");
    expect(tenantConfigSchema.parse({ emailContato: "contato@estimacar.com.br" }).emailContato).toBe(
      "contato@estimacar.com.br"
    );
  });

  test("CEP com 8 numeros, aceito com traco", () => {
    expect(tenantConfigSchema.parse({ cep: "89010-000" }).cep).toBe("89010000");
    expect(erro(tenantConfigSchema.safeParse({ cep: "8901" }))).toBe(
      "CEP inválido: o CEP tem 8 números"
    );
  });

  test("estado e a sigla de 2 letras, em maiuscula", () => {
    expect(tenantConfigSchema.parse({ estado: "sc" }).estado).toBe("SC");
    expect(erro(tenantConfigSchema.safeParse({ estado: "Santa Catarina" }))).toBe(
      "Estado inválido: use a sigla de 2 letras"
    );
  });

  test("acrescimo por condicao vai de 1% a 100%, ou desligado", () => {
    expect(tenantConfigSchema.parse({ acrescimoCondicaoPercent: "30" }).acrescimoCondicaoPercent).toBe(30);
    expect(tenantConfigSchema.parse({ acrescimoCondicaoPercent: null }).acrescimoCondicaoPercent).toBeNull();
    expect(erro(tenantConfigSchema.safeParse({ acrescimoCondicaoPercent: 0 }))).toBe(
      "Use ao menos 1%, ou desligue o acréscimo"
    );
    expect(erro(tenantConfigSchema.safeParse({ acrescimoCondicaoPercent: 101 }))).toBe("Máximo de 100%");
  });

  test("capacidade, intervalo e janela de cancelamento tem minimos", () => {
    expect(erro(tenantConfigSchema.safeParse({ capacidadeSimultanea: 0 }))).toBe("Mínimo de 1");
    expect(erro(tenantConfigSchema.safeParse({ intervaloMinutos: 4 }))).toBe("Mínimo de 5 minutos");
    expect(erro(tenantConfigSchema.safeParse({ cancelamentoHorasLimite: -1 }))).toBe("Valor inválido");
  });

  test("cor da estetica no formato #RRGGBB", () => {
    expect(tenantConfigSchema.parse({ corPrimaria: "#1C3FAA" }).corPrimaria).toBe("#1C3FAA");
    expect(erro(tenantConfigSchema.safeParse({ corPrimaria: "azul" }))).toBe(
      "Cor inválida: use o formato #RRGGBB"
    );
  });

  test("codigo PIX colado tem limite", () => {
    expect(
      tenantConfigSchema.safeParse({ pixChaveCopiaCola: "x".repeat(LIMITES.pixCopiaCola + 1) }).success
    ).toBe(false);
  });

  test("o endereco do link (slug) nao pode ser alterado por aqui", () => {
    expect(tenantConfigSchema.parse({ nome: "EstimaCar", slug: "outro" })).not.toHaveProperty("slug");
  });
});

describe("horarios de funcionamento", () => {
  const dia = { diaSemana: 1, ativo: true, horaInicio: "08:00", horaFim: "18:00" };

  test("aceita um dia aberto com horario valido", () => {
    expect(horarioDiaSchema.safeParse(dia).success).toBe(true);
  });

  test("fechamento precisa ser depois da abertura", () => {
    expect(erro(horarioDiaSchema.safeParse({ ...dia, horaFim: "08:00" }))).toBe(
      "Horario de fechamento deve ser depois do de abertura"
    );
  });

  test("dia fechado nao confere a ordem dos horarios", () => {
    expect(horarioDiaSchema.safeParse({ ...dia, ativo: false, horaFim: "07:00" }).success).toBe(true);
  });

  test("hora fora de 00:00 a 23:59 e recusada", () => {
    expect(erro(horarioDiaSchema.safeParse({ ...dia, horaFim: "24:00" }))).toBe("Horario invalido");
    expect(erro(horarioDiaSchema.safeParse({ ...dia, horaInicio: "8:00" }))).toBe("Horario invalido");
  });

  test("a grade da semana tem exatamente 7 dias", () => {
    const semana = Array.from({ length: 7 }, (_, i) => ({ ...dia, diaSemana: i }));
    expect(horariosSchema.safeParse(semana).success).toBe(true);
    expect(horariosSchema.safeParse(semana.slice(0, 6)).success).toBe(false);
  });
});
