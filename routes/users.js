const router = require('express').Router();
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    res.json(await db.query('SELECT id, name, username, role, avatar, active, created_at FROM users ORDER BY name'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Las cuentas ya no se crean acá: se dan de alta en RRHH (con su cuenta
   de acceso central) y quedan registradas en esta tabla automáticamente
   la primera vez que esa persona inicia sesión en TI. */
router.post('/', requireRole('admin'), (req, res) => {
  res.status(400).json({ error: 'Las cuentas se crean desde RRHH. Al iniciar sesión acá por primera vez, la persona queda registrada automáticamente.' });
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
