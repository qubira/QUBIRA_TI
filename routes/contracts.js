const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

// ── Storage: Cloudinary en producción, disco local en desarrollo ──────────────
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
        folder: 'quibira/contracts',
        resource_type: 'raw',
        public_id: `${uuidv4()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      }),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  });
} else {
  const dest = path.join(__dirname, '..', 'uploads', 'contracts');
  fs.mkdirSync(dest, { recursive: true });
  upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  });
}

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id, type, status } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (project_id) { params.push(project_id); where += ` AND c.project_id=$${params.length}`; }
    if (type)       { params.push(type);       where += ` AND c.type=$${params.length}`; }
    if (status)     { params.push(status);     where += ` AND c.status=$${params.length}`; }
    res.json(await db.query(`
      SELECT c.*, p.name AS project_name, p.code AS project_code, u.name AS created_by_name
      FROM contracts c
      LEFT JOIN projects p ON p.id = c.project_id
      LEFT JOIN users   u ON u.id = c.created_by
      ${where} ORDER BY c.created_at DESC`, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { project_id, type, title, amount, currency, status, notes, signed_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Título requerido' });

    // Cloudinary returns secure_url as path; local multer returns absolute disk path
    const file_path = req.file
      ? (process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/contracts/${req.file.filename}`)
      : null;
    const file_name = req.file ? (req.file.originalname || req.file.filename) : null;

    const id = uuidv4();
    await db.run(`
      INSERT INTO contracts (id,project_id,type,title,amount,currency,status,file_path,file_name,notes,signed_date,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, project_id||null, type||'contract', title, amount||0, currency||'USD',
       status||'draft', file_path, file_name, notes||null, signed_date||null, req.user.id]
    );
    if (project_id) {
      await db.run(
        'INSERT INTO activities (id,project_id,user_id,type,description) VALUES ($1,$2,$3,$4,$5)',
        [uuidv4(), project_id, req.user.id, 'contract_uploaded',
         `Contrato/Proforma "${title}" agregado por ${req.user.name}`]
      );
    }
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const { title, amount, currency, status, notes, signed_date } = req.body;
    const sets = []; const params = [];
    const add = (col, val) => { if (val !== undefined && val !== null) { params.push(val); sets.push(`${col}=$${params.length}`); } };
    add('title', title); add('amount', amount); add('currency', currency);
    add('status', status); add('notes', notes); add('signed_date', signed_date);
    if (req.file) {
      const fp = process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/contracts/${req.file.filename}`;
      params.push(fp); sets.push(`file_path=$${params.length}`);
      params.push(req.file.originalname || req.file.filename); sets.push(`file_name=$${params.length}`);
    }
    if (sets.length) {
      params.push(req.params.id);
      await db.run(`UPDATE contracts SET ${sets.join(',')} WHERE id=$${params.length}`, params);
    }
    res.json({ message: 'Actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM contracts WHERE id=$1', [req.params.id]);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
