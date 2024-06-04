'use strict';

var express = require('express'),
  router = express.Router(),
  Promise = require('promise'),
  merge = require('merge'),
  diff = require('deep-diff').diff,
  csv = require('csv');

var stream = require('stream');

var candidateReviewReason = require('../data/candidate-review-reasons');

var moment = require('moment');
var JobOfferService = require('../services/job-offer-service');
var CandidateService = require('../services/candidate-service');
var Preference = require('../domain/preference');
var macValidation = require('../services/validate-mac');
var MediaService = require('../services/media-service');
var RecruiterService = require('../services/recruiter-service');

//router.route('/job-offers/:jobOfferId/candidates')
//  .get(macValidation);

//TODO Refactor these 2 functions to factorize them
router.route('/job-offers/:jobOfferId/candidates')
  .get(function (req, res) {
    var jobId = req.params.jobOfferId;
    //retrieve all blobs from Monogo

    delete req.query.bewit;
    var job, submissions = null;
    Promise.all([JobOfferService.getJob(jobId),
        CandidateService.retrieveSubmissions(jobId, req.query, {roles: ['admin']})])
      .then(function (results) {
        job = results[0];
        submissions = results[1];
        return Promise.all([Preference.findOne({_id: job.employer_id}),
          CandidateService.retrieveCandidates(submissions)]);
      })
      .then(function (results) {

        var employer = results[0];
        var submissionsWithCandidates = results[1];

        var filename = employer.employer.company +
          '_' +
          job.title +
          '_' +
          'longlist' +
          moment().format('YYYYMMDDHHmmss');
        filename = filename.replace(/ /gi, '_');
        filename = filename.replace(/[^\w\s\-_]/gi, '');
        res.header('Content-Disposition', 'attachment; filename=' + filename + '.csv');
        res.header('Content-Type', 'text/csv; charset=utf-8');
        var columns = {
          name: 'Name',
          email: 'E-Mail',
          nationality: 'Nationality',
          location: 'Location',
          city: 'City',
          cv: 'CV Link',
          submissionDate: 'Date of submission',
          status: 'Status',
          comments: 'Comments'
        };
        var columnsArray = Object.keys(columns);

        var mediaUrl = MediaService.getUrl('CV') + '/';

        var stringifier = csv.stringify({header: true, columns: columns});

        var data;

        stringifier.on('readable', function () {
          while (data = stringifier.read()) {
            res.write(data);
          }
        });

        stringifier.on('end', function () {
          res.end();
        });

        submissionsWithCandidates.forEach(function (submissionCandidate, index) {
          var candidateObject = submissionCandidate.candidate.candidate;
          var submissionObject = {
            name: candidateObject.name,
            //Show contact only when candidate has been approved
            email: (submissionCandidate.status ===
            'Approved' ||
            submissionCandidate.status ===
            'Shortlisted') ? candidateObject.email : '',
            nationality: candidateObject.nationality,
            location: candidateObject.location,
            city: candidateObject.city,
            //Show cv only when candidate has been approved
            cv: (candidateObject.cv &&
            (submissionCandidate.status ===
            'Approved' ||
            submissionCandidate.status ===
            'Shortlisted') ) ? mediaUrl + candidateObject.cv.identifier : '',
            submissionDate: moment(submissionCandidate.submittedAt).format('DD/MM/YYYY HH:mm:ss'),
            status: submissionCandidate.status,
            comments: ''
          };

          if (submissionCandidate.review) {
            submissionObject.comments =
              candidateReviewReason.DISQUALIFY[submissionCandidate.review.reason];
            if (submissionCandidate.review.description) {
              submissionObject.comments += ': ' + submissionCandidate.review.description;
            }
          }

          var candidateArray = [];
          columnsArray.forEach(function (column) {
            candidateArray.push(submissionObject[column]);
          });

          try {
            stringifier.write(candidateArray);
          }
          catch (err) {
            console.error(err);
          }
        });
        stringifier.end();
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem downloading the candidates for this job-offer',
          error: err
        });
      });
  });

router.route('/job-offers/:jobOfferId/candidates/master')
  .get(function (req, res) {
    var jobId = req.params.jobOfferId;
    //retrieve all blobs from Monogo

    delete req.query.bewit;
    var job, submissions = null;
    Promise.all([JobOfferService.getJob(jobId),
        CandidateService.retrieveSubmissions(jobId, req.query, {roles: ['admin']})])
      .then(function (results) {
        job = results[0];
        submissions = results[1];
        return Promise.all([Preference.findOne({_id: job.employer_id}),
          CandidateService.retrieveCandidates(submissions),
          RecruiterService.retrieveRecruiters(submissions)]);
      })
      .then(function (results) {

        var employer = results[0];
        var submissionsWithCandidates = results[1];
        var submissionsWithRecruiters = results[2];

        var filename = employer.employer.company +
          '_' +
          job.title +
          '_' +
          'longlist' +
          moment().format('YYYYMMDDHHmmss');
        filename = filename.replace(/ /gi, '_');
        filename = filename.replace(/[^\w\s\-_]/gi, '');
        res.header('Content-Disposition', 'attachment; filename=' + filename + '.csv');
        res.header('Content-Type', 'text/csv; charset=utf-8');

        var columns = {
          name: 'Name',
          email: 'E-Mail',
          nationality: 'Nationality',
          location: 'Location',
          city: 'City',
          jobTitle: 'Job Title',
          employer: 'Employer',
          cv: 'CV Link',
          recruiterName: 'Recruiter Name',
          recruiterEmail: 'Recruiter E-mail',
          submissionDate: 'Date of submission',
          status: 'Status',
          comments: 'Comments'
        };
        var columnsArray = Object.keys(columns);

        var mediaUrl = MediaService.getUrl('CV') + '/';

        var stringifier = csv.stringify({header: true, columns: columns});

        var data;

        stringifier.on('readable', function () {
          while (data = stringifier.read()) {
            res.write(data);
          }
        });

        stringifier.on('end', function () {
          res.end();
        });

        submissionsWithCandidates.forEach(function (submissionCandidate, index) {
          var candidateObject = submissionCandidate.candidate.candidate;
          var recruiter = submissionsWithRecruiters[index].recruiter;
          var submissionObject = {
            name: candidateObject.name,
            email: candidateObject.email,
            nationality: candidateObject.nationality,
            location: candidateObject.location,
            city: candidateObject.city,
            jobTitle: candidateObject.jobTitle,
            employer: candidateObject.employer,
            cv: (candidateObject.cv) ? mediaUrl + candidateObject.cv.identifier : '',
            recruiterName: (recruiter) ?
              recruiter.name :
              '',
            recruiterEmail: (recruiter) ?
              recruiter.email :
              '',
            submissionDate: moment(submissionCandidate.submittedAt).format('DD/MM/YYYY HH:mm:ss'),
            status: submissionCandidate.status,
            comments: ''
          };

          if (submissionCandidate.review) {
            submissionObject.comments =
              candidateReviewReason.DISQUALIFY[submissionCandidate.review.reason];
            if (submissionCandidate.review.description) {
              submissionObject.comments += ': ' + submissionCandidate.review.description;
            }
          }

          var candidateArray = [];
          columnsArray.forEach(function (column) {
            candidateArray.push(submissionObject[column]);
          });

          try {
            stringifier.write(candidateArray);
          }
          catch (err) {
            console.error(err);
          }
        });
        stringifier.end();
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem downloading the candidates for this job-offer',
          error: err
        });
      });
  });

router.route('/preferences/recruiters')
  .get(function (req, res) {
    delete req.query.bewit;
    var searchDateFilterObject = {
      searchDateFrom: parseInt(req.query.searchDateFrom, 10),
      searchDateTo: parseInt(req.query.searchDateTo, 10)
    };

    Preference.find({ roles: 'recruiter' })
      .then(function(recruiters) {
        return RecruiterService.populateCVInfoPromise(
          recruiters, searchDateFilterObject, false);
      })
      .then(function(filteredRecruiters) {
        return RecruiterService.populateBountyInfoPromise(filteredRecruiters);
      })
      .then(function(filteredRecruiters) {
        var filename = 'recruiters_submitted_' +
          new Date(searchDateFilterObject.searchDateFrom).toLocaleDateString() +
          '_' +
          new Date(searchDateFilterObject.searchDateTo).toLocaleDateString() +
          '_' + moment().format('YYYYMMDDHHmmss');
        filename = filename.replace(/ /gi, '_');
        filename = filename.replace(/[^\w\s\-_]/gi, '');
        res.header('Content-Disposition', 'attachment; filename=' + filename + '.csv');
        res.header('Content-Type', 'text/csv; charset=utf-8');
        var columns = {
          name: 'Name',
          email: 'E-Mail',
          submittedCVCount: 'CVs Submitted',
          approvedCVCount: 'CVs Approved',
          totalBounty: 'Total Bounty'
        };
        var columnsArray = Object.keys(columns);

        var mediaUrl = MediaService.getUrl('CV') + '/';

        var stringifier = csv.stringify({header: true, columns: columns});

        var data;

        stringifier.on('readable', function () {
          while (data = stringifier.read()) {
            res.write(data);
          }
        });

        stringifier.on('end', function () {
          res.end();
        });

        filteredRecruiters.forEach(function (filteredRecruiter) {
          var recruiterObject = {
            name: filteredRecruiter.name,
            email: filteredRecruiter.email,
            submittedCVCount: filteredRecruiter.submittedCVCount,
            approvedCVCount: filteredRecruiter.approvedCVCount,
            totalBounty: filteredRecruiter.totalBounty
          };

          var recruiterValueArray = [];
          columnsArray.forEach(function (column) {
            recruiterValueArray.push(recruiterObject[column]);
          });

          try {
            stringifier.write(recruiterValueArray);
          }
          catch (err) {
            console.error(err);
          }
        });
        stringifier.end();
      })
      .catch(function(err) {
        return res.json({
          message: 'There was a problem while exporting recruiters',
          error: err
        });
      });
  });

module.exports = router;
