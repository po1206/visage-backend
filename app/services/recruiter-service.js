'use strict';

var db = require('../domain/db'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  merge = require('merge');

var JobOffer = require('../domain/job-offer');
var Preference = require('../domain/preference');
var RecruiterAssignment = require('../domain/recruiter-assignment');
var CandidateSubmission = require('../domain/candidate-submission');
var BountyHistory = require('../domain/bounty-history');

var loadRecruiters = function (recruitersAssignments) {
  return new Promise(function (resolve, reject) {

    var recruitersPlainObject = recruitersAssignments.map(function (assignment) {
      return assignment.toObject();
    });
    var idRecruiters = recruitersPlainObject.map(function (assignment) {
      return assignment.recruiter;
    });
    var assignmentsByRecruitersId = {};
    recruitersPlainObject.forEach(function (assignment) {
      assignmentsByRecruitersId[assignment.recruiter] = assignment;
    });
    Preference.find({_id: {$in: idRecruiters}})
      .then(function (recruiters) {
        recruiters.forEach(function (recruiter) {
          assignmentsByRecruitersId[recruiter._id].recruiter = recruiter;
        });
        resolve(recruitersPlainObject);
      })
      .catch(function (err) {
        reject(err);
      });
  });
};

var findCandidateSubmissionPromise = function (recruiter, params) {
  if (!params.searchDateFrom) {
    params.searchDateFrom = new Date('1970-1-1').getTime();
  }
  if (!params.searchDateTo) {
    params.searchDateTo = new Date().getTime();
  }
  return CandidateSubmission
    .find({
      recruiter: recruiter._id.toString()
    })
    .where('submittedAt')
    .gt(new Date(params.searchDateFrom))
    .lt(new Date(params.searchDateTo))
    .exec();
};

var getJobBountyPromise = function (recruiterIndex, jobId, submittedAt) {
  return BountyHistory
    .find({
      job: jobId
    })
    .exec()
    .then(function(bountyHistories) {
      var modifiedAt = new Date(0);
      var modifiedIndex = 0;
      for (var i = 0; i < bountyHistories.length; i ++) {
        if (bountyHistories[i].modifiedAt <= submittedAt &&
          bountyHistories[i].modifiedAt > modifiedAt) {
          modifiedAt = bountyHistories[i].modifiedAt;
          modifiedIndex = i;
        }
      }
      return {
        recruiterIndex: recruiterIndex,
        bounty: bountyHistories[modifiedIndex].amount
      };
    });
};

var RecruiterService = {
  getRecruiter: function (recruiterId) {
    return db.model('Preferences').findOne({_id: recruiterId});
  },
  getRecruiterAssignment: function (assignmentId) {
    return RecruiterAssignment.findOne({
      _id: assignmentId
    });
  },
  getValidatedRecruiters: function () {
    return Preference.find({
      roles: 'recruiter',
      'recruiter.validated': true
    });
  },
  getRecruitersByJob: function (jobId, params) {
    return RecruiterService.getAssignmentsByJob(jobId, params)
      .then(function (assignments) {
        var recruitersId = assignments.map(function (assignment) {
          return assignment.recruiter;
        });
        return Preference.find({_id: {$in: recruitersId}});
      });
  },
  getAssignmentsByJob: function (jobId, params) {
    params = merge({job: jobId}, params);
    return RecruiterAssignment.find(params)
      .then(loadRecruiters);
  },
  putAssignment: function (assignmentId, newAssignment) {

    var tempJob = merge({},newAssignment.job), tempRecruiter = merge({},newAssignment.recruiter);
    //You can't update the job or the recruiter assignment
    delete newAssignment.job;
    delete newAssignment.recruiter;

    return RecruiterService.getRecruiterAssignment(assignmentId)
      .then(function (recruiterAssignment) {
        recruiterAssignment = merge(recruiterAssignment, newAssignment);
        return recruiterAssignment.save();
      })
      .then(function (recruiterAssignment) {
        var recruiterAssignmentObject = recruiterAssignment.toObject();
        recruiterAssignmentObject.job = tempJob;
        recruiterAssignmentObject.recruiter = tempRecruiter;
        return Promise.resolve(recruiterAssignmentObject);
      });
  },
  addAssignment: function (submission, jobOffer, userId) {
    var assignmentAdded = RecruiterAssignment.create({
      recruiter: userId,
      job: jobOffer._id
    });
    return assignmentAdded.then(function (recruiterAssignment) {
      if (!jobOffer.assignments) {
        jobOffer.assignments = [];
      }
      jobOffer.assignments.push(recruiterAssignment._id);
      return Promise.all([assignmentAdded, jobOffer.save()]);
    });
  },
  getAssignment: function (assignId) {
    return RecruiterAssignment.findOne({
      _id: assignId
    });
  },
  deleteAssignment: function (assignId) {
    return RecruiterAssignment.findOneAndRemove({
      _id: assignId
    });
  },
  removeAssignment: function (jobId, assignment) {
    return JobOffer.findOne({_id: jobId})
      .then(function (jobOffer) {
        jobOffer.assignments = jobOffer.assignments.filter(function (assignmentId) {
          return (assignmentId !== assignment._id);
        });
        return jobOffer.save();
      });
  },
  retrieveRecruiters: function (candidateSubmissions) {
    return new Promise(function (resolve, reject) {

      var submissionsPlainObject = candidateSubmissions.map(function (submission) {
        return submission.toObject();
      });
      var idRecruiters = submissionsPlainObject
        .filter(function (submission) {
          return !!submission.recruiter;
        })
        .map(function (submission) {
        return submission.recruiter;
      });
      var submissionsByRecruiterId = {};
      submissionsPlainObject.forEach(function (submission) {
        if(!submissionsByRecruiterId[submission.recruiter]) {
          submissionsByRecruiterId[submission.recruiter] = [];
        }
        submissionsByRecruiterId[submission.recruiter].push(submission);
      });
      Preference.find({_id: {$in: idRecruiters}})
        .then(function (recruiters) {
          recruiters.forEach(function (recruiter) {
            submissionsByRecruiterId[recruiter._id].forEach(function (submissionByRecruiter) {
              submissionByRecruiter.recruiter = recruiter;
            });
          });
          resolve(submissionsPlainObject);
        })
        .catch(function (err) {
          reject(err);
        });
    });
  },
  populateCVInfoPromise: function(recruiters, searchDateFilterObject, filterOnly) {
    var filterApprovedSubmissionsCallback = function(submissionIterator) {
      var approvedHistory = _.find(submissionIterator.history, {'status':'Approved'});
      return (approvedHistory &&
      approvedHistory.at >= new Date(searchDateFilterObject.searchDateFrom) &&
      approvedHistory.at <= new Date(searchDateFilterObject.searchDateTo));
    };
    var candidateSubmissionPromises = [];

    _.forEach(recruiters, function(recruiterIterator) {
      candidateSubmissionPromises.push(
        findCandidateSubmissionPromise(recruiterIterator, searchDateFilterObject));
    });

    return Promise.all(candidateSubmissionPromises)
      .then(function(candidateSubmissionResults) {
        for (var i = candidateSubmissionResults.length - 1; i >= 0; i --) {
          if (!candidateSubmissionResults[i] || candidateSubmissionResults[i].length === 0) {
            recruiters.splice(i, 1);
          } else if (!filterOnly) {
            recruiters[i] = recruiters[i].toObject();
            recruiters[i].submittedCVCount = candidateSubmissionResults[i].length;
            var approvedCandidateSubmissions = _.filter(
              candidateSubmissionResults[i], filterApprovedSubmissionsCallback);
            recruiters[i].approvedCVCount = approvedCandidateSubmissions.length;
            recruiters[i].approvedCandidateSubmissions = approvedCandidateSubmissions;
          }
        }
        return recruiters;
      });
  },
  populateBountyInfoPromise: function(recruiters) {
    var jobBountyPromises = [];
    var recruiter = null;
    var approvedCandidateSubmission = null;

    for (var i = 0; i < recruiters.length; i++) {
      recruiter = recruiters[i];
      recruiter.totalBounty = 0;
      for (var j = 0; j < recruiter.approvedCandidateSubmissions.length; j++) {
        approvedCandidateSubmission = recruiter.approvedCandidateSubmissions[j];
        jobBountyPromises.push(getJobBountyPromise(i,
          approvedCandidateSubmission.job,
          approvedCandidateSubmission.submittedAt));
      }
    }

    return Promise.all(jobBountyPromises).then(function (bountyResults) {
      for (var k = 0; k < bountyResults.length; k++) {
        recruiters[bountyResults[k].recruiterIndex].totalBounty +=
          bountyResults[k].bounty;
      }

      return recruiters;
    });
  }
};

module.exports = RecruiterService;