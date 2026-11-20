import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CNC · Control previo al uso",
  description: "Checklist preventivo y registro compartido de mantenimiento de la CNC de IMAD-3D.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
