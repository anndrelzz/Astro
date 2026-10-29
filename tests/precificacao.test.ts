import { describe, expect, test } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { calcularPreco } from "@/lib/precificacao";

// RN01 — calcularPreco decide se o cliente ve e agenda o servico para o tipo
// do carro dele: a vitrine, a escolha do veiculo, a tela de pagamento e o
// POST /api/agendamentos dependem dela. R$ 0 e o valor provisorio de um tipo
// recem-criado, entao conta como "sem preco".
//
// Nao usa banco.

const HATCH = "hatch";
const SUV = "suv";

const precos = [
  { segmentoId: HATCH, valor: new Prisma.Decimal(80) },
  { segmentoId: SUV, valor: new Prisma.Decimal(0) },
];

describe("preco por tipo de veiculo", () => {
  test("tipo com preco: devolve o valor da tabela", () => {
    expect(calcularPreco(precos, HATCH)?.toNumber()).toBe(80);
  });

  test("tipo com R$ 0 (ainda nao preenchido): sem preco", () => {
    expect(calcularPreco(precos, SUV)).toBeNull();
  });

  test("tipo sem linha de preco: sem preco", () => {
    expect(calcularPreco(precos, "van")).toBeNull();
  });

  test("centavos contam como preco", () => {
    const centavos = [{ segmentoId: HATCH, valor: new Prisma.Decimal("0.01") }];
    expect(calcularPreco(centavos, HATCH)?.toNumber()).toBe(0.01);
  });
});
