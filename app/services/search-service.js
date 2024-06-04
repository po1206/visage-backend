'use strict';

var Promise = require('promise');

var JobOffer = require('../domain/job-offer');
var Preference = require('../domain/preference');

var globalSearchQuery = function (queryString, hydrate) {

  var jobsRetrieved = false, preferencesRetrieved = false;
  var jobs, preferences;

  return new Promise(function (resolve, reject) {
    var checkRequests = function () {
      return (jobsRetrieved && preferencesRetrieved) ?
        resolve({jobs: jobs, preferences: preferences}) :
        false;
    };

    var options = {};
    if (hydrate) {
      options = {
        hydrate: true,
        hydrateWithESResults: true
      };
    }

    JobOffer.search({
        query_string: {
          query: queryString
        }
      },
      options,
      function (err, retriJobs) {
        if (err) {
          reject(err);
        }
        jobsRetrieved = true;
        jobs = retriJobs;
        checkRequests();
      });

    Preference.search({
        query_string: {
          query: queryString
        }
      },
      options,
      function (err, retriPrefs) {
        if (err) {
          reject(err);
        }
        preferencesRetrieved = true;
        preferences = retriPrefs;
        checkRequests();
      });
  });

};

var SearchService = {
  globalSearch: function (queryString) {
    return globalSearchQuery(queryString, true)
      .then(function (results) {
        var jobOffers = results.jobs;
        var users = results.preferences;
        return Promise.resolve({
          jobOffers: jobOffers,
          users: users
        });
      });
  },
  countSearch: function (queryString) {
    return globalSearchQuery(queryString)
      .then(function (results) {
        var jobOffers = results.jobs;
        var users = results.preferences;
        return Promise.resolve({
          count: jobOffers.hits.hits.length + users.hits.hits.length
        });
      });
  },
  simpleSearch: function (queryString) {
    return globalSearchQuery(queryString)
      .then(function (results) {
        var jobOffers = results.jobs;
        var users = results.preferences;
        return Promise.resolve({
          jobOffers: jobOffers,
          users: users
        });
      });
  }
};

module.exports = SearchService;