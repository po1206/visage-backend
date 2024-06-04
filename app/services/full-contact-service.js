'use strict';

var common = require('../common');
var request = require('request-promise');

var FullContactService = {
  getCandidateFullContact: function (email) {
    var options = {
      uri: 'https://api.fullcontact.com/v2/person.json',
      qs: {
        email: email
      },
      headers: {
        'X-FullContact-APIKey': common.config.thirdParties.fullContact.APIKey
      },
      json: true
    };

    return request(options).then(function(fullContactInfo) {
      return {
        status: fullContactInfo.status,
        photos: fullContactInfo.photos,
        socialProfiles: fullContactInfo.socialProfiles
      };
    });
  }
};

module.exports = FullContactService;