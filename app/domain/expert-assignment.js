'use strict';

var mongoose = require('mongoose');
var db = require('./db');

var Schema = mongoose.Schema;

var expertsAssignmentSchema = new Schema({
  expert: {type: String, required: true},
  job: {type: Schema.Types.ObjectId, required: true},
  maxValidation: {type: Number, required: true, default: 100},
  assigned: {type: Date, required: true, default: Date.now},
  started: {type: Date},
  lastEvaluation: {type: Date},
  onHold: {type: Boolean, default: false}
});

expertsAssignmentSchema.index({expert: 1, job: 1}, {unique: true});

module.exports = db.model('ExpertAssignment', expertsAssignmentSchema, 'experts-assignment');