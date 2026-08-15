const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const TYPE_LABEL = { functional: 'Funcional', non_functional: 'No Funcional' };

function logActivity(project_id, user_id, description) {
  return db.run(
    'INSERT INTO activities (id,project_id,user_id,type,description) VALUES ($1,$2,$3,$4,$5)',
    [uuidv4(), project_id, user_id, 'requirement_change', description]
  );
}

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const params = []; let where = 'WHERE 1=1';
    if (project_id) { params.push(project_id); where += ` AND project_id=$${params.length}`; }
    res.json(await db.query(`SELECT * FROM requirements ${where} ORDER BY created_at ASC`, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, type, description } = req.body;
    if (!project_id || !description) return res.status(400).json({ error: 'Proyecto y descripción son requeridos' });
    const id = uuidv4();
    const finalType = type === 'non_functional' ? 'non_functional' : 'functional';
    await db.run(
      'INSERT INTO requirements (id,project_id,type,description,progress) VALUES ($1,$2,$3,$4,$5)',
      [id, project_id, finalType, description, 0]
    );
    await logActivity(project_id, req.user.id,
      `${req.user.name} agregó el requerimiento ${TYPE_LABEL[finalType]} "${description}"`);
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { description, type, progress } = req.body;
    const old = await db.queryOne('SELECT * FROM requirements WHERE id=$1', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Requerimiento no encontrado' });

    const sets = []; const params = [];
    const add = (col, val) => { if (val !== undefined) { params.push(val); sets.push(`${col}=$${params.length}`); } };
    add('description', description);
    add('type', type);
    const clampedProgress = progress !== undefined ? Math.max(0, Math.min(100, parseInt(progress) || 0)) : undefined;
    if (clampedProgress !== undefined) add('progress', clampedProgress);
    if (sets.length) {
      params.push(req.params.id);
      await db.run(`UPDATE requirements SET ${sets.join(',')} WHERE id=$${params.length}`, params);
    }

    const label = old.type === 'non_functional' ? 'No Funcional' : 'Funcional';
    if (clampedProgress !== undefined && clampedProgress !== old.progress) {
      await logActivity(old.project_id, req.user.id,
        `${req.user.name} actualizó el avance de "${old.description}" (${label}) de ${old.progress||0}% a ${clampedProgress}%`);
    }
    if (description !== undefined && description !== old.description) {
      await logActivity(old.project_id, req.user.id,
        `${req.user.name} cambió la descripción del requerimiento "${old.description}" a "${description}"`);
    }

    res.json({ message: 'Actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const old = await db.queryOne('SELECT * FROM requirements WHERE id=$1', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Requerimiento no encontrado' });
    await db.run('DELETE FROM requirements WHERE id=$1', [req.params.id]);
    const label = old.type === 'non_functional' ? 'No Funcional' : 'Funcional';
    await logActivity(old.project_id, req.user.id,
      `${req.user.name} eliminó el requerimiento ${label} "${old.description}"`);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
