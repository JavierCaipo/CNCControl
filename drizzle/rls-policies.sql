-- ==============================================================================
-- CNC-Control SaaS Multi-Tenant: Políticas de Row Level Security (RLS)
-- ==============================================================================
-- Este script activa RLS en todas las tablas multi-tenant para aislar estrictamente
-- los datos por 'organization_id', tanto para sesiones mediante variables de contexto
-- (app.current_organization_id) como para tokens JWT en Supabase Auth.
-- ==============================================================================

-- 1. Funciones auxiliares para resolución de tenant actual
CREATE OR REPLACE FUNCTION current_app_org_id() 
RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.current_organization_id', true), '')::uuid,
    NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'organizationId'), '')::uuid,
    NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'), '')::uuid
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_app_superadmin() 
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.is_superadmin', true) = 'true',
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'superadmin'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 2. Habilitar RLS en las tablas
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. Políticas para 'organizations'
-- ==============================================================================
DROP POLICY IF EXISTS tenant_isolation_organizations ON organizations;
CREATE POLICY tenant_isolation_organizations ON organizations
  FOR ALL
  USING (
    is_app_superadmin() OR id = current_app_org_id()
  )
  WITH CHECK (
    is_app_superadmin() OR id = current_app_org_id()
  );

-- ==============================================================================
-- 4. Políticas para 'machines'
-- ==============================================================================
DROP POLICY IF EXISTS tenant_isolation_machines ON machines;
CREATE POLICY tenant_isolation_machines ON machines
  FOR ALL
  USING (
    is_app_superadmin() OR organization_id = current_app_org_id()
  )
  WITH CHECK (
    is_app_superadmin() OR organization_id = current_app_org_id()
  );

-- ==============================================================================
-- 5. Políticas para 'users'
-- ==============================================================================
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  FOR ALL
  USING (
    is_app_superadmin() 
    OR organization_id = current_app_org_id()
    OR (organization_id IS NULL AND role = 'superadmin')
  )
  WITH CHECK (
    is_app_superadmin() 
    OR organization_id = current_app_org_id()
  );

-- ==============================================================================
-- 6. Políticas para 'review_snapshots' (Append-Only)
-- ==============================================================================
DROP POLICY IF EXISTS tenant_isolation_review_snapshots ON review_snapshots;
CREATE POLICY tenant_isolation_review_snapshots ON review_snapshots
  FOR ALL
  USING (
    is_app_superadmin() OR organization_id = current_app_org_id()
  )
  WITH CHECK (
    is_app_superadmin() OR organization_id = current_app_org_id()
  );

-- ==============================================================================
-- 7. Políticas para 'reviews' (Tabla legacy en vivo)
-- ==============================================================================
DROP POLICY IF EXISTS tenant_isolation_reviews ON reviews;
CREATE POLICY tenant_isolation_reviews ON reviews
  FOR ALL
  USING (
    is_app_superadmin() 
    OR organization_id = current_app_org_id() 
    OR organization_id IS NULL
  )
  WITH CHECK (
    is_app_superadmin() 
    OR organization_id = current_app_org_id()
    OR organization_id IS NULL
  );

