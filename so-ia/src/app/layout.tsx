import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModeProvider } from "@/components/providers/mode-provider";
import { OrganizationProvider } from "@/components/providers/organization-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SO-IA — Sistema Operacional de IA",
  description:
    "Plataforma de agentes de IA governados para empresas e o setor público brasileiro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ModeProvider>
            <OrganizationProvider>
              <TooltipProvider delay={200}>{children}</TooltipProvider>
            </OrganizationProvider>
          </ModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
