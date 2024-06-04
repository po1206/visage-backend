'use strict';

/**
 * Created by manu on 6/20/16.
 */

var Promise = require('promise');

var Preference = require('../domain/preference');


function loadUser(req) {
  return new Promise(function (resolve, reject) {
    req.user.roles = [];
    req.user.preferences = null;
    req.user.encodedAuthUser =
      new Buffer(req.user.sub).toString('base64').replace(new RegExp('=', 'g'), '');
    req.user.encodedEmail = (req.user.email) ? req.user.email.toString('base64') : null;

    if (req.user.app_metadata) {
      req.user.roles = req.user.app_metadata.roles;
    }

    Preference.findOne({_id: req.user.encodedAuthUser})
      .then(function (prefs) {
        req.user.preferences = prefs;
        resolve();
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

module.exports = function (req, res, next) {
  loadUser(req).then(function () {
    return next();
  }, function (err) {
    return next(err);
  });
};