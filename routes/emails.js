const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id, direction, starred, search } = req.query;
    const params = []; let where = 'WHERE 1=1';
    if (project_id) { params.push(project_id);   where += ` AND e.project_id=$${params.length}`; }
    if (direction)  { params.push(direction);     where += ` AND e.direction=$${params.length}`; }
    if (starred)    { where += ' AND e.starred=1'; }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      where += ` AND (e.subject ILIKE $${n} OR e.from_email ILIKE $${n} OR e.body ILIKE $${n})`;
    }
    res.json(await db.query(`
      SELECT e.*, p.name AS project_name, p.code AS project_code, u.name AS created_by_name
      FROM emails e
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN users   u ON u.id = e.created_by
      ${where} ORDER BY e.email_date DESC, e.created_at DESC`, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, subject, from_name, from_email, to_email, body, direction, email_date, attachments } = req.body;
    if (!subject) return res.status(400).json({ error: 'Asunto requerido' });
    const id = uuidv4();
    await db.run(`
      INSERT INTO emails (id,project_id,subject,from_name,from_email,to_email,body,direction,email_date,attachments,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, project_id||null, subject, from_name||null, from_email||null, to_email||null,
       body||null, direction||'received', email_date||new Date().toISOString(),
       attachments ? JSON.stringify(attachments) : null, req.user.id]
    );
    if (project_id) {
      await db.run(
        'INSERT INTO activities (id,project_id,user_id,type,description) VALUES ($1,$2,$3,$4,$5)',
        [uuidv4(), project_id, req.user.id, 'email_added',
         `Email "${subject}" registrado por ${req.user.name}`]
      );
    }
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/star', async (req, res) => {
  try {
    await db.run('UPDATE emails SET starred = CASE WHEN starred=1 THEN 0 ELSE 1 END WHERE id=$1', [req.params.id]);
    res.json({ message: 'Actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM emails WHERE id=$1', [req.params.id]);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
