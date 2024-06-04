'use strict';

var Promise = require('promise');
var _ = require('lodash');

var Candidate = require('../domain/candidate'),
  CandidateSubmission = require('../domain/candidate-submission');
var ErrorVisage = require('../constants/error');

var ObjectId = require('mongoose').Types.ObjectId;
var FullContactService = require('./full-contact-service');
var EmailVerifierService = require('./email-verifier-service');

var CandidateService = {
  getCandidate: function (id) {
    return Candidate.findOne({_id: id});
  },
  checkEmailValidity: function (jobOffer, user) {
    if (user.candidate.email) {
      var candidateEmailHash = user.candidate.email + jobOffer._id;
      return CandidateSubmission.find({'candidateEmailHash': candidateEmailHash})
        .then(function (candidateSubmissions) {
          if (candidateSubmissions && candidateSubmissions.length > 0) {
            throw {
              code: ErrorVisage.Code.EXISTING_CANDIDATE,
              message: ErrorVisage.Message.EXISTING_CANDIDATE
            };
          }
        });
    }
    else {
      return Promise.reject({
        code: ErrorVisage.Code.MISSING_PARAMETER,
        message: ErrorVisage.Message.MISSING_PARAMETER
      });
    }
  },
  checkCVValidity: function (jobId, cvMd5) {
    if (jobId && cvMd5) {
      var candidateCVmd5Hash = cvMd5 + jobId;
      return CandidateSubmission.find({'candidateCVmd5Hash': candidateCVmd5Hash})
        .then(function (candidateSubmissions) {
          if (candidateSubmissions && candidateSubmissions.length > 0) {
            return Promise.reject({
              code: ErrorVisage.Code.EXISTING_CANDIDATE,
              message: ErrorVisage.Message.EXISTING_CANDIDATE
            });
          }
        });
    }
    else {
      return Promise.reject({
        code: ErrorVisage.Code.MISSING_PARAMETER,
        message: ErrorVisage.Message.MISSING_PARAMETER
      });
    }
  },
  addCandidate: function (candidate) {
    var user = candidate;
    user.roles = ['candidate'];
    var composedErr = {
      type: 'emailValidationError',
    };

    var emailVerifierPromise = new Promise(function (resolve, reject) {
      EmailVerifierService.checkCandidateEmailValidity(candidate.candidate.email)
        .then(function (emailValidation) {
          if (emailValidation.error || emailValidation.status === 'failed') {
            composedErr.error = emailValidation.error || emailValidation.details;
            reject(composedErr);
          } else {
            resolve(emailValidation);
          }
        }).catch(function (err) {
          composedErr.error = err.error;
          reject(composedErr);
        });
    });

    // This promise is always resolved because we should submit candidate info
    // even when fullcontact service api returns error.
    var fullContactPromise = new Promise(function (resolve) {
      FullContactService.getCandidateFullContact(candidate.candidate.email)
        .then(function (fullContactInfo) {
          resolve(fullContactInfo);
        }).catch(function () {
          resolve(null);
        });
    });

    return Promise.all([emailVerifierPromise, fullContactPromise]).then(function (promisesResult) {
      var fullContactInfo = promisesResult[1];
      var socialProfiles = null;
      var socialPhotoUrl = null;
      if (fullContactInfo && fullContactInfo.status === 200) {
        socialProfiles = fullContactInfo.socialProfiles;
        if (fullContactInfo.photos && fullContactInfo.photos.length > 0) {
          var linkedinPhoto = _.find(fullContactInfo.photos, {type: 'linkedin'});
          if (linkedinPhoto) {
            socialPhotoUrl = linkedinPhoto.url;
          } else {
            socialPhotoUrl = fullContactInfo.photos[0].url;
          }
        }
      }
      user.candidate.socialProfiles = socialProfiles;
      user.candidate.socialPhotoUrl = socialPhotoUrl;
      return Candidate.create(user);
    });
  },
  addSubmission: function (submission, jobOffer, user) {
    if (jobOffer.submissions && jobOffer.submissions.length >= jobOffer.maxSourced) {
      throw {
        message: ErrorVisage.Message.MAX_SUBMISSION,
        code: ErrorVisage.Code.MAX_SUBMISSION
      };
    }

    var candidateSub = {
      job: jobOffer._id,
      candidate: user._id,
      //cache email and cv md5 to quickly check uniqueness
      candidateEmail: user.candidate.email,
      recruiter: submission.recruiter,
      status: submission.status,
      at: Date.now(),
      history: [
        {
          status: submission.status,
          at: Date.now()
        }]
    };
    //Add a submittedAt date when candidate applied or has been sourced
    if (submission.status === 'Sourced' || submission.status === 'Applied') {
      candidateSub.submittedAt = candidateSub.at;
    }

    //FIXME Since we still submit shortlist manually, don't check for email uniqueness
    if (user.candidate.email && submission.status !== 'Shortlisted') {
      candidateSub.candidateEmailHash = user.candidate.email + jobOffer._id;
    }

    if (user.candidate.cv && user.candidate.cv.md5) {
      candidateSub.candidateCVmd5 = user.candidate.cv.md5;
      candidateSub.candidateCVmd5Hash = user.candidate.cv.md5 + jobOffer._id;
    }

    var submissionAdded = CandidateSubmission.create(candidateSub);
    return submissionAdded.then(function (candidateSubmission) {
      if (!user.candidate.applications) {
        user.candidate.applications = [];
      }
      if (!jobOffer.submissions) {
        jobOffer.submissions = [];
      }
      jobOffer.submissions.push(candidateSubmission._id);
      user.candidate.applications.push(candidateSubmission._id);
      return Promise.all([submissionAdded, user.save(), jobOffer.save()]);
    });
  },
  getSubmissionsStatus: function (params) {
    var aggregateObject = [{
      $group: {
        _id: {
          job: '$job',
          status : '$status'
        },
        count : { $sum : 1}
      }
    }];

    if(params.jobs || params.recruiter) {
      var matchObject = { $match : { $and : []} };
      if(params.recruiter) {
        matchObject.$match.$and.push({recruiter : params.recruiter});
      }
      if(params.jobs) {
        var jobsObjectIds = params.jobs.map(function(jobId) {
          return new ObjectId(jobId);
        });
        matchObject.$match.$and.push({job : { $in : jobsObjectIds}});
      }
      aggregateObject.unshift(matchObject);
    }
    return CandidateSubmission.aggregate(aggregateObject);
  },
  retrieveSubmissions: function (jobId, params, user) {
    var limit = null;
    if (params.limit) {
      limit = parseInt(params.limit, 10);
      delete params.limit;
    }
    if (user.roles.indexOf('admin') === -1) {
      if (user.preferences.roles.indexOf('expert') === -1 &&
        user.preferences.roles.indexOf('employer') === -1) {
        params.recruiter = user.encodedAuthUser;
      }
    }
    params.job = jobId;
    if (Array.isArray(params.status)) {
      params.status = {$in: params.status};
    }
    return CandidateSubmission.find(params).sort({submittedAt: -1}).limit(limit);
  },
  retrieveCandidates: function (candidateSubmissions) {
    return new Promise(function (resolve, reject) {

      var submissionsPlainObject = candidateSubmissions.map(function (submission) {
        return submission.toObject();
      });
      var idCandidates = submissionsPlainObject.map(function (submission) {
        return submission.candidate;
      });
      var submissionsByCandidatesId = {};
      submissionsPlainObject.forEach(function (submission) {
        submissionsByCandidatesId[submission.candidate] = submission;
      });
      Candidate.find({_id: {$in: idCandidates}})
        .then(function (candidates) {
          candidates.forEach(function (candidate) {
            submissionsByCandidatesId[candidate._id].candidate = candidate;
          });
          resolve(submissionsPlainObject);
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }
};

module.exports = CandidateService;