const router = require('express').Router();

const { checkRequest } = require('../controllers/check.controller');
const { validate } = require('../middlewares/validate.middleware');
const { checkSchema } = require('../validators/check.validator');

router.post('/', validate(checkSchema), checkRequest);

module.exports = router;
