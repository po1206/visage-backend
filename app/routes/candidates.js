'use strict';

var express = require('express'),
  router = express.Router(),
  merge = require('merge');

var Candidate = require('../domain/candidate');

var PermissionsChecker = require('../services/permissions-checker');

var addCandidate = function (req) {
  return new Promise(function (resolve, reject) {
    var newUser = req.body;

    var user = {
      roles: newUser.roles
    };

    if (newUser.candidate) {
      user.candidate = newUser.candidate;
    }

    Candidate.create(user, function (err, createdUser) {
      if (err) {
        reject(err);
      }
      else {
        //Blob has been created
        resolve(createdUser);
      }
    });
  });

};

var updateCandidates = function (req) {
  return new Promise(function (resolve, reject) {
    var userId = req.params.userId;
    Candidate.findOne({_id: userId}, function (err, user) {
      if (err) {
        reject(err);
      }
      else {
        user = merge(user, req.body);
        user.save(function (err) {
          if (err) {
            reject(err);
          }
          resolve(user);
        });
      }
    });
  });

};

//TODO Implement a real messaging QUEUE with REDIS
var successCandidatesCreation = function (res, created, next) {
  //MailDispatcher.newFreecruiter(req.user.sub, user);
  res.json(created);
  return next();
};

var errCandidatesCreation = function (res, err) {
  res.statusCode = 500;
  return res.json({
    message: "There was a problem adding the user in the database.",
    error: err
  });
};

//TODO Implement a real messaging QUEUE with REDIS
var successCandidatesUpdate = function (res, updated, next) {
  //MailDispatcher.newFreecruiter(req.user.sub, user);
  res.json(updated);
  return next();
};

var errCandidatesUpdate = function (res, err) {
  res.statusCode = 500;
  return res.json({
    message: "There was a problem updating the user in the database.",
    error: err
  });
};

router.route('/')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }
    var limitObject = {};
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
    }
    var find = Candidate.find(params);
    if (limitObject.limit) {
      find
        .sort({created_at: limitObject.sortType})
        .skip(limitObject.offset)
        .limit(limitObject.limit);
    }
    find.find(function (err, prefs) {
      if (err) {
        return res.json({
          message: "There was a problem retrieving candidates",
          error: err
        });
      }
      else {
        res.json(prefs);
        return next();
      }
    })
  })
  .post(function (req, res, next) {
    // Get values from POST request. These can be done through forms or REST calls. These rely
    // on the "name" attributes for forms
    if (req.body) {
      addCandidate(req)
        .then(function (prefs) {
          successCandidatesCreation(res, prefs, next);
        }, function (err) {
          errCandidatesCreation(res, err);
        });
    }
  });

router.route('/count')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }
    Candidate.count(req.query, function (err, result) {
      if (err) {
        return res.json({
          message: "There was a problem retrieving user count",
          error: err
        });
      }
      else {
        res.json({
          query: req.query,
          count: result
        });
        return next();
      }
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
      if (userId !== "count") {
        Candidate.findOne({_id: userId}, function (err, userPref) {
          if (err) {
            return res.json({
              message: "There was a problem retrieving user candidates",
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
      updateCandidates(req, req.body).then(function (userUpdated) {
        successCandidatesUpdate(res, userUpdated, next);
      }, function (err) {
        errCandidatesUpdate(res, err);
      });
    }
  })
  .delete(function (req, res, next) {
    var userId = req.params.userId;
    Candidate.findOne({_id: userId}, function (err, candidate) {
      candidate.remove({
        _id: userId
      }, function (err, candidate) {
        if (err) {
          res.statusCode = 500;
          return res.json({
            message: "There was a problem deleting the candidates",
            error: err
          });
        }
        res.json(candidate);
        return next();
      });
    });
  });

module.exports = router;
