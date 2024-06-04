'use strict';

var express = require('express'),
  router = express.Router(),
  methodOverride = require('method-override'), //used to manipulate POST
  bodyParser = require('body-parser');

var aws = require('aws-sdk');
var stream = require('stream');
var common = require('../common');

var crypto = require('crypto');
var moment = require('moment');

var MediaService = require('../services/media-service');
var CandidateService = require('../services/candidate-service');
var ErrorVisage = require('../constants/error');

aws.config.region = MediaService.getRegion();

router.use(bodyParser.urlencoded({extended: true}));
router.use(methodOverride(function (req) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

router.get('/', function (req, res) {
  if (!req.user.app_metadata || !req.user.app_metadata.roles ||
    (req.user.app_metadata.roles &&
    req.user.app_metadata.roles.indexOf('admin') === -1)) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);
});

router.post('/signing', function (req, res) {
  var request = req.body;

  var readType = 'public-read';

  var expiration = moment().add(5, 'm').toDate(); //5 minutes

  var path = new Buffer(request.filename + 'expiration', 'utf-8').toString('base64');

  var bucket = MediaService.getBucket(request.mediaType);

  var s3Policy = {
    'expiration': expiration,
    'conditions': [{
      'bucket': bucket
    },
      ['starts-with', '$key', path],
      {
        'acl': readType
      },
      {
        'success_action_status': '201'
      },
      ['starts-with', '$Content-Type', request.type],
      ['content-length-range', 2048, 10485760] //min and max
    ]
  };

  var stringPolicy = JSON.stringify(s3Policy);
  var base64Policy = new Buffer(stringPolicy, 'utf-8').toString('base64');

  // sign policy
  var signature = crypto.createHmac('sha1', process.env.AWS_SECRET_ACCESS_KEY)
    .update(new Buffer(base64Policy, 'utf-8')).digest('base64');

  //TODO check if existing beforesending upload request md5....
  var s3Url = MediaService.getUrl(request.mediaType);

  var credentials = {
    url: s3Url,
    fields: {
      key: path,
      AWSAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      acl: readType,
      policy: base64Policy,
      signature: signature,
      'Content-Type': request.type,
      success_action_status: 201
    }
  };
  res.jsonp(credentials);
});

router.get('/validation/cv', function (req, res) {
  if (req.query.jobId && req.query.cvMd5) {
    CandidateService.checkCVValidity(req.query.jobId, req.query.cvMd5)
      .then(function () {
        return res.sendStatus(200);
      })
      .catch(function (err) {
        res.statusCode = 500;
        return res.json({
          message: 'There was a problem validating this CV',
          error: err
        });
      });
  }
  else {
    return res.json(
      {
        message: 'There was a problem validating this CV',
        error: {
          code: ErrorVisage.Code.MISSING_PARAMETER,
          message: ErrorVisage.Message.MISSING_PARAMETER
        }
      });
  }
});

router.get('/download/:mediatype/:identifier', function (req, res) {
  //TODO remove non ascii characters for now , find a more elegant solution
  res.header('Content-Disposition', 'attachment; filename=' + req.query.filename.replace(/[^\x00-\x7F]/g, ''));

  if(req.params.mediatype ==='CV') {
    res.header('Content-Type', 'application/pdf');
  }
  var s3obj = new aws.S3({
    params: {
      Bucket: MediaService.getBucket(req.params.mediatype),
      Key: req.params.identifier
    }
  });

  s3obj.headObject(function (err, data) {
    if (err) {
      res.status(500);
      console.error(err);
      return res.json({error: err});
    }
    res.header('Content-Length', data.ContentLength);
    s3obj.getObject().createReadStream().pipe(res);
  });
});

router.delete('/:mediatype/:identifier', function (req, res) {
  var s3obj = new aws.S3({
    params: {
      Bucket: MediaService.getBucket(req.params.mediatype),
      Key: req.params.identifier
    }
  });
  s3obj.deleteObject(function (err, data) {
    if (err) {
      res.status(500);
      return res.json({error: err});
    }
    else {
      return res.json(data);
    }
  });
});

module.exports = router;
