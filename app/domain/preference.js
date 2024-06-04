'use strict';

var mongoose = require('mongoose'),
  mongoosastic = require('mongoosastic');
var indexer = require('./indexer');
var common = require('../common');

var db = require('./db');

var valuesJobRoles = require('../data/job-roles.json');
var valuesEnuIndustries = require('../data/industries.json');
var valuesEnuRoles = require('../data/roles.json');
var valuesEnuCountries = require('../data/countries.json');
var valuesProductTypes = require('../data/product-types.json');
var valuesPaymentStatus = require('../data/payment-statuses.json');
var valuesAreas = require('../data/areas.json');
var valuesAvailability = require('../data/availability.json');

var countriesParsed = valuesEnuCountries.geonames.map(function (country) {
  return country.countryName;
});

var enuRoles = {
  values: valuesEnuRoles,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuJobRoles = {
  values: valuesJobRoles,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumIndustries = {
  values: valuesEnuIndustries,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuCountries = {
  values: countriesParsed,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumProductType = {
  values: valuesProductTypes,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumPaymentStatus = {
  values: valuesPaymentStatus,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuAreas = {
  values: valuesAreas,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enuAvailability = {
  values: valuesAvailability,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var recruiterSchema = new mongoose.Schema({
  validated: {type: Boolean, required: true, default: true},
  industries: {type: [String], enum: enumIndustries, default: []},
  jobRoles: {type: [String], enum: enuJobRoles, default: []},
  location: {type: String, enum: enuCountries},
  recruitmentAreas: {type: [String], enum: enuAreas, default: []},
  availability: {type: String, enum: enuAvailability},
  languages: {type: [String], default: []}
});

var expertSchema = new mongoose.Schema({
  industries: {type: [String], enum: enumIndustries, default: []},
  jobRoles: {type: [String], enum: enuJobRoles, default: []},
  location: {type: String, enum: enuCountries},
  areas: {type: [String], enum: enuAreas, default: []},
  availability: {type: String, enum: enuAvailability}
});

var paymentSchema = new mongoose.Schema({
  _id: {type: String, required: true},
  status: {type: String, enum: enumPaymentStatus, required: true},
  sentOn: {type: Date, required: true},
  paidOn: Date,
  validity: Date,
  productType: {type: String, enum: enumProductType, required: true},
  jobQuantity: {type: Number, required: true},
  productLabel: {type: String, required: true},
  discountLabel: String,
  description: String,
  price: {type: Number, required: true},
  discount: Number
});

var employerSchema = new mongoose.Schema({
  phone: {type: String, es_indexed: false},
  company: {type: String, es_indexed: true, es_boost: 5},
  billingAddress: {type: String, es_indexed: false},
  payments: {type: [paymentSchema], es_indexed: false}
});

var preferenceSchema = new mongoose.Schema({
  _id: {type: String, required: true, es_indexed: false},
  name: {type: String, es_indexed: true, es_boost: 8},
  email: {type: String, es_indexed: true, es_boost: 3},
  picture: {type: String, es_indexed: false},
  roles: {type: [String], enum: enuRoles, es_indexed: false},
  recruiter: {type: recruiterSchema, es_indexed: false},
  expert: {type: expertSchema, es_indexed: false},
  employer: {
    type: employerSchema,
    es_indexed: true,
    es_type: 'nested',
    es_include_in_parent: true
  },
  created_at: {type: Date, required: true, default: Date.now(), es_indexed: false}
});
preferenceSchema.plugin(mongoosastic, common.config.es);

var Preference = db.model('Preference', preferenceSchema, 'preferences');
Preference.createMapping(function (err, mapping) {
  if (err) {
    console.log('error creating mapping (you can safely ignore this)');
    console.log(err);
  }
  else {
    console.log('mapping created!');
    console.log(mapping);
  }
});

indexer(Preference);

module.exports = Preference;