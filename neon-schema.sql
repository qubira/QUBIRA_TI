-- ============================================================================
-- Quibira CRM — Esquema PostgreSQL para Neon (v2, preparado para escalar)
-- ============================================================================
-- Pégalo completo en el SQL Editor de Neon y ejecútalo una sola vez sobre una
-- base de datos nueva.
--
-- NOTA: si conectas la app a esta base con DATABASE_URL en .env, database.js
-- ejecuta este mismo esquema automáticamente al arrancar (usa
-- CREATE TABLE IF NOT EXISTS), así que correr este script a mano es opcional
-- — sirve para revisar el esquema o crearlo de antemano sin levantar la app.
--
-- Decisiones para que sea fácil agregar tablas más adelante:
--   • id es tipo UUID nativo (no texto) con valor por defecto automático.
--   • Toda tabla tiene updated_at, mantenido solo por un trigger genérico
--     (set_updated_at) — una tabla nueva solo necesita "pegarle" el trigger,
--     no hace falta repetir lógica en el código de la app.
--   • Las referencias a usuarios (responsible_id, created_by, user_id) usan
--     ON DELETE SET NULL: si en el futuro se borra un usuario de verdad, no
--     rompe filas de otras tablas que lo mencionan.
--   • Las referencias a projects usan ON DELETE CASCADE: si se borra un
--     proyecto, se borra todo lo que le pertenece (contratos, documentos, etc).
--   • schema_migrations registra qué scripts ya se aplicaron, para que los
--     cambios futuros sean archivos numerados en vez de editar este archivo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- habilita gen_random_uuid()

-- ── Control de migraciones ──────────────────────────────────────────────────
-- Cada vez que se agregue una tabla o columna nueva en el futuro, en vez de
-- editar este archivo: crear un archivo nuevo (ej. 002_add_tasks.sql) con su
-- propio CREATE TABLE / ALTER TABLE, y registrar la versión aquí:
--   INSERT INTO schema_migrations (version) VALUES ('002_add_tasks');
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Función reutilizable: mantiene updated_at al día en cualquier tabla ─────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'manager',
  avatar      TEXT,
  active      INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── projects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  client              TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  progress            INTEGER DEFAULT 0,
  budget              NUMERIC DEFAULT 0,
  currency            TEXT DEFAULT 'USD',
  start_date          TEXT,
  end_date            TEXT,
  responsible_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  priority            TEXT DEFAULT 'medium',
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  company_name        TEXT,
  company_logo        TEXT,
  id_document_type    TEXT,
  id_document_number  TEXT
);
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── contracts (contratos / proformas / cotizaciones) ───────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'contract',
  title       TEXT NOT NULL,
  amount      NUMERIC DEFAULT 0,
  currency    TEXT DEFAULT 'USD',
  status      TEXT DEFAULT 'draft',
  file_path   TEXT,
  file_name   TEXT,
  notes       TEXT,
  signed_date TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── documents ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT DEFAULT 'general',
  title       TEXT NOT NULL,
  description TEXT,
  file_path   TEXT,
  file_name   TEXT,
  file_size   INTEGER,
  mime_type   TEXT,
  tags        TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── whatsapp_messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone        TEXT,
  direction    TEXT NOT NULL DEFAULT 'received',
  content      TEXT NOT NULL,
  msg_date     TIMESTAMPTZ,
  starred      INTEGER DEFAULT 0,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_whatsapp_updated_at ON whatsapp_messages;
CREATE TRIGGER trg_whatsapp_updated_at BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── emails ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  from_name   TEXT,
  from_email  TEXT,
  to_email    TEXT,
  body        TEXT,
  direction   TEXT DEFAULT 'received',
  email_date  TIMESTAMPTZ,
  starred     INTEGER DEFAULT 0,
  attachments TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_emails_updated_at ON emails;
CREATE TRIGGER trg_emails_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── activities (historial de cambios) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── requirements (requerimientos funcionales / no funcionales) ────────────
CREATE TABLE IF NOT EXISTS requirements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'functional',
  description TEXT NOT NULL,
  progress    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_requirements_updated_at ON requirements;
CREATE TRIGGER trg_requirements_updated_at BEFORE UPDATE ON requirements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Índices (acelera filtros y búsquedas usadas por la app)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_responsible  ON projects(responsible_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project     ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project     ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_project      ON whatsapp_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contact      ON whatsapp_messages(contact_name);
CREATE INDEX IF NOT EXISTS idx_emails_project        ON emails(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_project    ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project  ON requirements(project_id);

INSERT INTO schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;

-- ============================================================================
-- Usuario administrador inicial
-- Usuario: admin   |   Contraseña: Admin2024!
-- (hash bcrypt ya generado, igual al que crea database.js automáticamente)
-- ============================================================================
INSERT INTO users (id, name, username, password, role)
VALUES (
  gen_random_uuid(),
  'Administrador',
  'admin',
  '$2a$12$VnbuOZL2vkKpxJrY2FiWHeIZpD2dAJH.ySv2bhnml/zOzJ0.5vQ0C',
  'admin'
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- PLANTILLA: cómo agregar una tabla nueva más adelante (copiar y adaptar)
-- ============================================================================
-- CREATE TABLE IF NOT EXISTS nombre_tabla (
--   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,  -- si aplica
--   created_by  UUID REFERENCES users(id) ON DELETE SET NULL,    -- si aplica
--   -- ... columnas propias ...
--   created_at  TIMESTAMPTZ DEFAULT NOW(),
--   updated_at  TIMESTAMPTZ DEFAULT NOW()
-- );
-- DROP TRIGGER IF EXISTS trg_nombre_tabla_updated_at ON nombre_tabla;
-- CREATE TRIGGER trg_nombre_tabla_updated_at BEFORE UPDATE ON nombre_tabla
--   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- CREATE INDEX IF NOT EXISTS idx_nombre_tabla_project ON nombre_tabla(project_id);
-- INSERT INTO schema_migrations (version) VALUES ('002_nombre_descriptivo') ON CONFLICT DO NOTHING;
