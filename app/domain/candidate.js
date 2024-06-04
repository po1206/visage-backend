'use strict';

var mongoose = require('mongoose');
var db = require('./db');

var valuesJobRoles = require('../data/job-roles.json');
var valuesEnuIndustries = require('../data/industries.json');
var valuesEnuCountries = require('../data/countries.json');

var countriesParsed = valuesEnuCountries.geonames.map(function (country) {
  return country.countryName;
});

var enuRoles = {
  values: ["candidate"],
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuJobRoles = {
  values: valuesJobRoles,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuIndustries = {
  values: valuesEnuIndustries,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuCountries = {
  values: countriesParsed,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var candidateSchema = new mongoose.Schema({
  roles: {type: [String], enum: enuRoles, required: true},
  candidate: {
    name: {type : String, required:true},
    nationality: {type: String, enum: enuCountries},
    location: {type: String, enum: enuCountries, required:true},
    city: String,
    industry: {type: String, enum: enuIndustries},
    jobRole: {type: String, enum: enuJobRoles},
    jobTitle: {type: String},
    employer: {type: String},
    email: {type : String, required:true},
    coverLetter: String,
    video: String,
    picture: mongoose.Schema.Types.Mixed,
    cv: mongoose.Schema.Types.Mixed,
    socialProfiles: {type: Array},
    socialPhotoUrl: {type: String},
    applications: [mongoose.Schema.Types.ObjectId]
  },
  created_at: {type: Date, required: true, default: Date.now()}
});
module.exports = db.model('Candidate', candidateSchema, 'candidates');