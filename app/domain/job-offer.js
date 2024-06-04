'use strict';

var mongoose = require('mongoose'),
  mongoosastic = require('mongoosastic');
var indexer = require('./indexer');
var db = require('./db');
var BountyHistory = require('./bounty-history');
var common = require('../common');

var employmentStatus = require('../data/employment-status.json');
var valuesJobRoles = require('../data/job-roles.json');
var valuesEnuCountries = require('../data/countries.json');
var valuesEnuJobStatus = require('../data/job-status');
var valuesEnuIndustries = require('../data/industries.json');
var valuesEnuEmployType = require('../data/employment-type.json');
var valuesEnuSalaryRange = require('../data/salary-range.json');
var valuesProducts = require('../data/products.json');
var valuesConfidentiality = require('../data/confidentiality.json');


var countriesParsed = valuesEnuCountries.geonames.map(function (country) {
  return country.countryName;
});

var salaryRangesParsed = [];
valuesEnuSalaryRange.forEach(function (category) {
  salaryRangesParsed = salaryRangesParsed.concat(category.ranges);
});

var enuRoles = {
  values: valuesJobRoles,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuProducts = {
  values: valuesProducts,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuConfidentiality = {
  values: Object.keys(valuesConfidentiality),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuCountries = {
  values: countriesParsed,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuJobStatus = {
  values: valuesEnuJobStatus,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumIndustries = {
  values: valuesEnuIndustries,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumEmploymentStatus = {
  values: employmentStatus,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumEmploymentType = {
  values: valuesEnuEmployType,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumSalaryRanges = {
  values: salaryRangesParsed,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var shortlistSchema = new mongoose.Schema({
  createdAt: Date,
  sentAt: Date,
  lastUpdateAt: Date,
  lastViewedAt: Date
});

var requirementsSchema = new mongoose.Schema({
  candidateDescription: String,
  skills: [String],
  resLocation: String,
  gender: String,
  nationality: String,
  language: String,
  jobTitle: String,
  yearsExp: String,
  employer: String,
  workExp: String,
  location: String,
  major: String,
  degree: String,
  salary: String,
  certifications: String,
  miscellaneous: String
});

var requirementsUpdatesSchema = new mongoose.Schema({
  updatedAt: {type: Date, default: new Date()},
  diffs: [
    {
      kind: String,
      path: [mongoose.Schema.Types.Mixed],
      lhs: mongoose.Schema.Types.Mixed,
      rhs: mongoose.Schema.Types.Mixed,
      index: Number,
      item: mongoose.Schema.Types.Mixed
    }
  ]
});

var jobOfferSchema = new mongoose.Schema({
  title: {type: String, required: true, 'es-indexed': true, es_boost: 15},
  role: {type: String, enum: enuRoles, default: '', es_indexed: false},
  location: {type: String, enum: enuCountries, required: true, 'es-indexed': true, es_boost: 3},
  city: {type: String, default: '', 'es-indexed': true},
  industry: {type: String, enum: enumIndustries, default: '', es_indexed: false},
  employmentStatus: {type: String, enum: enumEmploymentStatus, es_indexed: false},
  employmentType: {type: String, enum: enumEmploymentType, es_indexed: false},
  salaryRange: {type: String, enum: enumSalaryRanges, default: '', es_indexed: false},
  description: {type: String, 'es-indexed': true, es_boost: 5},
  descriptionFile: {type: mongoose.Schema.Types.Mixed, es_indexed: false},
  notes: {type: String, es_indexed: false},
  employer_id: {type: String, required: true, es_indexed: false},
  draftCreatedAt : {type: Date, es_indexed: false},
  submitted: {type: Date, es_indexed: false},
  launched: {type: Boolean, es_indexed: false},
  launchedAt: {type: Date, es_indexed: false},
  sourcing: {type: Boolean, es_indexed: false},
  status: {type: String, enum: enuJobStatus, required: true, es_indexed: false},
  source: {type: String, default: 'https://app.visage.jobs', es_indexed: false},
  sourceId: {type: String, default: '', es_indexed: false},
  product: {type: String, enum: enuProducts, es_indexed: false},
  syncedWith: {type: mongoose.Schema.Types.Mixed, es_indexed: false},
  paid: {type: Date, es_indexed: false},
  tempShortlistUrl: {type: String, es_indexed: false},
  assignments: {type: [mongoose.Schema.Types.ObjectId], es_indexed: false},
  expertsAssignments: {type: [mongoose.Schema.Types.ObjectId], es_indexed: false},
  submissions: {type: [mongoose.Schema.Types.ObjectId], es_indexed: false},
  shortlist: {type: shortlistSchema, es_indexed: false},
  requirements: {type: requirementsSchema, es_indexed: false},
  confidentiality : {type: String, enum: enuConfidentiality, es_indexed: false},
  //Based on deep-diff library by flitbit https://github.com/flitbit/diff
  requirementsUpdates: {type: [requirementsUpdatesSchema], es_indexed: false},
  pre1dot8: {type: Boolean, es_indexed: false},
  trial : {type: Boolean, es_indexed: false},
  maxSourced : {type:Number , default : 999, es_indexed: false},
  maxSourcedTrial : {type:Number , default : 50, es_indexed: false},
  tandc : {type:Boolean, es_indexed: false},
  bounty: {type: Number, required: true, default: 3}
});

// Create a document in bounty history after saving job offer if it's needed
function createBountyHistoryDoc (jobOfferDoc) {
  var historyEntry = {
    job: jobOfferDoc._id,
    amount: jobOfferDoc.bounty,
    modifiedAt: new Date()
  };

  BountyHistory.find({ job: jobOfferDoc._id }).sort({modifiedAt: -1})
    .then(function(historyDocs) {
      if (historyDocs && historyDocs.length > 0) {
        var latestHistoryDoc = historyDocs[0];
        if (latestHistoryDoc.amount !== historyEntry.amount) {
          BountyHistory.create(historyEntry);
        }
      } else {
        BountyHistory.create(historyEntry);
      }
    });
}

jobOfferSchema.post('save', function(doc) {
  createBountyHistoryDoc(doc);
});

jobOfferSchema.post('findOneAndUpdate', function(doc) {
  createBountyHistoryDoc(doc);
});

jobOfferSchema.post('insertMany', function(docs) {
  docs.forEach(function (doc) {
    createBountyHistoryDoc(doc);
  });
});

jobOfferSchema.post('update', function(doc) {
  createBountyHistoryDoc(doc);
});

jobOfferSchema.index({'shortlist.submissions': 1});
jobOfferSchema.plugin(mongoosastic, common.config.es);
var JobOffer = db.model('JobOffer', jobOfferSchema, 'job-offers');
JobOffer.createMapping(function (err, mapping) {
  if (err) {
    console.log('error creating mapping (you can safely ignore this)');
    console.log(err);
  }
  else {
    console.log('mapping created!');
    console.log(mapping);
  }
});

indexer(JobOffer);

module.exports = JobOffer;