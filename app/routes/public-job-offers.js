'use strict';

var express = require('express'),
  router = express.Router(),
  Promise = require('promise');

var ErrorVisage = require('../constants/error');

var JobOfferService = require('../services/job-offer-service');
var CandidateService = require('../services/candidate-service');

var addCandidateSubmission = function (req, res) {
  var jobId = req.params.jobOfferId;
  //retrieve all blobs from Monogo

  //TODO Replace that with getting the candidate instead of creating it at the same time.
  Promise.all([CandidateService.addCandidate(req.body.candidate), JobOfferService.getJob(jobId)])
    .then(function (results) {
      var candidate = results[0];
      var jobOffer = results[1];
      return CandidateService.addSubmission(req.body, jobOffer, candidate)
        .then(function (result) {
          var submission = result[0].toObject();
          submission.candidate = result[1];
          return res.json(submission);
        });
    })
    .catch(function (err) {
      if (err.code && err.code === 11000) {

        if (err.message.indexOf('candidateEmail') !== -1 ||
          err.message.indexOf('candidateCVmd5') !== -1) {
          err = {
            code: ErrorVisage.Code.EXISTING_CANDIDATE,
            message: ErrorVisage.Message.EXISTING_CANDIDATE
          };
        }
      }
      else if (err.type && err.type === 'emailValidationError') {
        err = {
          code: ErrorVisage.Code.CANDIDATE_EMAIL_VALIDATION_FAIL,
          message: ErrorVisage.Message.CANDIDATE_EMAIL_VALIDATION_FAIL,
          description: err.error
        };
      }
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem adding candidates for this job-offer',
        error: err
      });
    });
};

router.route('/active')
  .get(function (req, res, next) {
    var limit = req.query.limit || null;
    JobOfferService.retrieveActiveJobs({
        $and: [{'confidentiality': {$not: {'$eq': 'NO_ADVERTISE'}}},
          {'launched': true}]
      })
      .sort({'launchedAt': -1}).limit(limit)
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
  });

router.route('/:jobOfferId')
  //GET all blobs
  .get(function (req, res, next) {
    var jobId = req.params.jobOfferId;
    if (jobId === 'active' || jobId === 'inactive') {
      return next();
    }
    JobOfferService.getJob({_id: jobId})
      .then(function (jobOffer) {
        jobOffer = {
          _id: jobOffer._id,
          status: jobOffer.status,
          sourcing: jobOffer.sourcing,
          description: jobOffer.description,
          launched: jobOffer.launched,
          launchedAt: jobOffer.launchedAt,
          title: jobOffer.title,
          submitted: jobOffer.submitted,
          city: jobOffer.city,
          location: jobOffer.location,
          industry: jobOffer.industry,
          employmentType: jobOffer.employmentType,
          employmentStatus: jobOffer.employmentStatus,
          salaryRange: jobOffer.salaryRange,
          descriptionFile: jobOffer.descriptionFile
        };
        res.json(jobOffer);
        return next();
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding the job offer',
          error: err
        });
      });
  });

router.route('/:jobOfferId/candidates/')
  .post(function (req, res, next) {
    addCandidateSubmission(req, res, next);
  });

module.exports = router;