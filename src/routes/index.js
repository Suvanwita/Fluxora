const router = require('express').Router();

const apiKeyRoutes = require('./api-key.routes');
const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');

router.use('/api-keys', apiKeyRoutes);
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);

module.exports = router;
