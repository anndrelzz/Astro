import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Astro — Agendamento para Estéticas Automotivas",
  description:
    "Agende serviços de estética automotiva online, com preço por segmento de veículo e pagamento via PIX.",
};

// viewport-fit=cover — deixa o fundo preencher ate as bordas (notch/safe area),
// para as telas nao parecerem uma imagem flutuando. themeColor padrao = navy.
export const viewport: Viewport = {
  themeColor: "#0b1120",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
