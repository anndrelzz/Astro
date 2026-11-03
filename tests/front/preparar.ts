// Roda antes de cada arquivo de teste do front.
//
// jest-dom acrescenta ao expect verificacoes de tela, como
// toBeInTheDocument() e toHaveTextContent(). O cleanup desmonta o que o teste
// desenhou, para um teste nao enxergar a tela do anterior.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
