import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { tipoDaImagem } from "../src/lib/imagem";

// O upload do logo decide o formato pelo conteudo do arquivo. Estes casos
// cobrem os tres formatos aceitos e os disfarces que o `type` do navegador
// deixava passar.

const bytes = (...partes: (number[] | string)[]) =>
  new Uint8Array(
    partes.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p))
  );

describe("tipoDaImagem", () => {
  test("reconhece PNG", () => {
    assert.equal(tipoDaImagem(bytes([0x89], "PNG\r\n\x1a\n", [0, 0, 0, 13])), "image/png");
  });

  test("reconhece JPEG", () => {
    assert.equal(tipoDaImagem(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), "image/jpeg");
  });

  test("reconhece WEBP", () => {
    assert.equal(tipoDaImagem(bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ")), "image/webp");
  });

  test("RIFF que nao e WEBP (ex: WAV) e recusado", () => {
    assert.equal(tipoDaImagem(bytes("RIFF", [0x24, 0, 0, 0], "WAVEfmt ")), null);
  });

  test("HTML renomeado para .png e recusado", () => {
    assert.equal(tipoDaImagem(bytes("<html><script>alert(1)</script>")), null);
  });

  test("SVG e recusado", () => {
    assert.equal(tipoDaImagem(bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')), null);
  });

  test("arquivo vazio ou curto demais e recusado", () => {
    assert.equal(tipoDaImagem(new Uint8Array()), null);
    assert.equal(tipoDaImagem(bytes([0x89, 0x50])), null);
  });
});
