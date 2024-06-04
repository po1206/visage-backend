'use strict';

var express = require('express'),
  router = express.Router(),
  request = require('request'),
  bodyParser = require('body-parser'),
  TypeformMapper = require('../services/typeform-mapper');

var ErrorVisage = require('../constants/error');

var common = require('../common');

//Check if prod or DEV
var nodeEnv = process.env.NODE_ENV || 'development';

var moment = require('moment');

router.use(bodyParser.urlencoded({extended: true}));

/* Just a dummy request to check token validity
 */
router.get('/', function (req, res) {
  res.sendStatus(200);
});

/*
 Job creation form
 */
router.route('/jobs').post(function (req, res) {
  //FIXME Check that the request comes from Typeform service...

  var formResponse = req.body.form_response;
  if (!formResponse ||
    !formResponse.answers ||
    !formResponse.hidden ||
    !formResponse.hidden.id ||
    !formResponse.hidden.jwt) {
    res.statusCode = 422;
    return res.json(
      {
        message: 'There was a problem posting a job',
        error: {
          code: ErrorVisage.Code.MISSING_PARAMETER,
          message: ErrorVisage.Message.MISSING_PARAMETER
        }
      });
  }
  var newJobFormConstants = common.config.thirdParties.typeform.employers.newJob;
  if (formResponse.form_id !== newJobFormConstants.id) {
    res.statusCode = 404;
    return res.json(
      {
        message: 'Form not found',
        error: {
          code: ErrorVisage.Code.NOT_FOUND,
          message: ErrorVisage.Message.NOT_FOUND
        }
      });
  }

  var job = TypeformMapper.toJob(req.body.form_response);

  //FIXME Workaround because I did not setup secured protocol between ELB and instances on AWS...
  var protocol = (nodeEnv === 'production') ? 'https' : req.protocol;
  var options = {
    url: protocol + '://' + req.get('host') + '/job-offers',
    method: 'POST',
    headers: {
      'Authorization' : 'Bearer ' + formResponse.hidden.jwt,
      'Accept': 'application/json',
      //fake origin to pass CORS...
      'Origin' : common.config.bo.host
    },
    json: job
  };

  var jobCreated = function (error, response, body) {
      if (!error && response.statusCode ===
        201) {
        res.json(body);
      }
      else {
        if(error) {
          console.error(error);
        }
        if(response) {
          res.statusCode = response.statusCode;
        }
        else {
          res.statusCode = 500;
        }
        res.json(body);
      }
    }
    ;
  return request(options, jobCreated);
});

module.exports = router;
