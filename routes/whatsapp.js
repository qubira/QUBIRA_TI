const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id, contact_name, starred } = req.query;
    const params = []; let where = 'WHERE 1=1';
    if (project_id)   { params.push(project_id);         where += ` AND w.project_id=$${params.length}`; }
    if (contact_name) { params.push(`%${contact_name}%`); where += ` AND w.contact_name ILIKE $${params.length}`; }
    if (starred)      { where += ' AND w.starred=1'; }
    res.json(await db.query(`
      SELECT w.*, p.name AS project_name, p.code AS project_code, u.name AS created_by_name
      FROM whatsapp_messages w
      LEFT JOIN projects p ON p.id = w.project_id
      LEFT JOIN users   u ON u.id = w.created_by
      ${where} ORDER BY w.msg_date DESC, w.created_at DESC`, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/contacts', async (req, res) => {
  try {
    res.json(await db.query(`
      SELECT contact_name, phone, COUNT(*)::int AS message_count, MAX(msg_date) AS last_message
      FROM whatsapp_messages
      GROUP BY contact_name, phone
      ORDER BY last_message DESC`));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, contact_name, phone, direction, content, msg_date } = req.body;
    if (!contact_name || !content) return res.status(400).json({ error: 'Contacto y contenido requeridos' });
    const id = uuidv4();
    await db.run(`
      INSERT INTO whatsapp_messages (id,project_id,contact_name,phone,direction,content,msg_date,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, project_id||null, contact_name, phone||null, direction||'received',
       content, msg_date||new Date().toISOString(), req.user.id]
    );
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bulk', async (req, res) => {
  try {
    const { project_id, messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'Se requiere un array de mensajes' });

    await db.transaction(async (client) => {
      for (const m of messages) {
        await client.query(`
          INSERT INTO whatsapp_messages (id,project_id,contact_name,phone,direction,content,msg_date,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv4(), project_id||null, m.contact_name, m.phone||null,
           m.direction||'received', m.content, m.msg_date||new Date().toISOString(), req.user.id]
        );
      }
    });
    res.status(201).json({ inserted: messages.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/star', async (req, res) => {
  try {
    await db.run('UPDATE whatsapp_messages SET starred = CASE WHEN starred=1 THEN 0 ELSE 1 END WHERE id=$1', [req.params.id]);
    res.json({ message: 'Actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM whatsapp_messages WHERE id=$1', [req.params.id]);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
