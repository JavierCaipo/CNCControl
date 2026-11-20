import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CNC-Control · Consola Operativa",
  description: "Checklist preventivo y registro compartido de control previo al uso de maquinaria CNC industrial.",
};

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

