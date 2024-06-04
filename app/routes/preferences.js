'use strict';

var express = require('express'),
  router = express.Router(),
  merge = require('merge');

var PermissionsChecker = require('../services/permissions-checker');
var RecruiterService = require('../services/recruiter-service');
var Preference = require('../domain/preference');
var common = require('../common');

var hawk = require('hawk');

var credentials = {
  id: 'fewjud839jeDu',
  key: common.config.secretKeyFileDownload,
  algorithm: 'sha256'
};

var addPreferences = function (req) {

  //TODO Prevent a recruiter from setting recruiter.validated to true
  var newUser = req.body;

  var id = new Buffer(req.user.sub).toString('base64');

  var user = {
    _id: id.replace(new RegExp('=', 'g'), ''),
    picture: newUser.picture,
    email: newUser.email,
    roles: newUser.roles
  };

  if (newUser.recruiter) {
    user.recruiter = newUser.recruiter;
  }

  return Preference.create(user);
};

var updatePreferences = function (req) {

  //TODO Prevent a recruiter from setting recruiter.validated to true
  var userId = req.params.userId;
  return Preference.findOne({_id: userId})
    .then(function(user) {
      user = merge(user, req.body);
      return user.save();
    });
};

//TODO Implement a real messaging QUEUE with REDIS
var successPreferencesCreation = function (res, created, next) {
  //MailDispatcher.newFreecruiter(req.user.sub, user);
  res.json(created);
  return next();
};

var errPreferencesCreation = function (res, err) {
  res.statusCode = 500;
  return res.json({
    message: 'There was a problem adding the user in the database.',
    error: err
  });
};

//TODO Implement a real messaging QUEUE with REDIS
var successPreferencesUpdate = function (res, updated, next) {
  //MailDispatcher.newFreecruiter(req.user.sub, user);
  res.json(updated);
  return next();
};

var errPreferencesUpdate = function (res, err) {
  res.statusCode = 500;
  return res.json({
    message: 'There was a problem updating the user in the database.',
    error: err
  });
};

router.route('/')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    var limitObject = {};
    var searchDateFilterObject = {};
    var params;

    if (req.query) {
      params = req.query;
      if (params.sortType) {
        limitObject.sortType = parseInt(params.sortType, 10);
        delete params.sortType;
      }
      if (params.offset) {
        limitObject.offset = parseInt(params.offset, 10);
        delete params.offset;
      }
      if (params.limit) {
        limitObject.limit = parseInt(params.limit, 10);
        delete params.limit;
      }
      if (params.searchDateFrom) {
        searchDateFilterObject.searchDateFrom = parseInt(params.searchDateFrom, 10);
        delete params.searchDateFrom;
      }
      if (params.searchDateTo) {
        searchDateFilterObject.searchDateTo = parseInt(params.searchDateTo, 10);
        delete params.searchDateTo;
      }
    }

    Preference.find(params)
      .then(function(filteredPreferences) {
        if (params.roles === 'recruiter' &&
          (searchDateFilterObject.searchDateFrom || searchDateFilterObject.searchDateTo)) {
          return RecruiterService.populateCVInfoPromise(
            filteredPreferences, searchDateFilterObject, false);
        }

        return filteredPreferences;
      })
      .then(function(filteredPreferences) {
        if (limitObject.limit) {
          filteredPreferences.sort(function (a, b) {
            if (a.created_at < b.created_at) {
              return limitObject.sortType;
            } else if (a.created_at > b.created_at) {
              return (-1) * limitObject.sortType;
            } else {
              return 0;
            }
          });
          filteredPreferences =
            filteredPreferences.slice(limitObject.offset, limitObject.offset + limitObject.limit);
        }
        return filteredPreferences;
      })
      .then(function(filteredPreferences) {
        if (params.roles === 'recruiter' &&
          (searchDateFilterObject.searchDateFrom || searchDateFilterObject.searchDateTo)) {
          return RecruiterService.populateBountyInfoPromise(filteredPreferences);
        }

        return filteredPreferences;
      })
      .then(function(filteredPreferences) {
        if (!permissionsChecker.isAdmin()) {
          //Only send company names if not admin
          filteredPreferences = filteredPreferences.map(function (pref) {
            if (pref.employer) {
              return {
                _id : pref._id,
                employer: {company: pref.employer.company}};
            }
          });
        }
        res.json(filteredPreferences);
        return next();
      })
      .catch(function(err) {
        return res.json({
          message: 'There was a problem retrieving preferences',
          error: err
        });
      });
  })
  .post(function (req, res, next) {
    // Get values from POST request. These can be done through forms or REST calls. These rely
    // on the 'name' attributes for forms
    if (req.body) {
      addPreferences(req).then(function (prefs) {
        successPreferencesCreation(res, prefs, next);
      }, function (err) {
        errPreferencesCreation(res, err);
      });
    }
  });

var preferencesCountPromise = function (params, searchDateFilterObject) {
  if (params.roles === 'recruiter' &&
    (searchDateFilterObject.searchDateFrom || searchDateFilterObject.searchDateTo)) {
    return Preference.find(params)
      .then(function(foundRecruiters) {
        return RecruiterService.populateCVInfoPromise(
          foundRecruiters, searchDateFilterObject, true);
      })
      .then(function(filteredRecruiters) {
        return filteredRecruiters.length;
      });
  }

  return Preference.count(params);
};

router.route('/count')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }

    var params = req.query;
    var searchDateFilterObject = {};

    delete params.offset;
    delete params.limit;
    delete params.sortType;
    if (params.searchDateFrom) {
      searchDateFilterObject.searchDateFrom = parseInt(params.searchDateFrom, 10);
      delete params.searchDateFrom;
    }
    if (params.searchDateTo) {
      searchDateFilterObject.searchDateTo = parseInt(params.searchDateTo, 10);
      delete params.searchDateTo;
    }

    preferencesCountPromise(params, searchDateFilterObject)
      .then(function(countResult) {
        res.json({
          query: req.query,
          count: countResult
        });
        return next();
      })
      .catch(function(err) {
        return res.json({
          message: 'There was a problem retrieving user count',
          error: err
        });
      });
  });

router.route('/:userId')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (req.params) {
      if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.params.userId)) {
        return res.sendStatus(401);
      }
      var userId = req.params.userId;
      if (userId !== 'count') {
        Preference.findOne({_id: userId}, function (err, userPref) {
          if (err) {
            return res.json({
              message: 'There was a problem retrieving user preferences',
              error: err
            });
          }
          else {
            res.json(userPref);
            return next();
          }
        });
      }
      else {
        return next();
      }

    }
  })
  .put(function (req, res, next) {
    if (req.body) {
      updatePreferences(req, req.body).then(function (userUpdated) {
        successPreferencesUpdate(res, userUpdated, next);
      }, function (err) {
        errPreferencesUpdate(res, err);
      });
    }
  })
  .delete(function (req, res, next) {
    var userId = req.params.userId;
    Preference.findOne({_id: userId}, function (err, preference) {
      preference.remove({
        _id: userId
      }, function (err, preference) {
        if (err) {
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem deleting the preferences',
            error: err
          });
        }
        res.json(preference);
        return next();
      });
    });
  });

router.route('/recruiters/signing')
  .get(function (req, res) {
    //FIXME Workaround because I did not setup secured protocol between ELB and instances on AWS...
    var protocol = req.protocol;
    var url = protocol +
      '://' +
      req.get('host') +
      '/reports';
    url += req.originalUrl.replace('/signing', '');

    var bewit = hawk.uri.getBewit(url, {
      credentials: credentials,
      ttlSec: 60 * 5
    });
    return res.json({
      signedUrl: (url.indexOf('?status') === -1) ? url + '?bewit=' + bewit : url + '&bewit=' + bewit
    });
  });

module.exports = router;
