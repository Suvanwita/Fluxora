const router = require('express').Router();

const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);

module.exports = router;
