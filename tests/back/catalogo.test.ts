import { describe, expect, test } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { validarPrecosCompletos } from "@/back/catalogo";
import { calcularPreco } from "@/compartilhado/precificacao";

// RF04, RN01 — o preco vem do segmento do veiculo, e todo servico tem preco
// para todo segmento ativo da estetica.

const SEDAN = "11111111-1111-4111-8111-111111111111";
const PICAPE = "22222222-2222-4222-8222-222222222222";
const VAN = "33333333-3333-4333-8333-333333333333";

describe("calcularPreco", () => {
  const precos = [
    { segmentoId: SEDAN, valor: new Prisma.Decimal(80) },
    { segmentoId: PICAPE, valor: new Prisma.Decimal(120) },
  ];

  test("devolve o preco do segmento do veiculo", () => {
    expect(Number(calcularPreco(precos, PICAPE))).toBe(120);
  });

  test("segmento sem preco devolve null, nunca um valor inventado", () => {
    expect(calcularPreco(precos, VAN)).toBeNull();
    expect(calcularPreco([], SEDAN)).toBeNull();
  });
});

describe("validarPrecosCompletos", () => {
  // Segmentos ativos que o "banco" devolve para a estetica.
  function bancoFalso(ativos: { id: string; nome: string }[]) {
    const consultas: unknown[] = [];
    const tx = {
      segmento: {
        findMany: async (args: unknown) => {
          consultas.push(args);
          return ativos;
        },
      },
    } as unknown as Prisma.TransactionClient;
    return { tx, consultas };
  }

  const ativos = [
    { id: SEDAN, nome: "Sedan" },
    { id: PICAPE, nome: "Picape" },
  ];

  test("lista completa passa e busca so os segmentos ativos da estetica", async () => {
    const { tx, consultas } = bancoFalso(ativos);
    const erro = await validarPrecosCompletos(tx, "tenant-1", [
      { segmentoId: SEDAN, valor: 80 },
      { segmentoId: PICAPE, valor: 120 },
    ]);
    expect(erro).toBeNull();
    expect(consultas[0]).toMatchObject({ where: { tenantId: "tenant-1", ativo: true } });
  });

  test("segmento sem preco gera mensagem com o nome dele", async () => {
    const { tx } = bancoFalso(ativos);
    const erro = await validarPrecosCompletos(tx, "tenant-1", [{ segmentoId: SEDAN, valor: 80 }]);
    expect(erro).toBe("Informe o preco para: Picape");
  });

  test("preco para segmento removido ou de outra estetica e recusado", async () => {
    const { tx } = bancoFalso(ativos);
    const erro = await validarPrecosCompletos(tx, "tenant-1", [
      { segmentoId: SEDAN, valor: 80 },
      { segmentoId: PICAPE, valor: 120 },
      { segmentoId: VAN, valor: 150 },
    ]);
    expect(erro).toBe("Ha preco para um tipo de veiculo que nao existe ou foi removido");
  });
});
