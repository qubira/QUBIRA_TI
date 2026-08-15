const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate, SECRET } = require('../middleware/auth');

/* Las credenciales ya NO se validan contra la tabla local `users` — se
   validan contra la cuenta central de Qubira (la misma que usan RRHH y
   Soporte). Acá solo se mantiene un registro local por usuario (mismo
   username) para no romper las referencias (created_by, responsible_id,
   etc.) que ya existen en projects/contracts/documents/emails. */
const CENTRAL_API = process.env.CENTRAL_API_URL || 'https://api-qubira.onrender.com';

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    let centralData;
    try {
      const centralRes = await fetch(`${CENTRAL_API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      centralData = await centralRes.json();
      if (!centralRes.ok || !centralData.ok) {
        return res.status(401).json({ error: centralData.error || 'Credenciales incorrectas' });
      }
    } catch (netErr) {
      console.error('[AUTH] No se pudo contactar la API central:', netErr.message);
      return res.status(502).json({ error: 'No se pudo verificar la cuenta. Intenta de nuevo en unos segundos.' });
    }

    const central = centralData.user;
    const uname = central.username.toLowerCase().trim();
    const fullName = `${central.nombre} ${central.apellidos || ''}`.trim();
    const tiRole = central.nivel_acceso >= 80 ? 'admin' : 'manager';

    let user = await db.queryOne('SELECT * FROM users WHERE username = $1', [uname]);
    if (!user) {
      const id = uuidv4();
      const placeholder = bcrypt.hashSync(uuidv4(), 10);
      await db.run(
        'INSERT INTO users (id, name, username, password, role) VALUES ($1,$2,$3,$4,$5)',
        [id, fullName, uname, placeholder, tiRole]
      );
      user = await db.queryOne('SELECT * FROM users WHERE id = $1', [id]);
    } else if (user.active === 0) {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' });
    }

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

/* La contraseña ya no vive acá — la cuenta es la central de Qubira.
   Restablecerla es exclusivo del panel de Soporte. */
router.put('/change-password', authenticate, (req, res) => {
  res.status(400).json({ error: 'Tu contraseña se administra desde el panel de Soporte de Qubira, no desde acá.' });
});

module.exports = router;
