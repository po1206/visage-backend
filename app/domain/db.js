'use strict';

var mongoose = require('mongoose');
var common = require('../common');

var db;

db = mongoose.createConnection(common.config.db.fullStr);
mongoose.Promise = require('bluebird');

db.on('error', function (err) {
  if (err) {
    throw err;
  }
});

db.once('open', function callback() {
  console.info('Mongo db connected successfully');
});

module.exports = db;