import type { Metadata } from "next";
import { ToastProvider } from "@heroui/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacturaStock",
  description: "Inventario y ventas para tu tienda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        {children}
        <ToastProvider placement="top end" />
      </body>
    </html>
  );
}
