var mongoose = require('mongoose');
var db = require('./db');
var Schema = mongoose.Schema;

var valuesEnuSubStatus = require('../data/candidate-status');
var valuesEnuCandRevReas = require('../data/candidate-review-reasons');


var enuSubStatus = {
  values: valuesEnuSubStatus,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuReasons = {
  values: [].concat(Object.keys(valuesEnuCandRevReas.QUALIFY),Object.keys(valuesEnuCandRevReas.DISQUALIFY),Object.keys(valuesEnuCandRevReas.OUTSTANDING)),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};


var candidateReviewSchema = new Schema({
  outstanding: {type:Boolean},
  reviewedBy: {type: String},
  reason: {type: String, enum: enuReasons},
  description : {type: String, maxlength: 254}
});

var candidateSubmissionSchema = new Schema({
  candidate: {type: Schema.Types.ObjectId, required: true},
  job: {type: Schema.Types.ObjectId, required: true},
  recruiter: {type: String},
  review: {type: candidateReviewSchema},
  candidateEmail: {type: String, maxlength: 254},
  candidateCVmd5: {type: String},
  candidateEmailHash: {type: String},
  candidateCVmd5Hash: {type: String},
  submittedAt: {type : Date, default: new Date()},
  status: {type: String, enum: enuSubStatus},
  at: {type : Date, default: new Date()},
  history: [
    {
      status: {type: String, enum: enuSubStatus},
      at: Date
    }
  ],
  notes: [{
    author: Schema.Types.ObjectId,
    message: String
  }]
});

candidateSubmissionSchema.index({candidate: 1, job: 1}, {unique: true});

//Have to create a hash with job + property value because monbogb doesn't support sparsing and
// uniqueness on coumpound indexes...
candidateSubmissionSchema.index({candidateEmailHash: 1}, {unique: true, sparse: true});
candidateSubmissionSchema.index({candidateCVmd5Hash: 1}, {unique: true, sparse: true});

module.exports = db.model('CandidateSubmission', candidateSubmissionSchema, 'candidate-submission');