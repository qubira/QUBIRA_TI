const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate, SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    const user = await db.queryOne(
      'SELECT * FROM users WHERE username = $1 AND active = 1',
      [username.toLowerCase().trim()]
    );
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, avatar: user.avatar },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.queryOne(
      'SELECT id, name, username, role, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Campos requeridos' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!bcrypt.compareSync(current_password, user.password))
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const hash = bcrypt.hashSync(new_password, 12);
    await db.run('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Contraseña actualizada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
