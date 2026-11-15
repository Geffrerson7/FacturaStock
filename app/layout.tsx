import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@heroui/react";

import { THEME_INIT_SCRIPT } from "@/src/lib/theme";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "FacturaStock",
    template: "%s · FacturaStock",
  },
  description: "Inventario y ventas para tu tienda.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // El script en línea fija `data-theme` antes de la hidratación, por eso el
    // atributo puede no coincidir con lo que renderizó el servidor.
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
        <ToastProvider placement="top end" />
      </body>
    </html>
  );
}
