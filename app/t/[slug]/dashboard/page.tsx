"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Download,
  Printer,
  ShieldCheck,
  AlertOctagon,
  Clock,
  TrendingUp,
  Server,
  Loader2,
  RefreshCw,
  BarChart3,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MachineItem {
  id: string;
  code: string;
  name: string;
}

interface AnalyticsSummary {
  totalSnapshots: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  complianceRate: number;
  pendingApprovals: number;
  dailyTrend: Array<{
    date: string;
    total: number;
    ok: number;
    warning: number;
    critical: number;
  }>;
  topRecurringFaults: Array<{
    id: string;
    title: string;
    group: string;
    count: number;
    percentage: number;
  }>;
  machineBreakdown: Array<{
    machineId: string;
    code: string;
    name: string;
    totalSnapshots: number;
    okCount: number;
    warningCount: number;
    criticalCount: number;
    complianceRate: number;
  }>;
}

export default function TenantDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params?.slug || "").toLowerCase().trim();

  // Range and filter state
  const [rangeDays, setRangeDays] = React.useState<"7" | "30" | "90">("30");
  const [selectedMachineId, setSelectedMachineId] = React.useState<string>("all");
  const [machines, setMachines] = React.useState<MachineItem[]>([]);
  const [tenantName, setTenantName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<AnalyticsSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = React.useState(0);

  // 1. Cargar datos del inquilino y lista de máquinas
  React.useEffect(() => {
    let isMounted = true;
    if (!slug) return;

    async function loadTenantData() {
      try {
        const tRes = await fetch(`/api/tenants/${encodeURIComponent(slug)}`);
        if (tRes.ok && isMounted) {
          const tData = await tRes.json();
          setTenantName(tData.tenant?.name || slug.toUpperCase());
        }

        const mRes = await fetch(`/api/machines?org=${encodeURIComponent(slug)}`);
        if (mRes.ok && isMounted) {
          const mData = await mRes.json();
          setMachines(mData.machines || []);
        }
      } catch (err) {
        console.error("Error al inicializar dashboard:", err);
      }
    }

    loadTenantData();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // 2. Cargar analítica según rango y máquina seleccionada
  React.useEffect(() => {
    let isMounted = true;
    if (!slug) return;

    async function loadAnalytics() {
      try {
        const days = parseInt(rangeDays, 10);
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

        const q = new URLSearchParams({
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        });
        if (selectedMachineId !== "all") {
          q.set("machineId", selectedMachineId);
        }

        const res = await fetch(`/api/analytics/summary?${q.toString()}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.push(`/t/${slug}`);
            return;
          }
          throw new Error("No se pudo obtener el resumen de analítica.");
        }

        const data = await res.json();
        if (isMounted) {
          setSummary(data.summary);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Error al cargar datos.";
          setError(msg);
          setLoading(false);
        }
      }
    }

    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [rangeDays, selectedMachineId, slug, router, reloadTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const handleExportCsv = () => {
    const days = parseInt(rangeDays, 10);
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    const q = new URLSearchParams({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    });
    if (selectedMachineId !== "all") {
      q.set("machineId", selectedMachineId);
    }

    window.open(`/api/snapshots/export?${q.toString()}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* HEADER SUPERIOR */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/t/${slug}`}
              className="p-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Volver a consola operativa"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <h1 className="font-bold text-base leading-tight">
                  Dashboard Gerencial · {tenantName || slug}
                </h1>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Métricas de cumplimiento, tendencias y reportes de calidad operativa.
              </p>
            </div>
          </div>

          {/* ACCIONES Y FILTROS */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Rango de Días */}
            <div className="flex items-center rounded-lg border border-border bg-muted/20 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRangeDays("7")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  rangeDays === "7"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                7 días
              </button>
              <button
                type="button"
                onClick={() => setRangeDays("30")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  rangeDays === "30"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                30 días
              </button>
              <button
                type="button"
                onClick={() => setRangeDays("90")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  rangeDays === "90"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                90 días
              </button>
            </div>

            {/* Selector de Máquina */}
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger className="w-[160px] sm:w-[190px] h-8 text-xs font-mono">
                <SelectValue placeholder="Máquina..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas las máquinas
                </SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                    {m.code} · {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Botón Refrescar */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8 text-xs gap-1"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>

            {/* Exportar CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Exportar Excel (CSV)</span>
              <span className="sm:hidden">CSV</span>
            </Button>

            {/* Imprimir Reporte PDF */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>Imprimir Reporte</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ENCABEZADO EXCLUSIVO PARA IMPRESIÓN (PRINT) */}
      <div className="hidden print:block p-6 border-b border-black">
        <h1 className="text-xl font-bold">Reporte de Control Operativo · {tenantName}</h1>
        <p className="text-xs text-gray-600">
          Rango evaluado: Últimos {rangeDays} días · Generado: {new Date().toLocaleString("es-PE")}
        </p>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-6 w-full">
        {error && (
          <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertOctagon className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 TARJETAS KPI PRINCIPALES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Tasa de Cumplimiento */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tasa de Cumplimiento</span>
              <ShieldCheck className="size-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono">
                {summary ? `${summary.complianceRate}%` : "—"}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-400" />
                <span>Turnos libres de anomalías críticas</span>
              </p>
            </CardContent>
          </Card>

          {/* KPI 2: Total de Revisiones */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Revisiones</span>
              <Calendar className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono">
                {summary ? summary.totalSnapshots : "—"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {summary
                  ? `${summary.okCount} conformes · ${summary.warningCount} alertas`
                  : "Cargando..."}
              </p>
            </CardContent>
          </Card>

          {/* KPI 3: Anomalías Críticas */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Anomalías Críticas</span>
              <AlertOctagon className="size-4 text-destructive" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono text-destructive">
                {summary ? summary.criticalCount : "—"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {summary?.criticalCount
                  ? `${summary.criticalCount} turnos requirieron intervención`
                  : "0 turnos detenidos"}
              </p>
            </CardContent>
          </Card>

          {/* KPI 4: Pendientes de Firma */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pendientes de Firma</span>
              <Clock className="size-4 text-amber-400" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono text-amber-400">
                {summary ? summary.pendingApprovals : "—"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Revisiones por validar por supervisor
              </p>
            </CardContent>
          </Card>
        </section>

        {/* GRÁFICAS: TENDENCIA DIARIA + TOP 5 ANOMALÍAS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfica de Tendencia Diaria */}
          <Card className="lg:col-span-2 border-border bg-card shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <span>Tendencia Diaria de Turnos</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Distribución de inspecciones conformes (verde) vs con anomalías (rojo) por día.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-60 flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="size-6 animate-spin text-primary mr-2" />
                  Cargando tendencia...
                </div>
              ) : !summary || summary.dailyTrend.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-muted-foreground border rounded-lg border-dashed">
                  No hay datos registrados en el rango de fechas seleccionado.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Visualización de barras por día */}
                  <div className="h-48 flex items-end gap-1.5 sm:gap-2 pt-6 overflow-x-auto pb-2 border-b border-border/60">
                    {summary.dailyTrend.map((d) => {
                      const maxVal = Math.max(
                        ...summary.dailyTrend.map((x) => x.total),
                        1
                      );
                      const heightPercent = Math.max(
                        Math.round((d.total / maxVal) * 100),
                        8
                      );
                      const hasFaults = d.critical > 0;

                      return (
                        <div
                          key={d.date}
                          className="flex-1 min-w-[28px] max-w-[44px] flex flex-col items-center gap-1 group relative"
                        >
                          {/* Tooltip simple en hover */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-20 border border-border">
                            {d.date}: {d.total} turnos ({d.ok} OK, {d.critical} Críticos)
                          </div>

                          <div
                            className={`w-full rounded-t-md transition-all ${
                              hasFaults ? "bg-destructive/80" : "bg-emerald-600/80"
                            } group-hover:opacity-100`}
                            style={{ height: `${heightPercent}%` }}
                          />

                          <span className="text-[9px] font-mono text-muted-foreground rotate-45 sm:rotate-0 origin-left pt-1">
                            {d.date.slice(8, 10)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-emerald-600" />
                      <span>Conforme</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-destructive" />
                      <span>Con Anomalías</span>
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Fallas Recurrentes */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="size-4 text-amber-400" />
                <span>Top Fallas Recurrentes</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Puntos del checklist con mayor tasa de detección de anomalías.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-60 flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : !summary || summary.topRecurringFaults.length === 0 ? (
                <div className="h-60 flex flex-col items-center justify-center text-xs text-muted-foreground border rounded-lg border-dashed p-4 text-center">
                  <ShieldCheck className="size-8 text-emerald-400 mb-2" />
                  <span>Sin anomalías recurrentes registradas en este período.</span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {summary.topRecurringFaults.map((f, i) => (
                    <div key={f.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground truncate pr-2">
                          {i + 1}. {f.title}
                        </span>
                        <span className="font-mono font-bold text-destructive shrink-0">
                          {f.count} ({f.percentage}%)
                        </span>
                      </div>
                      {/* Barra de progreso */}
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-destructive/80 rounded-full"
                          style={{ width: `${Math.min(f.percentage * 2, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        Grupo: {f.group}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* TABLA DE RENDIMIENTO POR MÁQUINA */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <span>Rendimiento por Máquina CNC</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Tasa de cumplimiento y frecuencia de incidentes clasificados por equipo.
              </p>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Máquina</th>
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4 text-center">Total Revisiones</th>
                    <th className="py-2.5 px-4 text-center">Conformes</th>
                    <th className="py-2.5 px-4 text-center">Alertas / Críticas</th>
                    <th className="py-2.5 px-4 text-right">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {!summary || summary.machineBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No hay revisiones para las máquinas en el período.
                      </td>
                    </tr>
                  ) : (
                    summary.machineBreakdown.map((m) => (
                      <tr key={m.machineId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {m.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {m.code}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium">
                          {m.totalSnapshots}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-400">
                          {m.okCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {m.criticalCount > 0 ? (
                            <span className="text-destructive font-bold">{m.criticalCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge
                            variant={
                              m.complianceRate >= 90
                                ? "default"
                                : m.complianceRate >= 75
                                ? "outline"
                                : "destructive"
                            }
                            className={`font-mono text-[10px] ${
                              m.complianceRate >= 90
                                ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                                : m.complianceRate >= 75
                                ? "text-amber-400 border-amber-500/30"
                                : ""
                            }`}
                          >
                            {m.complianceRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border py-4 px-6 text-center text-xs text-muted-foreground bg-card/40 print:hidden">
        <p>Registro compartido · Manual V1. - Desarrollado por Santiago Caipo</p>
      </footer>
    </div>
  );
}

