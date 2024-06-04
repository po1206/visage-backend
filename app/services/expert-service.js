'use strict';

var Promise = require('promise'),
  merge = require('merge');

var Preference = require('../domain/preference'),
  ExpertAssignment= require('../domain/expert-assignment'),
  JobOffer = require('../domain/job-offer');

var loadExperts = function (expertsAssignments) {
  return new Promise(function (resolve, reject) {

    var expertsPlainObject = expertsAssignments.map(function (assignment) {
      return assignment.toObject();
    });
    var idExperts = expertsPlainObject.map(function (assignment) {
      return assignment.expert;
    });
    var assignmentsByExpertsId = {};
    expertsPlainObject.forEach(function (assignment) {
      assignmentsByExpertsId[assignment.expert] = assignment;
    });
    Preference.find({_id: {$in: idExperts}})
      .then(function (experts) {
        experts.forEach(function (expert) {
          assignmentsByExpertsId[expert._id].expert = expert;
        });
        resolve(expertsPlainObject);
      })
      .catch(function (err) {
        reject(err);
      });
  });
};

var ExpertService = {
  getExpertsByJob: function (jobId, params) {
    return ExpertService.getAssignmentsByJob(jobId, params)
      .then(function (assignments) {
        return assignments.map(function (assignment) {
          return assignment.expert;
        });
      });
  },
  getAssignmentsByJob: function (jobId, params) {
    params = merge({job: jobId}, params);
    return ExpertAssignment.find(params)
      .then(loadExperts);
  },
  putAssignment: function (assignmentId, oldJobOffer, newAssignment) {
    var assignmentFound = ExpertAssignment.findOne({
      _id: assignmentId
    });
    var newJobOffer = JobOffer.findOne({
      _id: newAssignment.job
    });
    var updatedAssignment = assignmentFound
      .then(function (expertAssignment) {
        expertAssignment = merge(expertAssignment, newAssignment);
        return [expertAssignment.save()];
      });
    return updatedAssignment.then(function (expertAssignment) {
      var indexDeletion = oldJobOffer.expertsAssignments.indexOf(expertAssignment._id);
      if (indexDeletion !== -1) {
        oldJobOffer.expertsAssignments.splice(indexDeletion, 1);
      }

      if (!newJobOffer.expertsAssignments) {
        newJobOffer.expertsAssignments = [];
      }
      if (newJobOffer.expertsAssignments.indexOf(expertAssignment._id) === -1) {
        newJobOffer.expertsAssignments.push(expertAssignment._id);
      }

      return Promise.all([updatedAssignment, oldJobOffer.save(), newJobOffer.save()]);
    });
  },
  addAssignment: function (submission, jobOffer, userId) {
    var assignmentAdded = ExpertAssignment.create({
      expert: userId,
      job: jobOffer._id
    });
    return assignmentAdded.then(function (expertAssignment) {
      if (!jobOffer.expertsAssignments) {
        jobOffer.expertsAssignments = [];
      }
      jobOffer.expertsAssignments.push(expertAssignment._id);
      return Promise.all([assignmentAdded, jobOffer.save()]);
    });
  },
  getAssignment: function (assignId) {
    return ExpertAssignment.findOne({
      _id: assignId
    });
  },
  deleteAssignment: function (assignId) {
    return ExpertAssignment.findOneAndRemove({
      _id: assignId
    });
  },
  removeAssignment: function (jobId, assignment) {
    return JobOffer.findOne({_id: jobId})
      .then(function (jobOffer) {
        jobOffer.expertsAssignments = jobOffer.expertsAssignments.filter(function (assignmentId) {
          return (assignmentId !== assignment._id);
        });
        return jobOffer.save();
      });
  },
  deleteAllAssignments: function (jobId) {
    return ExpertAssignment.find({
      job: jobId
    }).remove();
  },
  removeAllAssignments: function (jobId) {
    return JobOffer.findOne({_id: jobId})
      .then(function (jobOffer) {
        jobOffer.expertsAssignments = [];
        return jobOffer.save();
      });
  }
};

module.exports = ExpertService;