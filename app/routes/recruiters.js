'use strict';

var express = require('express'),
  router = express.Router(),
  merge = require('merge');

var ErrorVisage = require('../constants/error');

var CandidateService = require('../services/candidate-service');

var PermissionsChecker = require('../services/permissions-checker');

router.route('/:recruiterId/submissions')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (req.params && req.params.recruiterId) {
      if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.params.recruiterId)) {
        return res.sendStatus(401);
      }
      var params = {
        recruiter : req.params.recruiterId
      };
      if(req.query.jobs) {
        if(!Array.isArray(req.query.jobs)) {
          req.query.jobs = [req.query.jobs];
        }
        params.jobs = req.query.jobs;
      }
      CandidateService.getSubmissionsStatus(params)
        .then(function (result) {
          return res.json(result);
        })
        .catch(function (err) {
          console.error(err);
          res.statusCode = 500;
          return res.json(
            {
              message: 'There was a problem retrieving submissions',
              error: err
            });
        });
    }
    else {
      res.statusCode = 422;
      return res.json(
        {
          message: 'There was a problem retrieving submissions',
          error: {
            code: ErrorVisage.Code.MISSING_PARAMETER,
            message: ErrorVisage.Message.MISSING_PARAMETER
          }
        });
    }
  });

module.exports = router;
