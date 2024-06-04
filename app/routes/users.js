'use strict';

var express = require('express'),
  router = express.Router(),
  merge = require('merge');

var PermissionsChecker = require('../services/permissions-checker');

var UserService = require('../services/user-service');
var JobOfferService = require('../services/job-offer-service');

var JobOffer = require('../domain/job-offer');

/* GET users listing. */
router.get('/', function (req, res) {
  //if there is an employer id in the request filter by employer_id
  if (req.params) {
    var permissionsChecker = new PermissionsChecker(req.user);
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }
    UserService.getUsers(req.query.user_id).then(
      function (users) {
        res.json(users);
      },
      function (err) {
        console.log(err);
        return res.json({
          message: 'There was a problem retrieving users',
          error: err
        });
      }
    );
  }
});

router.route('/:userId')
  .get(function (req, res) {
    //if there is an employer id in the request filter by employer_id
    if (req.params) {
      var permissionsChecker = new PermissionsChecker(req.user);
      if (!permissionsChecker.isAdmin()) {
        return res.sendStatus(401);
      }
      UserService.getUser(req.params.userId)
        .then(function (user) {
            res.json(user);
          },
          function (err) {
            console.error(err);
            return res.json({
              message: 'There was a problem retrieving user',
              error: err
            });
          });
    }

  });

router.route('/:userId/job-offers')
  .get(function (req, res, next) {
    //if there is an employer id in the request filter by employer_id
    if (req.params) {
      var permissionsChecker = new PermissionsChecker(req.user);
      if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.params.userId)) {
        return res.sendStatus(401);
      }
      var employerId = req.params.userId;
      var baseParams = {employer_id: employerId};

      if (req.query) {
        if(req.query.status) {
          baseParams.status = req.query.status;
        }
      }
      JobOffer.find(baseParams, function (err, jobOffers) {
        if (err) {
          return next(err);
        }
        else {
          //respond to both HTML and JSON. JSON responses require 'Accept: application/json;'
          // in the Request Header
          res.format({
            //JSON response will show all blobs in JSON format
            json: function () {
              res.json(jobOffers);
            }
          });
        }
      }).sort({submitted: -1});
    }
  });

router.route('/:userId/job-offers/active')
  .get(function (req, res, next) {
    if (req.params) {
      var permissionsChecker = new PermissionsChecker(req.user);
      if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.params.userId)) {
        return res.sendStatus(401);
      }
      JobOfferService.retrieveActiveJobs({employer_id: req.params.userId})
        .then(function (jobOffers) {
          res.json(jobOffers);
          return next();
        })
        .catch(function (err) {
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem finding active job offers',
            error: err
          });
        });
    }
  });

router.route('/:userId/job-offers/inactive')
  .get(function (req, res, next) {
    if (req.params) {
      var permissionsChecker = new PermissionsChecker(req.user);
      if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.params.userId)) {
        return res.sendStatus(401);
      }
      JobOfferService.retrieveInactiveJobs({employer_id: req.params.userId})
        .then(function (jobOffers) {
          res.json(jobOffers);
          return next();
        })
        .catch(function (err) {
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem finding inactive job offers',
            error: err
          });
        });
    }
  });

router.route('/:userId/recruiter-assignments')
  .get(function (req, res) {
    //if there is an employer id in the request filter by employer_id
    if (req.params) {
      var permissionsChecker = new PermissionsChecker(req.user);
      if (!permissionsChecker.isAdmin() && !(permissionsChecker.isOwner(req.params.userId) &&
        permissionsChecker.isValidatedRecruiter())) {
        return res.sendStatus(401);
      }
      var recruiterId = req.params.userId;

      //FIXME security issue, do proper query check on the query
      JobOfferService.getAssignmentsByRecruiter(recruiterId,req.query)
        .then(function (recruiterAssignments) {
          return res.json(recruiterAssignments);
        })
        .catch(function (err) {
          console.log(err);
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem retrieving assignments',
            error: err
          });

        });
    }
  });

router.route('/:userId/expert-assignments')
  .get(function (req, res) {
    //if there is an employer id in the request filter by employer_id
    if (req.params) {
      var permissionsChecker = new PermissionsChecker(req.user);
      if (!permissionsChecker.isAdmin() && !(permissionsChecker.isOwner(req.params.userId))) {
        return res.sendStatus(401);
      }
      var expertId = req.params.userId;

      //FIXME security issue, do proper query check on the query
      JobOfferService.getAssignmentsByExpert(expertId,req.query)
        .then(function (expertAssignments) {
          return res.json(expertAssignments);
        })
        .catch(function (err) {
          console.log(err);
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem retrieving assignments',
            error: err
          });

        });
    }
  });

module.exports = router;