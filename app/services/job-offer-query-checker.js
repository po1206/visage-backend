/**
 * Created by manu on 3/29/16.
 */

var PermissionsChecker = require('./permissions-checker');

var JobOfferQueryParser = function (req) {
  this.req = req;
  this.permissionsChecker = new PermissionsChecker(req.user);
};

JobOfferQueryParser.prototype.filter = function () {
  var filterForEmployer = function (body) {
    if (body) {
      //jobOffer
      if (body.notes) {
        delete body.notes;
      }
    }
  };

  if (!this.permissionsChecker.isAdmin()) {
    if (this.permissionsChecker.isEmployer()) {
      filterForEmployer(this.req.body);
    }
    if (this.permissionsChecker.isRecruiter()) {
      //TODO check recruiters queries
    }
  }
};

module.exports = function (req, res, next) {
  var queryChecker = new JobOfferQueryParser(req);
  queryChecker.filter();
  return next();
};