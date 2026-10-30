"use client";

import { useEffect } from "react";

// Faz a cor da tela preencher ate as bordas do celular (barra de status e
// overscroll), evitando a faixa branca que faz parecer uma imagem flutuando.
// Ajusta a meta theme-color (barra do navegador) e o fundo de <html> e <body>.
export function ThemeColor({ color }: { color: string }) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    const prevMeta = meta.content;
    const prevHtml = document.documentElement.style.backgroundColor;
    const prevBody = document.body.style.backgroundColor;

    meta.content = color;
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;

    return () => {
      meta!.content = prevMeta;
      document.documentElement.style.backgroundColor = prevHtml;
      document.body.style.backgroundColor = prevBody;
    };
  }, [color]);

  return null;
}
