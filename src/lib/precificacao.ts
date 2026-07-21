import type { Servico } from "@/generated/prisma/client";
import type { SegmentoVeiculo } from "@/generated/prisma/enums";

// RF04, RN01 — preco calculado automaticamente pelo segmento do veiculo,
// nunca alterado manualmente pelo cliente.
export function calcularPreco(servico: Servico, segmento: SegmentoVeiculo) {
  switch (segmento) {
    case "HATCH":
      return servico.precoHatch;
    case "SEDAN":
      return servico.precoSedan;
    case "SUV":
      return servico.precoSuv;
    case "PICKUP":
      return servico.precoPickup;
    case "VAN":
      return servico.precoVan;
  }
}
