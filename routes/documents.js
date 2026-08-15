const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

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
        folder: 'quibira/documents',
        resource_type: 'raw',
        public_id: `${uuidv4()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      }),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
} else {
  const dest = path.join(__dirname, '..', 'uploads', 'documents');
  fs.mkdirSync(dest, { recursive: true });
  upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id, category, search } = req.query;
    const params = []; let where = 'WHERE 1=1';
    if (project_id) { params.push(project_id); where += ` AND d.project_id=$${params.length}`; }
    if (category)   { params.push(category);   where += ` AND d.category=$${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      where += ` AND (d.title ILIKE $${n} OR d.description ILIKE $${n} OR d.tags ILIKE $${n})`;
    }
    res.json(await db.query(`
      SELECT d.*, p.name AS project_name, u.name AS created_by_name
      FROM documents d
      LEFT JOIN projects p ON p.id = d.project_id
      LEFT JOIN users   u ON u.id = d.created_by
      ${where} ORDER BY d.created_at DESC`, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { project_id, category, title, description, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'Título requerido' });

    const file_path = req.file
      ? (process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/documents/${req.file.filename}`)
      : null;
    const file_name = req.file ? (req.file.originalname || req.file.filename) : null;
    const file_size = req.file?.size || null;
    const mime_type = req.file?.mimetype || null;

    const id = uuidv4();
    await db.run(`
      INSERT INTO documents (id,project_id,category,title,description,file_path,file_name,file_size,mime_type,tags,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, project_id||null, category||'general', title, description||null,
       file_path, file_name, file_size, mime_type, tags||null, req.user.id]
    );
    if (project_id) {
      await db.run(
        'INSERT INTO activities (id,project_id,user_id,type,description) VALUES ($1,$2,$3,$4,$5)',
        [uuidv4(), project_id, req.user.id, 'document_uploaded',
         `Documento "${title}" subido por ${req.user.name}`]
      );
    }
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await db.queryOne('SELECT file_path FROM documents WHERE id=$1', [req.params.id]);
    // Only delete local files; Cloudinary files are managed via their dashboard
    if (doc?.file_path && doc.file_path.startsWith('/uploads/')) {
      const full = path.join(__dirname, '..', doc.file_path);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    await db.run('DELETE FROM documents WHERE id=$1', [req.params.id]);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
