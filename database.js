require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const usingPostgres = !!process.env.DATABASE_URL;

let db, init;

if (usingPostgres) {
  // ───────── PostgreSQL (Neon / producción) ─────────────────────────────────
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  db = {
    query:    async (text, params = []) => (await pool.query(text, params)).rows,
    queryOne: async (text, params = []) => (await pool.query(text, params)).rows[0] || null,
    run:      async (text, params = []) => (await pool.query(text, params)).rowCount,
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await fn(client);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };

  init = async () => {
    // Esquema base — IDs en UUID nativo, updated_at mantenido por trigger en
    // todas las tablas, para que agregar tablas nuevas en el futuro sea
    // copiar el mismo patrón (ver plantilla en neon-schema.sql).
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $f$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql;

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

      CREATE TABLE IF NOT EXISTS activities (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        type        TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata    TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS requirements (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
        type        TEXT NOT NULL DEFAULT 'functional',
        description TEXT NOT NULL,
        progress    INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
      CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
      CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
      CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON contracts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
      CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      DROP TRIGGER IF EXISTS trg_whatsapp_updated_at ON whatsapp_messages;
      CREATE TRIGGER trg_whatsapp_updated_at BEFORE UPDATE ON whatsapp_messages
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      DROP TRIGGER IF EXISTS trg_emails_updated_at ON emails;
      CREATE TRIGGER trg_emails_updated_at BEFORE UPDATE ON emails
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      DROP TRIGGER IF EXISTS trg_requirements_updated_at ON requirements;
      CREATE TRIGGER trg_requirements_updated_at BEFORE UPDATE ON requirements
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
    `);

    // Migraciones de respaldo, por si esta base viene de una instalación previa
    // a este esquema (columnas/nombres antiguos). En una base nueva no hacen nada.
    await pool.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_name TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_logo TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS id_document_type TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS id_document_number TEXT;
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requirements' AND column_name='progress') THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requirements' AND column_name='fulfilled') THEN
            ALTER TABLE requirements RENAME COLUMN fulfilled TO progress;
          ELSE
            ALTER TABLE requirements ADD COLUMN progress INTEGER DEFAULT 0;
          END IF;
        END IF;
      END $$;
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
            ALTER TABLE users RENAME COLUMN email TO username;
          ELSE
            ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
          END IF;
        END IF;
      END $$;
    `);
    await seedAdmin();
  };

} else {
  // ───────── SQLite local (desarrollo, sin configuración) ───────────────────
  // Usa el módulo node:sqlite integrado en Node.js (>=22.5) — no requiere
  // instalar nada ni compilar binarios nativos (better-sqlite3 sí los necesita).
  const fs = require('fs');
  const dbPath = path.join(__dirname, 'quibira.db');

  // Respaldo automático: antes de abrir la base, copia el archivo existente
  // a backups/ con timestamp. Protege contra borrados accidentales (humanos
  // o del asistente) y mantiene como máximo las últimas 20 copias.
  if (fs.existsSync(dbPath)) {
    const backupDir = path.join(__dirname, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(dbPath, path.join(backupDir, `quibira_${stamp}.db`));

    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('quibira_')).sort();
    while (backups.length > 20) fs.unlinkSync(path.join(backupDir, backups.shift()));
  }

  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  // Traduce sintaxis Postgres ($1, ILIKE, ::int, NOW()) a SQLite, remapeando
  // los parámetros para que un mismo $N reutilizado varias veces en una
  // consulta (ej. filtros de búsqueda) siga enlazando el valor correcto.
  function translate(sql, params) {
    const newParams = [];
    let out = sql.replace(/\$(\d+)/g, (_, n) => {
      const v = params[parseInt(n, 10) - 1];
      newParams.push(v === undefined ? null : v);
      return '?';
    });
    out = out
      .replace(/ILIKE/gi, 'LIKE')
      .replace(/::int\b/gi, '')
      .replace(/NOW\(\)/gi, "datetime('now')");
    return { sql: out, params: newParams };
  }

  db = {
    query: async (text, params = []) => {
      const { sql, params: p } = translate(text, params);
      return sqlite.prepare(sql).all(...p);
    },
    queryOne: async (text, params = []) => {
      const { sql, params: p } = translate(text, params);
      return sqlite.prepare(sql).get(...p) || null;
    },
    run: async (text, params = []) => {
      const { sql, params: p } = translate(text, params);
      return sqlite.prepare(sql).run(...p).changes;
    },
    transaction: async (fn) => {
      sqlite.exec('BEGIN');
      try {
        const client = {
          query: (text, params = []) => {
            const { sql, params: p } = translate(text, params);
            return sqlite.prepare(sql).run(...p);
          },
        };
        await fn(client);
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };

  init = async () => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        username    TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'manager',
        avatar      TEXT,
        active      INTEGER DEFAULT 1,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id             TEXT PRIMARY KEY,
        code           TEXT UNIQUE NOT NULL,
        name           TEXT NOT NULL,
        client         TEXT NOT NULL,
        description    TEXT,
        status         TEXT NOT NULL DEFAULT 'pending',
        progress       INTEGER DEFAULT 0,
        budget         REAL DEFAULT 0,
        currency       TEXT DEFAULT 'USD',
        start_date     TEXT,
        end_date       TEXT,
        responsible_id TEXT REFERENCES users(id),
        priority       TEXT DEFAULT 'medium',
        created_by     TEXT REFERENCES users(id),
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id          TEXT PRIMARY KEY,
        project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
        type        TEXT NOT NULL DEFAULT 'contract',
        title       TEXT NOT NULL,
        amount      REAL DEFAULT 0,
        currency    TEXT DEFAULT 'USD',
        status      TEXT DEFAULT 'draft',
        file_path   TEXT,
        file_name   TEXT,
        notes       TEXT,
        signed_date TEXT,
        created_by  TEXT REFERENCES users(id),
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS documents (
        id          TEXT PRIMARY KEY,
        project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
        category    TEXT DEFAULT 'general',
        title       TEXT NOT NULL,
        description TEXT,
        file_path   TEXT,
        file_name   TEXT,
        file_size   INTEGER,
        mime_type   TEXT,
        tags        TEXT,
        created_by  TEXT REFERENCES users(id),
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id           TEXT PRIMARY KEY,
        project_id   TEXT REFERENCES projects(id) ON DELETE CASCADE,
        contact_name TEXT NOT NULL,
        phone        TEXT,
        direction    TEXT NOT NULL DEFAULT 'received',
        content      TEXT NOT NULL,
        msg_date     TEXT,
        starred      INTEGER DEFAULT 0,
        created_by   TEXT REFERENCES users(id),
        created_at   TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS emails (
        id          TEXT PRIMARY KEY,
        project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
        subject     TEXT NOT NULL,
        from_name   TEXT,
        from_email  TEXT,
        to_email    TEXT,
        body        TEXT,
        direction   TEXT DEFAULT 'received',
        email_date  TEXT,
        starred     INTEGER DEFAULT 0,
        attachments TEXT,
        created_by  TEXT REFERENCES users(id),
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS activities (
        id          TEXT PRIMARY KEY,
        project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
        user_id     TEXT REFERENCES users(id),
        type        TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata    TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS requirements (
        id          TEXT PRIMARY KEY,
        project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
        type        TEXT NOT NULL DEFAULT 'functional',
        description TEXT NOT NULL,
        progress    INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
      );
    `);
    const existingCols = sqlite.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
    for (const [col, def] of [
      ['company_name', 'TEXT'], ['company_logo', 'TEXT'],
      ['id_document_type', 'TEXT'], ['id_document_number', 'TEXT'],
    ]) {
      if (!existingCols.includes(col)) sqlite.exec(`ALTER TABLE projects ADD COLUMN ${col} ${def}`);
    }
    // Migración: instalaciones previas tenían "email" en vez de "username"
    const userCols = sqlite.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!userCols.includes('username')) {
      if (userCols.includes('email')) sqlite.exec('ALTER TABLE users RENAME COLUMN email TO username');
      else sqlite.exec('ALTER TABLE users ADD COLUMN username TEXT');
    }
    // Migración: instalaciones previas tenían "fulfilled" (0/1) en vez de "progress" (0-100)
    const reqCols = sqlite.prepare("PRAGMA table_info(requirements)").all().map(c => c.name);
    if (!reqCols.includes('progress')) {
      if (reqCols.includes('fulfilled')) sqlite.exec('ALTER TABLE requirements RENAME COLUMN fulfilled TO progress');
      else sqlite.exec('ALTER TABLE requirements ADD COLUMN progress INTEGER DEFAULT 0');
    }
    await seedAdmin();
  };
}

async function seedAdmin() {
  const row = await db.queryOne('SELECT COUNT(*) AS c FROM users');
  if (parseInt(row.c) === 0) {
    const hash = bcrypt.hashSync('Admin2024!', 12);
    await db.run(
      'INSERT INTO users (id, name, username, password, role) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), 'Administrador', 'admin', hash, 'admin']
    );
    console.log('✅  Usuario admin creado: admin / Admin2024!');
  }
}

db.init = init;
console.log(`💾  Base de datos: ${usingPostgres ? 'PostgreSQL (DATABASE_URL)' : 'SQLite local (quibira.db)'}`);

module.exports = db;
