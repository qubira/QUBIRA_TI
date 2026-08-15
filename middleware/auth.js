const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'quibira_dev_secret_change_in_production';

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: 'Acceso no autorizado para este rol' });
    next();
  };
}

module.exports = { authenticate, requireRole, SECRET };
