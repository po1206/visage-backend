'use strict';

var express = require('express');
var pkg = require('../package');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
  res.json({
    version: pkg.version,
    success: 'API is available'
  });
});

module.exports = router;
