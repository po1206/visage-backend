'use strict';

var mongoose = require('mongoose');
var db = require('./db');

var Schema = mongoose.Schema;

var recruitersAssignmentSchema = new Schema({
  recruiter: {type: String, required: true},
  job: {type: Schema.Types.ObjectId, required: true},
  maxSlots: {type: Number, required: true, default: 99},
  approvedCVs: {type:Number, required:true, default:0},
  pendingCVs: {type:Number, required:true, default:0},
  assigned: {type: Date, required: true, default: Date.now},
  started: {type: Date},
  lastSubmission: {type: Date},
  onHold: {type: Boolean, default: false},
});

recruitersAssignmentSchema.index({recruiter: 1, job: 1}, {unique: true});

module.exports =
  db.model('RecruiterAssignment', recruitersAssignmentSchema, 'recruiters-assignment');