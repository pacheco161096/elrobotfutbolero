import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "El Robot Futbolero",
  description: "Noticias de fútbol mexicano. Liga MX, selección y lo que está pasando.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
