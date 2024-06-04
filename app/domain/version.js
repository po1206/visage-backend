'use strict';

var mongoose = require('mongoose');
var db = require('./db');

var version = new mongoose.Schema({
  current: {type: String, required: true},
  previous: {type: String, required: true, default : '0'},
  updatedAt: {type: Date, required: true, default : Date.now()}
});
module.exports = db.model('Version', version, 'versions');