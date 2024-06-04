'use strict';
var common = require('../common');

var MediaService = function () {
};

var Media = {
  REGION: common.config.awsRegion,
  S3_BUCKETS: common.config.s3Buckets
};

MediaService.getBucket = function (mediaType) {
  switch (mediaType) {
    case 'CV':
      return Media.S3_BUCKETS.CVs;
    case 'ProfilePicture':
      return Media.S3_BUCKETS.PPs;
    case 'JobDescription':
      return Media.S3_BUCKETS.JDs;
    default:
      break;
  }
};

MediaService.getRegion = function () {
  return Media.REGION;
};

MediaService.getUrl = function (mediaType) {
  return 'https://' + MediaService.getBucket(mediaType) + '.s3-' + Media.REGION + '.amazonaws.com';
};


module.exports = MediaService;