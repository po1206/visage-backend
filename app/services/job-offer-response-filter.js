'use strict';
/**
 * Created by manu on 3/29/16.
 */

var PermissionsChecker = require('./permissions-checker');

var JobOfferResponseParser = function (user, body) {
  this.body = body;
  this.permissionsChecker = new PermissionsChecker(user);
};

JobOfferResponseParser.prototype.filter = function () {
  var filterForEmployer = function (body) {
    if (body) {
      //jobOffer
      if (body.notes) {
        delete body.notes;
      }
    }
  };

  if (this.body && this.body.submissions) {
    this.body.submissionsNb = this.body.submissions.length;
    delete this.body.submissions;
  }

  if (!this.permissionsChecker.isAdmin()) {
    if (this.permissionsChecker.isEmployer()) {
      filterForEmployer(this.body);
    }
    if (this.permissionsChecker.isRecruiter()) {
      //TODO check recruiters queries
    }
  }
};

module.exports = function (req, res, next) {
  var responseChecker = new JobOfferResponseParser(req.user, res.body);
  responseChecker.filter();
  res.json(responseChecker.body);
  return next();
};