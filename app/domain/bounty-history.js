'use strict';

var mongoose = require('mongoose');
var db = require('./db');
var Schema = mongoose.Schema;

var bountyHistorySchema = new mongoose.Schema({
  job: { type: Schema.Types.ObjectId, required: true, ref: 'JobOffer' },
  amount: { type: Number, required: true },
  modifiedAt: { type: Date, es_indexed: false }
});

module.exports= db.model('BountyHistory', bountyHistorySchema, 'bountyHistories');
