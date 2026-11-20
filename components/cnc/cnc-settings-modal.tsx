"use client";

import * as React from "react";
import { Settings, Bell, CheckCircle2, AlertOctagon, Loader2, Send } from "lucide-react";
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
}

export function CncSettingsModal({
  open,
  onOpenChange,
  slug,
  tenantName,
}: CncSettingsModalProps) {
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (!open || !slug) return;

    async function loadSettings() {
      setLoading(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/alerts`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setWebhookUrl(data.alertWebhookUrl || "");
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

  const handleSave = async () => {
    setSaving(true);
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
      setMessage({ type: "success", text: "Configuración guardada exitosamente." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar configuración.";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Configuración y Alertas</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ajustes de integración para <strong>{tenantName}</strong>.
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

          <div className="space-y-2 p-3 rounded-lg border border-border bg-card/60">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <Label htmlFor="webhook-url" className="text-xs font-semibold">
                Webhook de Alertas Críticas
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Dispara un evento <code className="font-mono text-primary">cnc.critical_alert</code> en
              tiempo real ante anomalías no resueltas. Compatible con <strong>Slack, n8n, Make o WhatsApp API</strong>.
            </p>

            <div className="pt-1 space-y-2">
              <Input
                id="webhook-url"
                placeholder="https://hooks.slack.com/services/... o webhook URL"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={loading || saving}
                className="text-xs font-mono h-9"
              />

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || saving || !webhookUrl.trim()}
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
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving && <Loader2 className="size-3 animate-spin" />}
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

