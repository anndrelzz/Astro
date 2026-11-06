import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  ENDERECOS_PROIBIDOS,
  MAX_LETRAS_ENDERECO,
  MIN_LETRAS_ENDERECO,
  normalizarEndereco,
  problemaNoEndereco,
  sugerirEndereco,
} from "@/compartilhado/endereco-estetica";

// Autocadastro (decisao do orientador, 30/10; detalhes do Andre, 06/11) — o
// endereco do site da estetica (useastro.app.br/<endereco>). O dono escolhe
// como quiser, porque e ele quem divulga o link; o sistema so garante que o
// link funciona em qualquer celular e nao colide com uma pagina do Astro.

describe("sugerirEndereco", () => {
  test("vem do nome, sem hifen, sem acento e em minusculas", () => {
    expect(sugerirEndereco("Estética do João")).toBe("esteticadojoao");
  });

  test("tira o que nao e letra ou numero", () => {
    expect(sugerirEndereco("Lava & Brilha Car's 2")).toBe("lavabrilhacars2");
  });

  test("corta no tamanho maximo", () => {
    expect(sugerirEndereco("a".repeat(60))).toHaveLength(MAX_LETRAS_ENDERECO);
  });
});

describe("normalizarEndereco", () => {
  test("o que o dono digita vira um link valido, mantendo os hifens que ele quis", () => {
    expect(normalizarEndereco("EsteticaDoJoao")).toBe("esteticadojoao");
    expect(normalizarEndereco("estética joão")).toBe("esteticajoao");
    expect(normalizarEndereco("estetica-do-joao")).toBe("estetica-do-joao");
  });

  test("hifen repetido vira um so, e hifen nas pontas sai", () => {
    expect(normalizarEndereco("joão--car-")).toBe("joao-car");
    expect(normalizarEndereco("-joao")).toBe("joao");
  });
});

describe("problemaNoEndereco", () => {
  test("endereco bom nao tem problema", () => {
    expect(problemaNoEndereco("esteticadojoao")).toBeNull();
    expect(problemaNoEndereco("joao-car-2")).toBeNull();
  });

  test("curto ou longo demais", () => {
    expect(problemaNoEndereco("a".repeat(MIN_LETRAS_ENDERECO - 1))).toBe("curto");
    expect(problemaNoEndereco("a".repeat(MAX_LETRAS_ENDERECO + 1))).toBe("longo");
  });

  test("so aceita o endereco ja normalizado", () => {
    expect(problemaNoEndereco("Joao")).toBe("invalido");
    expect(problemaNoEndereco("joao car")).toBe("invalido");
    expect(problemaNoEndereco("joao--car")).toBe("invalido");
  });

  test("os enderecos do proprio Astro sao proibidos", () => {
    for (const endereco of ["api", "admin", "start", "login", "email", "landing", "uploads"]) {
      expect(problemaNoEndereco(endereco)).toBe("proibido");
    }
  });
});

describe("ENDERECOS_PROIBIDOS", () => {
  // Uma pasta nova em public/ ou uma rota nova na raiz de src/app passaria a
  // ser engolida por uma estetica com o mesmo endereco (ou o contrario). Este
  // teste quebra ate a pasta entrar na lista.
  const raiz = path.resolve(import.meta.dirname, "../..");
  const pastas = (pasta: string) =>
    readdirSync(path.join(raiz, pasta), { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      // [slug] e a propria estetica; _landing e (grupo) nao viram endereco.
      .filter((nome) => !/^[[(_]/.test(nome));

  test("tem todas as pastas de public/ e as rotas da raiz do site", () => {
    for (const nome of [...pastas("public"), ...pastas("src/app")]) {
      expect(ENDERECOS_PROIBIDOS).toContain(nome);
    }
  });
});
