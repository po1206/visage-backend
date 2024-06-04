'use strict';

var express = require('express'),
  router = express.Router(),
  Promise = require('promise'),
  MailDispatcher = require('../services/mail-dispatcher'),
  PermissionsChecker = require('../services/permissions-checker'),
  merge = require('merge'),
  diff = require('deep-diff').diff;

var hawk = require('hawk');

var ErrorVisage = require('../constants/error');
var common = require('../common');

var RecruiterService = require('../services/recruiter-service');
var ExpertService = require('../services/expert-service');
var JobOfferService = require('../services/job-offer-service');
var CandidateService = require('../services/candidate-service');

var Candidate = require('../domain/candidate'),
  CandidateSubmission = require('../domain/candidate-submission');
var JobOffer = require('../domain/job-offer');

//Check if prod or DEV
var nodeEnv = process.env.NODE_ENV || 'development';

var credentials = {
  id: 'fewjud839jeDu',
  key: common.config.secretKeyFileDownload,
  algorithm: 'sha256'
};

var addJobOffer = function (req) {

  return new Promise(function (resolve, reject) {

    var jobPost = merge({}, req.body);

    if (!jobPost.source && req.get('Origin')) {
      jobPost.source = req.get('Origin');
    }

    if (!jobPost.submitted && jobPost.status === 'Approved') {
      jobPost.submitted = Date.now();
    }

    if (!jobPost.draftCreatedAt && jobPost.status === 'Draft') {
      jobPost.draftCreatedAt = Date.now();
    }

    JobOffer.create(jobPost, function (err, jobOffer) {
      if (err) {
        reject(err);
      }
      else {
        //Blob has been created
        resolve(jobOffer);
      }
    });
  });

};

//TODO Implement a real messaging QUEUE with REDIS
var successJobPosting = function (req, res, jobs, next) {
  res.json({
    status: 'success',
    posted: jobs
  });
  return next();
};

var errJobPosting = function (res, err) {
  res.statusCode = 500;
  console.log(err);
  return res.json({
    message: 'There was a problem adding the information to the database.',
    error: err
  });
};

//build the REST operations at the base for blobs
//this will be accessible from http://127.0.0.1:3000/job-offers if the default route for / is left
// unchanged
router.route('/')
  //GET all blobs
  .get(function (req, res, next) {
    //TODO reactive security if needed (could be good to let the jobs open by default
    //if (!req.user.app_metadata || !req.user.app_metadata.roles ||
    // (req.user.app_metadata.roles && req.user.app_metadata.roles.indexOf('admin') === -1))
    // return res.sendStatus(401); retrieve all blobs from Mongo
    var params;
    if (req.query) {
      if (req.query.paid !== undefined) {
        if (req.query.paid === '') {
          params = {paid: {$exists: false}};
        }
        delete req.query.paid;
      }
      params = merge(params, req.query);
    }
    JobOffer.find(params, function (err, jobOffers) {
      if (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding the job offer',
          error: err
        });
      }
      //respond to both HTML and JSON. JSON responses require 'Accept: application/json;' in
      // the Request Header
      res.body = jobOffers;
      return next();
    }).sort({submitted: -1});
  })

  //POST a new blob
  .post(function (req, res, next) {
    // Get values from POST request. These can be done through forms or REST calls. These rely
    // on the 'name' attributes for forms
    if (req.body) {
      if (Array.isArray(req.body)) {
        var postedJobs = [];
        req.body.forEach(function (jobOffer) {
          addJobOffer(req, jobOffer).then(function (jobOffer) {
            postedJobs.push(jobOffer);
            if (req.body.length === postedJobs.length) {
              successJobPosting(req, res, postedJobs, next);
            }
          }, function (err) {
            errJobPosting(res, err);
          });
        });
      }
      else {
        addJobOffer(req, req.body).then(function (jobOffer) {
          successJobPosting(req, res, [jobOffer], next);
        }, function (err) {
          errJobPosting(res, err);
        });
      }
    }
  });

var registerRequirementsDiff = function (oldJobOffer, newJobOffer) {
  var diffs = diff(oldJobOffer.requirements, newJobOffer.requirements);
  if (diffs && diffs.length > 0) {
    newJobOffer.requirementsUpdates.push({
      updatedAt: new Date(),
      diffs: diffs
    });

  }
};

var putJobOffer = function (req, res, next) {
  var jobId = req.params.jobOfferId;
  //retrieve all blobs from Monogo
  JobOffer.findOne({_id: jobId})
    .then(function (jobOffer) {
      //FIXME Ugly as fuck...

      var newJob = false;
      if (!jobOffer.launched && req.body.launched === true) {
        req.body.launchedAt = new Date();
      }
      if (!jobOffer.submitted && req.body.status === 'Approved') {
        newJob = true;
        jobOffer.submitted = Date.now();
      }
      if (req.body.shortlisted) {
        delete req.body.shortlisted;
      }
      if (req.body.submissions) {
        delete req.body.submissions;
      }
      //END FIXME
      registerRequirementsDiff(jobOffer.toObject(), req.body);
      jobOffer = merge(jobOffer, req.body);

      return jobOffer.save()
        .then(function (jobOffer) {
          if(newJob) {
            MailDispatcher.notifyNewJobs(req.user.sub, [jobOffer]);
          }
          res.json(jobOffer);
          return next();
        })
        .catch(function (err) {
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem saving the job offer',
            error: err
          });
        });
    })
    .catch(function (err) {
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem finding the job offer',
        error: err
      });
    });
};

var deleteJobOffer = function (req, res, next) {
  var jobId = req.params.jobOfferId;
  //retrieve all blobs from Monogo
  JobOffer.findOne({_id: jobId}, function (err, jobOffer) {
    jobOffer.remove({
      _id: req.params.jobOfferId
    }, function (err) {
      if (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem deleting the job offer',
          error: err
        });
      }
      res.json({message: 'Job offer deleted'});
      return next();
    });
  });
};

router.route('/active')
  .get(function (req, res, next) {
    JobOfferService.retrieveActiveJobs(req.query)
      .then(function (jobOffers) {
        res.body = jobOffers;
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

router.route('/inactive')
  .get(function (req, res, next) {
    JobOfferService.retrieveInactiveJobs()
      .then(function (jobOffers) {
        res.body = jobOffers;
        return next();
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding inactive job offers',
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
    //retrieve all blobs from Monogo
    JobOffer.findOne({_id: jobId}, function (err, jobOffer) {
      if (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding the job offer',
          error: err
        });
      }
      res.body = jobOffer.toObject();
      return next();
    });
  })
  .post(function (req, res, next) {
    if (req.body._method && req.body._method === 'PUT') {
      putJobOffer(req, res, next);
    }
    else if (req.body._method && req.body._method === 'DELETE') {
      deleteJobOffer(req, res, next);
    }
    else {

    }
  })
  .put(function (req, res, next) {
    putJobOffer(req, res, next);
  })
  .delete(function (req, res, next) {
    deleteJobOffer(req, res, next);

  });

var deleteCandidate = function (submission) {
  return Candidate.findOneAndRemove({_id: submission.candidate});
};

var updateCandidate = function (updatedCandidate) {
  return Candidate.findOne({_id: updatedCandidate._id})
    .then(function (user) {
      user = merge(user, updatedCandidate);
      return user.save();
    });
};

var putSubmission = function (submission, jobOffer, user) {
  var updatedSubmission = CandidateSubmission.findOne({
      job: jobOffer._id,
      candidate: user._id
    })
    .then(function (candidateSubmission) {
      var oldStatus = candidateSubmission.status;
      merge(candidateSubmission, submission);
      if (candidateSubmission.status !== oldStatus) {
        var updatedTime = Date.now();
        candidateSubmission.history.push({
          'status': submission.status,
          'at': updatedTime
        });
        candidateSubmission.at = updatedTime;
      }
      return candidateSubmission.save();
    });
  return updatedSubmission.then(function (candidateSubmission) {
    if (!user.candidate.applications) {
      user.candidate.applications = [];
    }
    if (!jobOffer.submissions) {
      jobOffer.submissions = [];
    }
    if (jobOffer.submissions.indexOf(candidateSubmission._id) === -1) {
      jobOffer.submissions.push(candidateSubmission._id);
    }
    if (user.candidate.applications.indexOf(candidateSubmission._id) === -1) {
      user.candidate.applications.push(candidateSubmission._id);
    }
    return Promise.all([updatedSubmission, user.save(), jobOffer.save()]);
  });
};

var deleteSubmission = function (subId) {
  return CandidateSubmission.findOneAndRemove({
    _id: subId
  });
};

var removeApplication = function (subId, jobId) {
  return JobOffer.findOne({_id: jobId})
    .then(function (jobOffer) {
      jobOffer.submissions = jobOffer.submissions.filter(function (submissionId) {
        return (submissionId !== subId);
      });
      return jobOffer.save();
    });
};

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
      } else if (err.type && err.type === 'emailValidationError') {
        err = {
          code: ErrorVisage.Code.CANDIDATE_EMAIL_VALIDATION_FAIL,
          message: ErrorVisage.Message.CANDIDATE_EMAIL_VALIDATION_FAIL,
          description: err.error
        };
      }
      console.error(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem adding candidates for this job-offer',
        error: err
      });
    });
};

var deleteCandidateSubmission = function (req, res) {
  var jobId = req.params.jobOfferId;
  var subId = req.params.submissionId;

  //retrieve all blobs from Monogo

  //TODO Replace that with getting the candidate instead of creating it at the same time.
  Promise.all([deleteSubmission(subId), removeApplication(subId, jobId)]).then(function (results) {
      var submission = results[0];
      return deleteCandidate(submission)
        .then(function () {
          return res.json(submission);
        });
    })
    .catch(function (err) {
      console.log(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem deleting candidate for this job-offer',
        error: err
      });

    });
};

var putCandidateSubmission = function (req, res) {
  var jobId = req.params.jobOfferId;
  var subId = req.params.submissionId;

  var calls = [JobOfferService.getJob(jobId)];

  if (typeof req.body.candidate !== 'string') {
    calls.push(updateCandidate(req.body.candidate));
  }
  else {
    calls.push(CandidateService.getCandidate(req.body.candidate));
  }
  Promise.all(calls)
    .then(function (results) {
      var jobOffer = results[0];
      var candidate = results[1];

      return putSubmission(req.body, jobOffer, candidate)
        .then(function (result) {
          var submission = result[0].toObject();
          submission.candidate = result[1];
          return res.json(submission);
        });
    })
    .catch(function (err) {
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem adding candidates for this job-offer',
        error: err
      });

    });
};

var addRecruiterAssignment = function (req, res) {
  var jobId = req.params.jobOfferId;
  //retrieve all blobs from Mongo

  JobOfferService.getJob(jobId)
    .then(function (jobOffer) {
      return RecruiterService.addAssignment(req.body, jobOffer, req.body.recruiter)
        .then(function (result) {
          var assignment = result[0].toObject();
          return res.json(assignment);
        });
    })
    .catch(function (err) {
      console.log(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem adding candidates for this job-offer',
        error: err
      });

    });
};

var deleteAllExpertAssignment = function (req, res) {
  var jobId = req.params.jobOfferId;

  //retrieve all blobs from Monogo
  Promise.all([ExpertService.deleteAllAssignments(jobId),
      ExpertService.removeAllAssignments(jobId)])
    .then(function (results) {
      return res.json(results[1]);
    })
    .catch(function (err) {
      console.log(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem deleting recruiter for this job-offer',
        error: err
      });
    });
};

var deleteRecruiterAssignment = function (req, res) {
  var jobId = req.params.jobOfferId;
  var assignId = req.params.assignmentId;

  //retrieve all blobs from Monogo

  RecruiterService.deleteAssignment(assignId).then(function (assignment) {
      return RecruiterService.removeAssignment(jobId, assignment)
        .then(function () {
          return res.json(assignment);
        });
    })
    .catch(function (err) {
      console.log(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem deleting recruiter for this job-offer',
        error: err
      });
    });
};

var updateRecruiterAssignment = function (req, res) {
  var assignmentId = req.params.assignmentId;

  RecruiterService.putAssignment(assignmentId, req.body)
    .then(function (assignment) {
      return res.json(assignment);
    })
    .catch(function (err) {
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem updating the assignment for this job-offer',
        error: err
      });

    });
};

var addExpertAssignment = function (req, res) {
  var jobId = req.params.jobOfferId;
  //retrieve all blobs from Mongo

  JobOfferService.getJob(jobId)
    .then(function (jobOffer) {
      return ExpertService.addAssignment(req.body, jobOffer, req.body.expert)
        .then(function (result) {
          var assignment = result[0].toObject();
          return res.json(assignment);
        });
    })
    .catch(function (err) {
      console.log(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem adding candidates for this job-offer',
        error: err
      });

    });
};

var deleteExpertAssignment = function (req, res) {
  var jobId = req.params.jobOfferId;
  var assignId = req.params.assignmentId;

  //retrieve all blobs from Monogo

  RecruiterService.deleteAssignment(assignId).then(function (assignment) {
      return RecruiterService.removeAssignment(jobId, assignment)
        .then(function () {
          return res.json(assignment);
        });
    })
    .catch(function (err) {
      console.log(err);
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem deleting recruiter for this job-offer',
        error: err
      });
    });
};

var updateExpertAssignment = function (req, res) {
  var jobId = req.params.jobOfferId;
  var assignmentId = req.params.assignmentId;

  JobOfferService.getJob(jobId).then(function (jobOffer) {
      return RecruiterService.putAssignment(assignmentId, jobOffer)
        .then(function (result) {
          var assignment = result[0].toObject();
          var newJobOffer = result[2];
          assignment.job = newJobOffer;
          return res.json(assignment);
        });
    })
    .catch(function (err) {
      res.statusCode = 500;
      return res.json({
        message: 'There was a problem adding recruiter for this job-offer',
        error: err
      });

    });
};

router.route('/:jobOfferId/candidates/count')
  .get(function (req, res) {
    var jobId = req.params.jobOfferId;

    //retrieve all blobs from Monogo
    CandidateService.retrieveSubmissions(jobId, req.query, req.user).count()
      .then(function (count) {
        //console.log('count', count);
        return res.json({
          params: req.params,
          query: req.query,
          count: count
        });
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding the candidates for this job-offer',
          error: err
        });
      });
  });

router.route('/:jobOfferId/candidates/signing')
  .get(function (req, res) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //FIXME Workaround because I did not setup secured protocol between ELB and instances on AWS...
    var protocol = (nodeEnv === 'production') ? 'https' : req.protocol;
    var url = protocol +
      '://' +
      req.get('host') +
      '/reports';

    if (permissionsChecker.isAdmin()) {
      url += req.originalUrl.replace('/signing', '/master');
    }
    else {
      url += req.originalUrl.replace('/signing', '');
    }

    var bewit = hawk.uri.getBewit(url, {
      credentials: credentials,
      ttlSec: 60 * 5
    });
    return res.json({
      signedUrl: (url.indexOf('?status') === -1) ? url + '?bewit=' + bewit : url + '&bewit=' + bewit
    });
  });

router.route('/:jobOfferId/candidates/')
  .get(function (req, res) {
    var jobId = req.params.jobOfferId;
    //retrieve all blobs from Monogo
    CandidateService.retrieveSubmissions(jobId, req.query, req.user)
      .then(CandidateService.retrieveCandidates)
      .then(function (candidatesSubmissions) {
        return res.json(candidatesSubmissions);
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding the candidates for this job-offer',
          error: err
        });
      });
  })
  .post(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.body.recruiter)) {
      return res.sendStatus(401);
    }
    if (req.body._method && req.body._method === 'PUT') {
      putCandidateSubmission(req, res, next);
    }
    else if (req.body._method && req.body._method === 'DELETE') {
      deleteCandidateSubmission(req, res, next);
    }
    else {
      addCandidateSubmission(req, res, next);
    }
  });

router.route('/:jobOfferId/candidates/:submissionId')
  .put(function (req, res, next) {
    putCandidateSubmission(req, res, next);
  })
  .delete(function (req, res, next) {
    deleteCandidateSubmission(req, res, next);
  });

router.route('/:jobOfferId/recruiters/')
  .get(function (req, res) {
    var jobId = req.params.jobOfferId;
    var params = req.query;
    //retrieve all blobs from Monogo
    RecruiterService.getAssignmentsByJob(jobId, params)
      .then(function (recruiters) {
        return res.json(recruiters);
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding recruiters for this job-offer',
          error: err
        });
      });
  })
  .post(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.body.recruiter)) {
      return res.sendStatus(401);
    }
    if (req.body._method && req.body._method === 'PUT') {
      updateRecruiterAssignment(req, res, next);
    }
    else if (req.body._method && req.body._method === 'DELETE') {
      deleteRecruiterAssignment(req, res, next);
    }
    else {
      addRecruiterAssignment(req, res, next);
    }
  });

router.route('/:jobOfferId/experts/')
  .get(function (req, res) {
    var jobId = req.params.jobOfferId;
    var params = req.query;
    //retrieve all blobs from Monogo
    ExpertService.getAssignmentsByJob(jobId, params)
      .then(function (experts) {
        return res.json(experts);
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding experts for this job-offer',
          error: err
        });
      });
  })
  .post(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    if (!permissionsChecker.isAdmin() && !permissionsChecker.isOwner(req.body.expert)) {
      return res.sendStatus(401);
    }
    if (req.body._method && req.body._method === 'PUT') {
      updateExpertAssignment(req, res, next);
    }
    else if (req.body._method && req.body._method === 'DELETE') {
      deleteExpertAssignment(req, res, next);
    }
    else {
      addExpertAssignment(req, res, next);
    }
  })
  .delete(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }
    deleteAllExpertAssignment(req, res, next);
  });

router.route('/:jobOfferId/recruiters/:assignmentId')
  .put(function (req, res, next) {
    updateRecruiterAssignment(req, res, next);
  })
  .delete(function (req, res, next) {
    deleteRecruiterAssignment(req, res, next);
  })
  .get(function (req, res) {
    var assignId = req.params.assignmentId;
    RecruiterService.getAssignment(assignId)
      .then(function (recruiterAssignment) {
        return res.json(recruiterAssignment);
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem finding the recruiter for this job-offer',
          error: err
        });
      });
  });

module.exports = router;