'use strict';

var Promise = require('promise'),
  merge = require('merge');

var JobOffer = require('../domain/job-offer');
var RecruiterAssignment = require('../domain/recruiter-assignment');
var ExpertAssignment = require('../domain/expert-assignment');

var loadJobs = function (recruitersAssignments) {
  return new Promise(function (resolve, reject) {

    var assignmentsPlainObject = recruitersAssignments.map(function (assignment) {
      return assignment.toObject();
    });
    var idJobOffers = assignmentsPlainObject.map(function (assignment) {
      return assignment.job;
    });
    var assignmentsByJobId = {};
    assignmentsPlainObject.forEach(function (assignment) {
      assignmentsByJobId[assignment.job] = assignment;
    });
    JobOffer.find({_id: {$in: idJobOffers}})
      .then(function (jobs) {
        jobs.forEach(function (job) {
          assignmentsByJobId[job._id].job = job;
        });
        resolve(assignmentsPlainObject);
      })
      .catch(function (err) {
        reject(err);
      });
  });
};

var JobOfferService = {
  getJob : function (id) {
    return JobOffer.findOne({_id: id});
  },
  retrieveActiveJobs: function (params) {
    var baseParams = {
      $and: [{status: {$ne: 'Closed'}},
        {$or: [{launched: {$exists: false}}, {launched: {$ne: false}}]}]
    };
    if (params) {
      baseParams.$and.push(params);
    }
    return JobOffer.find(baseParams);
  },
  retrieveInactiveJobs: function (params) {
    var baseParams = {$or: [{status: 'Closed'}, {launched: false}]};
    if (params) {
      var and = [params, merge({}, baseParams)];
      baseParams = {
        $and: and
      };
    }
    return JobOffer.find(baseParams);
  },
  getAssignmentsByExpert: function (expertId, params) {
    params = merge({expert: expertId}, params);
    return ExpertAssignment.find(params)
      .then(loadJobs);
  },
  getAssignmentsByRecruiter: function (recruiterId, params) {
    params = merge({recruiter: recruiterId}, params);
    return RecruiterAssignment.find(params)
      .then(loadJobs);
  }
};

module.exports = JobOfferService;