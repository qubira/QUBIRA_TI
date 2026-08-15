const router = require('express').Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const params = [];
    let where = 'WHERE 1=1';
    if (project_id) { params.push(project_id); where += ` AND a.project_id=$${params.length}`; }
    params.push(limit);

    res.json(await db.query(`
      SELECT a.*, u.name AS user_name, p.name AS project_name, p.code AS project_code
      FROM activities a
      LEFT JOIN users    u ON u.id = a.user_id
      LEFT JOIN projects p ON p.id = a.project_id
      ${where} ORDER BY a.created_at DESC LIMIT $${params.length}`, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
