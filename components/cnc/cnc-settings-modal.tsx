"use client";

import * as React from "react";
import {
  Settings,
  Bell,
  CheckCircle2,
  AlertOctagon,
  Loader2,
  Send,
  Building2,
  Upload,
  Trash2,
  Image as ImageIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CncSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tenantName: string;
  initialLogoUrl?: string | null;
  onLogoUpdated?: (newLogo: string | null) => void;
}

export function CncSettingsModal({
  open,
  onOpenChange,
  slug,
  tenantName,
  initialLogoUrl,
  onLogoUpdated,
}: CncSettingsModalProps) {
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(initialLogoUrl || null);
  const [loading, setLoading] = React.useState(false);
  const [savingWebhook, setSavingWebhook] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (!open || !slug) return;

    async function loadSettings() {
      setLoading(true);
      setMessage(null);
      try {
        const [alertsRes, brandingRes] = await Promise.all([
          fetch(`/api/tenants/${encodeURIComponent(slug)}/alerts`),
          fetch(`/api/tenants/${encodeURIComponent(slug)}/branding`),
        ]);

        if (alertsRes.ok && isMounted) {
          const data = await alertsRes.json();
          setWebhookUrl(data.alertWebhookUrl || "");
        }

        if (brandingRes.ok && isMounted) {
          const bData = await brandingRes.json();
          setLogoUrl(bData.logoUrl || null);
        }
      } catch (err: unknown) {
        console.error("Error al cargar configuración:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [open, slug]);

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/alerts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertWebhookUrl: webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar la configuración.");
      }
      setMessage({ type: "success", text: "Webhook de alertas guardado exitosamente." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar configuración.";
      setMessage({ type: "error", text: msg });
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setMessage({ type: "error", text: "Ingrese una URL válida antes de probar." });
      return;
    }

    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fallo en la prueba de webhook.");
      }
      setMessage({
        type: "success",
        text: `¡Prueba exitosa! El endpoint respondió con código HTTP ${data.status || 200}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al probar el webhook.";
      setMessage({ type: "error", text: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "Solo se permiten imágenes JPEG, PNG o WebP." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "La imagen excede el tamaño máximo permitido de 5 MB." });
      return;
    }

    setUploadingLogo(true);
    setMessage(null);

    try {
      // 1. Subir a /api/uploads
      const formData = new FormData();
      formData.append("file", file);
      formData.append("machineCode", "BRANDING");

      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Error al subir la imagen del logo.");
      }

      const newUrl = uploadData.url;

      // 2. Guardar en branding
      const brandingRes = await fetch(`/api/tenants/${encodeURIComponent(slug)}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: newUrl }),
      });

      const brandingData = await brandingRes.json();
      if (!brandingRes.ok) {
        throw new Error(brandingData.error || "No se pudo actualizar el logo de la organización.");
      }

      setLogoUrl(newUrl);
      onLogoUpdated?.(newUrl);
      setMessage({ type: "success", text: "Logo de la planta actualizado exitosamente." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar logo.";
      setMessage({ type: "error", text: msg });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar el logo.");
      }
      setLogoUrl(null);
      onLogoUpdated?.(null);
      setMessage({ type: "success", text: "Logo eliminado exitosamente." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar logo.";
      setMessage({ type: "error", text: msg });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Configuración de Planta</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Identidad corporativa e integraciones para <strong>{tenantName}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {message && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-destructive/10 border border-destructive/30 text-destructive"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertOctagon className="size-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* SECCIÓN 1: IDENTIDAD DE LA PLANTA (LOGO) */}
          <div className="space-y-3 p-3 rounded-lg border border-border bg-card/60">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <Label className="text-xs font-semibold">Identidad de la Planta (Logo)</Label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              El logo se integrará en el encabezado de la consola y en el centro de todas las{" "}
              <strong>etiquetas QR físicas</strong> generadas para las máquinas.
            </p>

            <div className="flex items-center gap-4 pt-1">
              {/* Preview */}
              <div className="size-16 rounded-xl border border-border/80 bg-background/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${tenantName}`}
                    className="max-h-full max-w-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground/40" />
                )}
              </div>

              {/* Botones de acción de Logo */}
              <div className="flex flex-col gap-1.5 flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo || loading}
                    className="h-8 text-xs gap-1.5"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Upload className="size-3" />
                    )}
                    <span>{logoUrl ? "Cambiar Logo" : "Subir Logo"}</span>
                  </Button>

                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo || loading}
                      className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    >
                      <Trash2 className="size-3" />
                      <span>Quitar</span>
                    </Button>
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground">
                  PNG, JPG o WebP transparente (máx. 5 MB).
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: WEBHOOK DE ALERTAS */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-card/60">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <Label htmlFor="webhook-url" className="text-xs font-semibold">
                Webhook de Alertas Críticas
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Dispara un evento <code className="font-mono text-primary">cnc.critical_alert</code> en
              tiempo real ante anomalías no resueltas. Compatible con{" "}
              <strong>Slack, n8n, Make o WhatsApp API</strong>.
            </p>

            <div className="pt-1 space-y-2">
              <Input
                id="webhook-url"
                placeholder="https://hooks.slack.com/services/... o webhook URL"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={loading || savingWebhook}
                className="text-xs font-mono h-9"
              />

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestWebhook}
                  disabled={testing || savingWebhook || !webhookUrl.trim()}
                  className="h-8 text-xs gap-1.5"
                >
                  {testing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Send className="size-3" />
                  )}
                  <span>Probar Webhook</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveWebhook}
                  disabled={savingWebhook || loading}
                  className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {savingWebhook && <Loader2 className="size-3 animate-spin" />}
                  <span>Guardar</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
