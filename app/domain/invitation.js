'use strict';

var mongoose = require('mongoose');
var db = require('./db');

var valuesInvitationStatus = require('../data/invitation-statuses.json');
var valuesEnuRoles = require('../data/roles.json');

var enuRoles = {
  values: valuesEnuRoles,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var enumInvitationStatus = {
  values: valuesInvitationStatus,
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var invitationSchema = new mongoose.Schema({
  status: {type: String, enum: enumInvitationStatus, required: true},
  sentOn: {type: Date, required: true},
  confirmedOn: Date,
  email: {type: String, required: true},
  role: {type: String, required: true, enum:enuRoles},
  key: {type: String, required: true}
});
module.exports= db.model('Invitation', invitationSchema, 'invitations');