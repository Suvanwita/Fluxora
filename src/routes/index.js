const router = require('express').Router();

const apiKeyRoutes = require('./api-key.routes');
const authRoutes = require('./auth.routes');
const checkRoutes = require('./check.routes');
const projectRoutes = require('./project.routes');
const rateLimitRuleRoutes = require('./rate-limit-rule.routes');

router.use('/api-keys', apiKeyRoutes);
router.use('/auth', authRoutes);
router.use('/check', checkRoutes);
router.use('/projects', projectRoutes);
router.use('/rate-limit-rules', rateLimitRuleRoutes);

module.exports = router;
