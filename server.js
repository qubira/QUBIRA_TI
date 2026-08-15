require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS no permitido'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Serve local uploads in development (production uses Cloudinary URLs directly)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/projects',   require('./routes/projects'));
app.use('/api/contracts',  require('./routes/contracts'));
app.use('/api/documents',  require('./routes/documents'));
app.use('/api/whatsapp',   require('./routes/whatsapp'));
app.use('/api/emails',     require('./routes/emails'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/requirements', require('./routes/requirements'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve vanilla frontend (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

if (require.main === module) {
  // Ejecución directa (Render, local con `node server.js`)
  db.init()
    .then(() => {
      app.listen(PORT, () => console.log(`🚀  Qubira CRM Backend en http://localhost:${PORT}`));
    })
    .catch(err => {
      console.error('❌  Error al conectar con la base de datos:', err.message);
      process.exit(1);
    });
} else {
  // Importado como función serverless (Vercel) — no bloquea el export esperando la DB
  db.init().catch(err => console.error('❌  Error al conectar con la base de datos:', err.message));
}

module.exports = app;
