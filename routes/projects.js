const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

// ── Storage del logo: Cloudinary en producción, disco local en desarrollo ────
let upload;
if (process.env.CLOUDINARY_CLOUD_NAME) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  upload = multer({
    storage: new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: 'quibira/logos',
        resource_type: 'image',
        public_id: `${uuidv4()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      }),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
} else {
  const dest = path.join(__dirname, '..', 'uploads', 'logos');
  fs.mkdirSync(dest, { recursive: true });
  upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

router.use(authenticate);

// ── Etiquetas para el historial de cambios ────────────────────────────────────
const STATUS_LABEL   = { pending:'Pendiente', active:'Activo', paused:'Pausado', completed:'Completado', cancelled:'Cancelado' };
const PRIORITY_LABEL = { low:'Baja', medium:'Media', high:'Alta', urgent:'Urgente' };
const DOC_LABEL       = { dni:'DNI', ce:'CE', pasaporte:'Pasaporte' };
const FIELD_LABEL = {
  name:'Nombre', client:'Cliente', description:'Descripción', status:'Estado', progress:'Avance (%)',
  budget:'Presupuesto', currency:'Moneda', start_date:'Fecha de Inicio', end_date:'Fecha de Entrega',
  responsible_id:'Responsable', priority:'Prioridad', company_name:'Nombre de Empresa',
  company_logo:'Logo', id_document_type:'Tipo de Documento', id_document_number:'Número de Documento',
};

router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { params.push(status); where += ` AND p.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      where += ` AND (p.name ILIKE $${n} OR p.client ILIKE $${n} OR p.code ILIKE $${n})`;
    }
    const rows = await db.query(`
      SELECT p.*, u.name AS responsible_name,
        (SELECT COUNT(*) FROM contracts  c WHERE c.project_id = p.id)::int AS contracts_count,
        (SELECT COUNT(*) FROM documents  d WHERE d.project_id = p.id)::int AS documents_count,
        (SELECT COUNT(*) FROM whatsapp_messages w WHERE w.project_id = p.id)::int AS messages_count
      FROM projects p LEFT JOIN users u ON u.id = p.responsible_id
      ${where} ORDER BY p.created_at DESC`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [total, active, pending, completed, overdue, budget] = await Promise.all([
      db.queryOne("SELECT COUNT(*)::int AS c FROM projects"),
      db.queryOne("SELECT COUNT(*)::int AS c FROM projects WHERE status = 'active'"),
      db.queryOne("SELECT COUNT(*)::int AS c FROM projects WHERE status = 'pending'"),
      db.queryOne("SELECT COUNT(*)::int AS c FROM projects WHERE status = 'completed'"),
      db.queryOne(
        "SELECT COUNT(*)::int AS c FROM projects WHERE end_date IS NOT NULL AND end_date <> '' AND end_date < $1 AND status NOT IN ('completed','cancelled')",
        [today]
      ),
      db.queryOne("SELECT COALESCE(SUM(budget),0) AS s FROM projects WHERE status != 'cancelled'"),
    ]);
    res.json({ total: total.c, active: active.c, pending: pending.c, completed: completed.c, overdue: overdue.c, budget: budget.s });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await db.queryOne(
      'SELECT p.*, u.name AS responsible_name FROM projects p LEFT JOIN users u ON u.id = p.responsible_id WHERE p.id = $1',
      [req.params.id]
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', upload.single('logo_file'), async (req, res) => {
  try {
    const { name, client, description, status, progress, budget, currency, start_date, end_date,
            responsible_id, priority, company_name, id_document_type, id_document_number, company_logo_url } = req.body;
    if (!name || !client) return res.status(400).json({ error: 'Nombre y cliente son requeridos' });

    const id = uuidv4();
    const year = new Date().getFullYear();
    const seqRow = await db.queryOne(
      "SELECT COUNT(*)+1 AS n FROM projects WHERE code LIKE $1",
      [`PROJ-${year}-%`]
    );
    const code = `PROJ-${year}-${String(parseInt(seqRow.n)).padStart(3, '0')}`;
    const company_logo = req.file
      ? (process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/logos/${req.file.filename}`)
      : (company_logo_url || null);

    await db.run(`
      INSERT INTO projects (id,code,name,client,description,status,progress,budget,currency,start_date,end_date,responsible_id,priority,created_by,company_name,company_logo,id_document_type,id_document_number)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [id, code, name, client, description || null, status || 'pending', progress || 0,
       budget || 0, currency || 'USD', start_date || null, end_date || null,
       responsible_id || null, priority || 'medium', req.user.id,
       company_name || null, company_logo, id_document_type || null, id_document_number || null]
    );
    await db.run(
      'INSERT INTO activities (id,project_id,user_id,type,description) VALUES ($1,$2,$3,$4,$5)',
      [uuidv4(), id, req.user.id, 'created', `Proyecto "${name}" creado por ${req.user.name}`]
    );
    res.status(201).json({ id, code, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', upload.single('logo_file'), async (req, res) => {
  try {
    const { name, client, description, status, progress, budget, currency, start_date, end_date,
            responsible_id, priority, company_name, id_document_type, id_document_number, company_logo_url } = req.body;
    const old = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const company_logo = req.file
      ? (process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/logos/${req.file.filename}`)
      : (company_logo_url || null);

    await db.run(`
      UPDATE projects SET
        name=COALESCE($1,name), client=COALESCE($2,client), description=COALESCE($3,description),
        status=COALESCE($4,status), progress=COALESCE($5,progress), budget=COALESCE($6,budget),
        currency=COALESCE($7,currency), start_date=COALESCE($8,start_date), end_date=COALESCE($9,end_date),
        responsible_id=COALESCE($10,responsible_id), priority=COALESCE($11,priority),
        company_name=COALESCE($12,company_name), company_logo=COALESCE($13,company_logo),
        id_document_type=COALESCE($14,id_document_type), id_document_number=COALESCE($15,id_document_number),
        updated_at=NOW()
      WHERE id=$16`,
      [name||null, client||null, description||null, status||null, progress??null,
       budget??null, currency||null, start_date||null, end_date||null,
       responsible_id||null, priority||null, company_name||null, company_logo,
       id_document_type||null, id_document_number||null, req.params.id]
    );

    // ── Historial de cambios: comparar campo por campo lo enviado vs lo anterior ──
    const submitted = { name, client, description, status, progress, budget, currency, start_date, end_date,
      responsible_id, priority, company_name, id_document_type, id_document_number, company_logo };
    const changes = [];
    for (const [field, label] of Object.entries(FIELD_LABEL)) {
      const newVal = submitted[field];
      if (newVal === undefined || newVal === null || newVal === '') continue;
      const oldVal = old[field];
      if (String(oldVal ?? '') === String(newVal)) continue;

      let oldDisplay = oldVal ?? '—';
      let newDisplay = newVal;
      if (field === 'status') {
        oldDisplay = STATUS_LABEL[oldVal] || oldDisplay; newDisplay = STATUS_LABEL[newVal] || newVal;
      } else if (field === 'priority') {
        oldDisplay = PRIORITY_LABEL[oldVal] || oldDisplay; newDisplay = PRIORITY_LABEL[newVal] || newVal;
      } else if (field === 'id_document_type') {
        oldDisplay = DOC_LABEL[oldVal] || oldDisplay; newDisplay = DOC_LABEL[newVal] || newVal;
      } else if (field === 'budget') {
        oldDisplay = oldVal != null ? `$${Number(oldVal).toLocaleString()}` : '—';
        newDisplay = `$${Number(newVal).toLocaleString()}`;
      } else if (field === 'company_logo') {
        oldDisplay = oldVal ? 'imagen anterior' : 'sin imagen'; newDisplay = 'nueva imagen';
      } else if (field === 'responsible_id') {
        const [oldU, newU] = await Promise.all([
          oldVal ? db.queryOne('SELECT name FROM users WHERE id=$1', [oldVal]) : null,
          db.queryOne('SELECT name FROM users WHERE id=$1', [newVal]),
        ]);
        oldDisplay = oldU?.name || 'Sin asignar'; newDisplay = newU?.name || newVal;
      }
      changes.push(`${label}: "${oldDisplay}" → "${newDisplay}"`);
    }

    if (changes.length > 0) {
      await db.run(
        'INSERT INTO activities (id,project_id,user_id,type,description) VALUES ($1,$2,$3,$4,$5)',
        [uuidv4(), req.params.id, req.user.id, 'updated', `${req.user.name} actualizó — ${changes.join(' · ')}`]
      );
    }
    res.json({ message: 'Proyecto actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ message: 'Proyecto eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
