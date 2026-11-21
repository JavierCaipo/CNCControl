"use client";

import * as React from "react";
import {
  Building2,
  Server,
  Users,
  FileText,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  LogOut,
  ExternalLink,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminUser {
  id: string;
  name: string;
  role: string;
  email: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
}

interface GlobalStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalMachines: number;
  totalUsers: number;
  totalSnapshots: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: "starter" | "pro" | "enterprise";
  maxMachines: number;
  active: boolean;
  createdAt: string;
  machinesCount: number;
  usersCount: number;
  snapshotsCount: number;
}

export default function SuperAdminPage() {
  const [currentUser, setCurrentUser] = React.useState<AdminUser | null>(null);
  const [loadingSession, setLoadingSession] = React.useState(true);
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  // Dashboard Data
  const [stats, setStats] = React.useState<GlobalStats | null>(null);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Create Modal
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState("");
  const [newOrgSlug, setNewOrgSlug] = React.useState("");
  const [newOrgPlan, setNewOrgPlan] = React.useState<"starter" | "pro" | "enterprise">("starter");
  const [newOrgMaxMachines, setNewOrgMaxMachines] = React.useState("5");
  const [newManagerName, setNewManagerName] = React.useState("");
  const [newManagerEmail, setNewManagerEmail] = React.useState("");
  const [newManagerPassword, setNewManagerPassword] = React.useState("");
  const [showManagerPassword, setShowManagerPassword] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // Edit Modal
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingTenant, setEditingTenant] = React.useState<Tenant | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editPlan, setEditPlan] = React.useState<"starter" | "pro" | "enterprise">("starter");
  const [editMaxMachines, setEditMaxMachines] = React.useState("5");
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const loadDashboardData = React.useCallback(async () => {
    try {
      setLoadingData(true);
      const [statsRes, tenantsRes] = await Promise.all([
        fetch("/api/superadmin/stats"),
        fetch("/api/superadmin/organizations"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData.organizations || []);
      }
    } catch (err) {
      console.error("Error cargando datos del dashboard:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Load session and initial data on mount
  React.useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const res = await fetch("/api/auth/me");
        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data.user && data.user.role === "superadmin") {
            setCurrentUser(data.user);
            const [statsRes, tenantsRes] = await Promise.all([
              fetch("/api/superadmin/stats"),
              fetch("/api/superadmin/organizations"),
            ]);
            if (!isMounted) return;
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              setStats(statsData);
            }
            if (tenantsRes.ok) {
              const tenantsData = await tenantsRes.json();
              setTenants(tenantsData.organizations || []);
            }
          } else {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Error inicializando sesión:", err);
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setLoadingSession(false);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/auth/login-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Error al iniciar sesión.");
        setIsLoggingIn(false);
        return;
      }

      // Check if logged in user is actually superadmin
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user?.role === "superadmin") {
          setCurrentUser(meData.user);
          loadDashboardData();
        } else {
          await fetch("/api/auth/logout", { method: "POST" });
          setLoginError("Acceso denegado: tu cuenta no posee permisos de Super Admin.");
        }
      } else {
        setLoginError("No se pudo verificar la sesión.");
      }
    } catch {
      setLoginError("Error de red al intentar iniciar sesión.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      setStats(null);
      setTenants([]);
    }
  };

  // Auto slug generation helper
  const handleOrgNameChange = (name: string) => {
    setNewOrgName(name);
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    setNewOrgSlug(generatedSlug);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/superadmin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug,
          plan: newOrgPlan,
          maxMachines: parseInt(newOrgMaxMachines, 10) || 5,
          managerName: newManagerName,
          managerEmail: newManagerEmail,
          managerPassword: newManagerPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Error al crear la organización.");
        setIsCreating(false);
        return;
      }

      setCreateDialogOpen(false);
      // Reset form
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgPlan("starter");
      setNewOrgMaxMachines("5");
      setNewManagerName("");
      setNewManagerEmail("");
      setNewManagerPassword("");

      // Refresh data
      loadDashboardData();
    } catch {
      setCreateError("Error de conexión al registrar la organización.");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditName(tenant.name);
    setEditPlan(tenant.plan);
    setEditMaxMachines(String(tenant.maxMachines));
    setEditError(null);
    setEditDialogOpen(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    setEditError(null);
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/superadmin/organizations/${editingTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          plan: editPlan,
          maxMachines: parseInt(editMaxMachines, 10) || 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Error al actualizar la organización.");
        setIsUpdating(false);
        return;
      }

      setEditDialogOpen(false);
      setEditingTenant(null);
      loadDashboardData();
    } catch {
      setEditError("Error al guardar los cambios.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    const nextActive = !tenant.active;

    // Optimistic UI update
    setTenants((prev) =>
      prev.map((t) => (t.id === tenant.id ? { ...t, active: nextActive } : t))
    );

    try {
      const res = await fetch(`/api/superadmin/organizations/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });

      if (!res.ok) {
        // Rollback on error
        setTenants((prev) =>
          prev.map((t) => (t.id === tenant.id ? { ...t, active: tenant.active } : t))
        );
      } else {
        // Update stats
        if (stats) {
          setStats({
            ...stats,
            activeOrganizations: stats.activeOrganizations + (nextActive ? 1 : -1),
          });
        }
      }
    } catch {
      // Rollback on error
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, active: tenant.active } : t))
      );
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 1. Loading screen
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Iniciando panel Super Admin...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">CNC-Control</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Acceso exclusivo al Panel de Super Administrador
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="superadmin-email">Correo Electrónico</Label>
                <Input
                  id="superadmin-email"
                  type="email"
                  placeholder="admin@tresapps.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="superadmin-password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="superadmin-password"
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Ingresar al Panel"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Authenticated Super Admin Dashboard
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg leading-none">CNC-Control</h1>
                <Badge variant="outline" className="text-[10px] tracking-wider uppercase font-semibold text-primary border-primary/30">
                  Super Admin
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión Global Multi-Tenant</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              Conectado como <strong className="text-foreground">{currentUser.email}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="size-3.5" />
              <span>Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 sm:p-8 space-y-8">
        {/* KPI Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="border-border bg-card shadow-sm hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inquilinos Activos</CardTitle>
              <div className="p-2 rounded-md bg-blue-500/10 text-blue-400">
                <Building2 className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {stats ? stats.activeOrganizations : "--"}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  / {stats ? stats.totalOrganizations : "--"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Organizaciones en plataforma</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Máquinas CNC</CardTitle>
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400">
                <Server className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{stats ? stats.totalMachines : "--"}</div>
              <p className="text-xs text-muted-foreground mt-1">Equipos industriales activos</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Totales</CardTitle>
              <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
                <Users className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{stats ? stats.totalUsers : "--"}</div>
              <p className="text-xs text-muted-foreground mt-1">Gerentes, supervisores y operarios</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revisiones Históricas</CardTitle>
              <div className="p-2 rounded-md bg-purple-500/10 text-purple-400">
                <FileText className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{stats ? stats.totalSnapshots : "--"}</div>
              <p className="text-xs text-muted-foreground mt-1">Snapshots inmutables de turnos</p>
            </CardContent>
          </Card>
        </section>

        {/* Tenants Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Inquilinos Registrados</h2>
              <p className="text-sm text-muted-foreground">
                Supervisión, activación y configuración de planes por empresa cliente.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar inquilino o slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={loadDashboardData}
                disabled={loadingData}
                title="Actualizar datos"
              >
                <RefreshCw className={`size-4 ${loadingData ? "animate-spin" : ""}`} />
              </Button>

              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 shrink-0">
                <Plus className="size-4" />
                <span>Nuevo Inquilino</span>
              </Button>
            </div>
          </div>

          {/* Tenants Table */}
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[220px]">Organización</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Máquinas</TableHead>
                    <TableHead className="text-center">Usuarios</TableHead>
                    <TableHead className="text-center">Snapshots</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        {loadingData ? "Cargando organizaciones..." : "No se encontraron organizaciones registradas."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <TableRow key={tenant.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          <div className="font-semibold">{tenant.name}</div>
                          <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                            Creado: {new Date(tenant.createdAt).toLocaleDateString("es-ES")}
                          </div>
                        </TableCell>

                        <TableCell>
                          <a
                            href={`/t/${tenant.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                            title={`Visitar espacio de ${tenant.name}`}
                          >
                            <span>/t/{tenant.slug}</span>
                            <ExternalLink className="size-3 opacity-70" />
                          </a>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              tenant.plan === "enterprise"
                                ? "default"
                                : tenant.plan === "pro"
                                ? "secondary"
                                : "outline"
                            }
                            className="capitalize text-xs"
                          >
                            {tenant.plan}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="font-medium text-sm">
                            {tenant.machinesCount} / {tenant.maxMachines}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs font-mono">
                            {tenant.usersCount}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs font-mono">
                            {tenant.snapshotsCount}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={tenant.active}
                              onCheckedChange={() => handleToggleActive(tenant)}
                              aria-label="Activar o suspender inquilino"
                            />
                            <span className="text-xs text-muted-foreground min-w-[55px]">
                              {tenant.active ? "Activo" : "Pausado"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(tenant)}
                            className="gap-1.5 h-8 text-xs hover:bg-accent"
                          >
                            <Pencil className="size-3.5" />
                            <span>Editar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </section>
      </main>

      {/* MODAL 1: Nuevo Inquilino */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <span>Registrar Nuevo Inquilino</span>
            </DialogTitle>
            <DialogDescription>
              Crea una nueva organización aislada y provisiona su primer usuario administrador gerente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTenant} className="space-y-6 pt-2">
            {createError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* BLOQUE 1: Datos de la Empresa */}
            <div className="space-y-3.5 border-b border-border pb-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Building2 className="size-4" />
                <span>Bloque 1: Datos de la Empresa</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-org-name">Nombre de la Empresa *</Label>
                  <Input
                    id="create-org-name"
                    placeholder="Ej. Industrias Metálicas S.A."
                    value={newOrgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-org-slug">Identificador (Slug) *</Label>
                  <Input
                    id="create-org-slug"
                    placeholder="industrias-metalicas"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]/g, ""))}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Acceso: /t/{newOrgSlug || "slug"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="create-org-plan">Plan de Suscripción</Label>
                  <Select value={newOrgPlan} onValueChange={(val: "starter" | "pro" | "enterprise") => setNewOrgPlan(val)}>
                    <SelectTrigger id="create-org-plan" className="w-full">
                      <SelectValue placeholder="Selecciona un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (Hasta 5 máquinas)</SelectItem>
                      <SelectItem value="pro">Pro (Hasta 15 máquinas)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (Ilimitadas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-org-max">Límite de Máquinas</Label>
                  <Input
                    id="create-org-max"
                    type="number"
                    min="1"
                    max="100"
                    value={newOrgMaxMachines}
                    onChange={(e) => setNewOrgMaxMachines(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE 2: Datos del Primer Gerente */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Users className="size-4" />
                <span>Bloque 2: Primer Gerente Administrador</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-manager-name">Nombre Completo *</Label>
                <Input
                  id="create-manager-name"
                  placeholder="Ej. Carlos Mendoza"
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-manager-email">Correo Electrónico *</Label>
                  <Input
                    id="create-manager-email"
                    type="email"
                    placeholder="gerencia@industria.com"
                    value={newManagerEmail}
                    onChange={(e) => setNewManagerEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-manager-password">Contraseña Inicial *</Label>
                  <div className="relative">
                    <Input
                      id="create-manager-password"
                      type={showManagerPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newManagerPassword}
                      onChange={(e) => setNewManagerPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowManagerPassword(!showManagerPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showManagerPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating} className="gap-2">
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Creando Inquilino...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>Crear Organización</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Editar Inquilino */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Pencil className="size-5 text-primary" />
              <span>Editar Inquilino</span>
            </DialogTitle>
            <DialogDescription>
              Modifica los parámetros de configuración y límites del servicio para{" "}
              <strong className="text-foreground">{editingTenant?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateTenant} className="space-y-4 pt-2">
            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-org-name">Nombre de la Empresa</Label>
              <Input
                id="edit-org-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-org-plan">Plan</Label>
              <Select value={editPlan} onValueChange={(val: "starter" | "pro" | "enterprise") => setEditPlan(val)}>
                <SelectTrigger id="edit-org-plan" className="w-full">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-org-max">Límite de Máquinas CNC</Label>
              <Input
                id="edit-org-max"
                type="number"
                min="1"
                max="100"
                value={editMaxMachines}
                onChange={(e) => setEditMaxMachines(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating} className="gap-2">
                {isUpdating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
