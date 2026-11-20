import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "CNC-Control · Super Admin",
  description: "Panel de administración global y gestión multi-tenant para CNC-Control.",
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
