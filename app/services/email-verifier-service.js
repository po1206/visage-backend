'use strict';

var common = require('../common');
var request = require('request-promise');

var EmailVerifierService = {
  checkCandidateEmailValidity: function (email) {
    var options = {
      uri: 'http://emailverifierapi.com/v2/',
      qs: {
        apiKey: common.config.thirdParties.emailverifier.APIKey,
        email: email
      },
      json: true
    };

    return request(options);
  }
};

module.exports = EmailVerifierService;