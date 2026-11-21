"use client";

import * as React from "react";
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Building2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateQrMatrix, generateQrSvg } from "@/lib/qr-code";
import { Machine } from "./cnc-machines-modal";

interface CncQrCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  slug: string;
  tenantName: string;
  logoUrl?: string | null;
}

export function CncQrCardModal({
  open,
  onOpenChange,
  machine,
  slug,
  tenantName,
  logoUrl,
}: CncQrCardModalProps) {
  const [copied, setCopied] = React.useState(false);
  const [isExportingPng, setIsExportingPng] = React.useState(false);

  const qrUrl = React.useMemo(() => {
    if (!machine) return "";
    if (typeof window !== "undefined") {
      return `${window.location.origin}/t/${slug}?machine=${encodeURIComponent(machine.code)}`;
    }
    return `https://cnc.control/t/${slug}?machine=${encodeURIComponent(machine.code)}`;
  }, [machine, slug]);

  const qrSvgXml = React.useMemo(() => {
    if (!qrUrl) return "";
    return generateQrSvg(qrUrl, 260, {
      level: "H",
      logoUrl: logoUrl || undefined,
      logoPercent: 20,
      margin: 3,
    });
  }, [qrUrl, logoUrl]);

  const handleCopyLink = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async () => {
    if (!machine || !qrUrl) return;
    setIsExportingPng(true);

    try {
      const width = 900;
      const height = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");

      // Helper function to draw rounded rectangle
      const drawRoundRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number,
        fillColor?: string,
        strokeColor?: string,
        lineWidth?: number
      ) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
        if (strokeColor && lineWidth) {
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = strokeColor;
          ctx.stroke();
        }
      };

      // 1. Fondo Oscuro Industrial
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);

      // Marco decorativo industrial
      drawRoundRect(24, 24, width - 48, height - 48, 28, undefined, "#1e293b", 3);
      drawRoundRect(36, 36, width - 72, height - 72, 22, undefined, "#0f172a", 1.5);

      // Cargar imagen de logo si existe
      let logoImage: HTMLImageElement | null = null;
      if (logoUrl) {
        logoImage = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = logoUrl;
        });
      }

      // 2. Encabezado de la Planta
      let headerY = 75;
      if (logoImage) {
        const logoSize = 64;
        const logoX = (width - logoSize) / 2;
        drawRoundRect(logoX - 6, headerY - 6, logoSize + 12, logoSize + 12, 14, "#ffffff", "#38bdf8", 2);
        ctx.drawImage(logoImage, logoX, headerY, logoSize, logoSize);
        headerY += 88;
      } else {
        headerY += 24;
      }

      // Badge subtítulo "CONTROL PREVENTIVO CNC"
      ctx.font = "bold 15px 'JetBrains Mono', monospace, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      ctx.letterSpacing = "2px";
      ctx.fillText("CONTROL PREVENTIVO CNC", width / 2, headerY);

      // Nombre de la Organización
      headerY += 38;
      ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.letterSpacing = "0px";
      ctx.fillText(tenantName.toUpperCase(), width / 2, headerY);

      // 3. Contenedor Blanco del Código QR
      const qrBoxSize = 540;
      const qrBoxX = (width - qrBoxSize) / 2;
      const qrBoxY = headerY + 36;
      drawRoundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24, "#ffffff", "#e2e8f0", 2);

      // Dibujar Matrix QR Level H
      const matrix = generateQrMatrix(qrUrl, "H");
      const moduleCount = matrix.length;
      const margin = 28;
      const availableSize = qrBoxSize - margin * 2;
      const moduleSize = availableSize / moduleCount;

      ctx.fillStyle = "#000000";
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (matrix[r][c]) {
            const mx = qrBoxX + margin + c * moduleSize;
            const my = qrBoxY + margin + r * moduleSize;
            ctx.fillRect(mx, my, moduleSize + 0.3, moduleSize + 0.3);
          }
        }
      }

      // 4. Badge central en el QR con Logo de la Planta
      const centerBadgeSize = 110;
      const centerBadgeX = qrBoxX + (qrBoxSize - centerBadgeSize) / 2;
      const centerBadgeY = qrBoxY + (qrBoxSize - centerBadgeSize) / 2;
      drawRoundRect(
        centerBadgeX,
        centerBadgeY,
        centerBadgeSize,
        centerBadgeSize,
        18,
        "#ffffff",
        "#cbd5e1",
        2
      );

      if (logoImage) {
        const innerLogoSize = 88;
        const innerLogoX = centerBadgeX + (centerBadgeSize - innerLogoSize) / 2;
        const innerLogoY = centerBadgeY + (centerBadgeSize - innerLogoSize) / 2;
        ctx.drawImage(logoImage, innerLogoX, innerLogoY, innerLogoSize, innerLogoSize);
      } else {
        // Fallback icon gráfico
        ctx.font = "bold 42px monospace, sans-serif";
        ctx.fillStyle = "#0284c7";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CNC", qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2);
        ctx.textBaseline = "alphabetic";
      }

      // 5. Detalles de la Máquina
      let detailsY = qrBoxY + qrBoxSize + 60;

      // Código de Máquina prominente
      ctx.font = "900 54px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      ctx.fillText(machine.code, width / 2, detailsY);

      // Nombre del equipo
      detailsY += 36;
      ctx.font = "600 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(machine.name, width / 2, detailsY);

      // Modelo y Número de Serie
      const metaParts: string[] = [];
      if (machine.model) metaParts.push(`MODELO: ${machine.model}`);
      if (machine.serialNumber) metaParts.push(`S/N: ${machine.serialNumber}`);
      if (metaParts.length > 0) {
        detailsY += 28;
        ctx.font = "500 18px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(metaParts.join("  ·  "), width / 2, detailsY);
      }

      // 6. Línea divisoria y Footer de instrucciones
      detailsY += 40;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(100, detailsY);
      ctx.lineTo(width - 100, detailsY);
      ctx.stroke();

      detailsY += 34;
      ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Escanea con la cámara para iniciar inspección de turno", width / 2, detailsY);

      detailsY += 24;
      ctx.font = "400 14px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#64748b";
      ctx.fillText(qrUrl, width / 2, detailsY);

      // 7. Descargar imagen PNG
      const pngDataUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngDataUrl;
      downloadLink.download = `QR-${slug}-${machine.code}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error("Error al exportar PNG de etiqueta QR:", err);
    } finally {
      setIsExportingPng(false);
    }
  };

  if (!machine) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg print:border-none print:shadow-none print:p-0 print:max-w-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <QrCode className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Etiqueta QR Industrial
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Identificador físico de alta resolución para el chasis de la máquina.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* TARJETA QR INDUSTRIAL VISUAL (Pantalla + Impresión) */}
        <div className="py-2 flex flex-col items-center">
          <div
            id="industrial-qr-tag"
            className="w-full max-w-[360px] rounded-2xl border-2 border-border/80 bg-slate-950 text-white p-5 flex flex-col items-center text-center shadow-2xl relative overflow-hidden print:border-2 print:border-black print:bg-white print:text-black print:shadow-none"
          >
            {/* Cabecera de la Tarjeta */}
            <div className="flex flex-col items-center gap-1.5 mb-3">
              {logoUrl ? (
                <div className="size-11 rounded-lg bg-white p-1 border border-primary/30 flex items-center justify-center overflow-hidden mb-0.5">
                  <img
                    src={logoUrl}
                    alt={tenantName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="size-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-0.5">
                  <Building2 className="size-5" />
                </div>
              )}

              <span className="text-[10px] font-mono tracking-widest uppercase text-sky-400 font-bold">
                CONTROL PREVENTIVO CNC
              </span>
              <h3 className="text-base font-extrabold tracking-tight text-white print:text-black line-clamp-1">
                {tenantName}
              </h3>
            </div>

            {/* Contenedor Blanco del Código QR */}
            <div className="w-full bg-white rounded-xl p-3 border border-slate-200 shadow-inner flex flex-col items-center justify-center relative">
              <div
                className="size-56 sm:size-60 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvgXml }}
              />
            </div>

            {/* Metadatos de la Máquina */}
            <div className="mt-4 w-full space-y-1">
              <div className="text-2xl font-black font-mono tracking-wider text-sky-400 print:text-black">
                {machine.code}
              </div>
              <div className="text-sm font-semibold text-slate-200 print:text-neutral-800 line-clamp-1">
                {machine.name}
              </div>
              {(machine.model || machine.serialNumber) && (
                <div className="text-[11px] font-mono text-slate-400 print:text-neutral-600">
                  {machine.model && <span>Mod: {machine.model}</span>}
                  {machine.model && machine.serialNumber && <span> · </span>}
                  {machine.serialNumber && <span>S/N: {machine.serialNumber}</span>}
                </div>
              )}
            </div>

            {/* Footer de Instrucción */}
            <div className="mt-4 pt-3 border-t border-slate-800 print:border-neutral-300 w-full text-center">
              <p className="text-[11px] font-medium text-slate-300 print:text-neutral-700">
                Escanea con la cámara para iniciar inspección de turno
              </p>
              <p className="text-[9px] font-mono text-slate-500 print:text-neutral-500 mt-1 break-all">
                {qrUrl}
              </p>
            </div>
          </div>
        </div>

        {/* ACCIONES DEL MODAL */}
        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-border print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copied ? "¡Enlace copiado!" : "Copiar enlace"}</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>Imprimir</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPng}
              disabled={isExportingPng}
              className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isExportingPng ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>Descargar Imagen (PNG)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

