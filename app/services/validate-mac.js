'use strict';

var hawk    = require('hawk');
var common = require('../common');

var credentials = {
  id: 'fewjud839jeDu',
  key: common.config.secretKeyFileDownload,
  algorithm: 'sha256'
};

function credentialsFunc (id, callback) {
  return callback(null, credentials);
}

function validateMac (req, res, next) {
  hawk.uri.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {
    if (err) {
      console.error(err);
      return res.sendStatus(401);
    }
    next();
  });
}

module.exports = validateMac;