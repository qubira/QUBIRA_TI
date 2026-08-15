const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    res.json(await db.query('SELECT id, name, username, role, avatar, active, created_at FROM users ORDER BY name'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'Nombre, usuario y contraseña requeridos' });

    const exists = await db.queryOne('SELECT id FROM users WHERE username = $1', [username.toLowerCase().trim()]);
    if (exists) return res.status(409).json({ error: 'El nombre de usuario ya está registrado' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 12);
    await db.run(
      'INSERT INTO users (id, name, username, password, role) VALUES ($1, $2, $3, $4, $5)',
      [id, name, username.toLowerCase().trim(), hash, role || 'manager']
    );
    res.status(201).json({ id, name, username, role: role || 'manager' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, username, role, active } = req.body;
    await db.run(
      'UPDATE users SET name = COALESCE($1, name), username = COALESCE($2, username), role = COALESCE($3, role), active = COALESCE($4, active) WHERE id = $5',
      [name || null, username || null, role || null, active ?? null, req.params.id]
    );
    res.json({ message: 'Usuario actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await db.run('UPDATE users SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
