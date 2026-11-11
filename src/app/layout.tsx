import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ser Elemental · CRM", template: "%s · Ser Elemental" },
  description: "CRM del consultorio Ser Elemental.",
  robots: { index: false, follow: false },
  // Nombre que propone el iPhone al «Agregar a Inicio» (el icono es apple-icon.png).
  appleWebApp: { title: "Ser Elemental" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
