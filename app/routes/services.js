'use strict';

var express = require('express'),
  router = express.Router(),
  bodyParser = require('body-parser'),
  MailDispatcher = require('../services/mail-dispatcher'),
  PermissionsChecker = require('../services/permissions-checker'),
  Promise = require('promise'),
  common = require('../common');

var RecruiterService = require('../services/recruiter-service');
var ExpertService = require('../services/expert-service');

// var crypto = require('crypto'),
////TODO Temporary solution to secure payment with tokens when we send a link to the client
//  password = new Buffer('vI886HuiSoHrdfs0', 'utf-8').toString('base64');

var crypto = require('crypto'),
  key = common.config.encryptionPassword;

router.use(bodyParser.urlencoded({extended: true}));

router.route('/mail/send-calibration').post(function (req, res, next) {
  var permissionsChecker = new PermissionsChecker(req.user);
  if (permissionsChecker.isAdmin()) {
    MailDispatcher.calibrationValidation(req.body.client, req.body.job);
    res.json({
      status: 'success',
      updated: req.body.job
    });
    return next();
  }
});

router.route('/mail/requirements-changed').post(function (req, res, next) {
  var permissionsChecker = new PermissionsChecker(req.user);
  if (permissionsChecker.isAdmin() && req.body.job && req.body.client) {
    Promise.all([
        RecruiterService.getRecruitersByJob(req.body.job._id),
        ExpertService.getExpertsByJob(req.body.job._id)
      ])
      .then(function (results) {
        var recruiters = results[0];
        var experts = results[1];
        MailDispatcher.requirementsChanged(req.body.client, req.body.job, recruiters, experts);
        res.json({
          status: 'success',
          updated: req.body.job
        });
        return next();
      });

  }
});

router.route('/mail/recruiter-validated').post(function (req, res, next) {
  //var permissionsChecker = new PermissionsChecker(req.user);
  //if (permissionsChecker.isAdmin()) {
  MailDispatcher.recruiterValidated(req.body.recruiter);
  res.json({
    status: 'success',
    updated: req.body.job
  });
  return next();
  //}
});

router.route('/mail/calibration-validated').post(function (req, res, next) {
  MailDispatcher.calibrationValidated(req.body.job);
  res.json({
    status: 'success',
    validated: req.body.jobs
  });
  return next();
});

router.route('/mail/request-sourcing').post(function (req, res) {
  var permissionsChecker = new PermissionsChecker(req.user);
  if (permissionsChecker.isAdmin()) {
    if (req.body.job) {
      Promise.all([
          RecruiterService.getValidatedRecruiters(),
          ExpertService.getExpertsByJob(req.body.job._id)
        ])
        .then(function (results) {
          var recruiters = results[0];
          var experts = results[1];
          MailDispatcher.requestSourcing(recruiters, experts, req.body.job);
          res.json({
            status: 'success',
            launched: req.body.job,
            sentTo: recruiters.length
          });
        })
        .catch(function (err) {
          console.error(err);
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem sending the campaign email',
            error: err
          });
        });
    }
  }
});

router.route('/mail/stop-sourcing').post(function (req, res) {
  var permissionsChecker = new PermissionsChecker(req.user);
  if (permissionsChecker.isAdmin()) {
    if (req.body.job) {

      Promise.all([RecruiterService.getRecruitersByJob(req.body.job._id),
          ExpertService.getExpertsByJob(req.body.job._id)])
        .then(function (results) {
          var recruiters = results[0];
          var experts = results[1];
          MailDispatcher.stopSourcing(recruiters, experts, req.body.job);
          res.json({
            status: 'success',
            stopped: req.body.job,
            sentTo: {recruiters: recruiters, experts: experts}
          });
        })
        .catch(function (err) {
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem sending the campaign email',
            error: err
          });
        });
    }
  }
});

router.route('/mail/order-confirmation').post(function (req, res, next) {
  MailDispatcher.orderConfirmation(req.body.email, req.body.receipt);
  res.json({
    status: 'success',
    confirmed: req.body.receipt
  });

  return next();
});

router.route('/mail/payment-request').post(function (req, res, next) {
  var permissionsChecker = new PermissionsChecker(req.user);
  if (permissionsChecker.isAdmin()) {
    MailDispatcher.paymentRequest(req.body.user,
      req.body.temporaryToken,
      req.body.iv,
      req.body.receipt);
    res.json({
      status: 'success',
      confirmed: req.body.temporaryToken
    });
    return next();
  }
});

router.route('/secret-payment-token').get(function (req, res, next) {
  var permissionsChecker = new PermissionsChecker(req.user);
  if (permissionsChecker.isAdmin()) {
    if (req.query && req.query.price && req.query.user_id) {
      var iv = crypto.randomBytes(16);
      var cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
      var encrypted = cipher.update(req.query.price + req.query.user_id, 'utf8', 'binary');
      encrypted += cipher.final('binary');
      var hexVal = new Buffer(encrypted, 'binary');
      var newEncrypted = hexVal.toString('hex');

      res.json({
        temporaryToken: encodeURIComponent(newEncrypted),
        iv: encodeURIComponent(iv.toString('base64'))
      });
    }
    return next();
  }
});

router.route('/mail/longlist-ready').post(function (req, res, next) {
  MailDispatcher.longlistReady(req.body.client, req.body.job);
  res.json({
    status: 'success',
    longlistFor: req.body.job
  });
  return next();
});

router.route('/mail/shortlist-ready').post(function (req, res, next) {
  MailDispatcher.shortlistReady(req.body.client, req.body.job);
  res.json({
    status: 'success',
    shortlistFor: req.body.job
  });
  return next();
});

router.route('/mail/message-candidate').post(function (req, res, next) {
  MailDispatcher.messageCandidate(req.body.email,
    req.body.client,
    req.body.message,
    req.body.candidate);
  res.json({
    status: 'success',
    sent: req.body
  });
  return next();
});

router.route('/mail/send-expert-invitation').post(function (req, res, next) {
  MailDispatcher.sendExpertInvitation(req.body);
  res.json({
    status: 'success',
    sent: req.body
  });
  return next();
});

router.route('/mail/send-recruiter-invitation').post(function (req, res, next) {
  MailDispatcher.sendRecruiterInvitation(req.body);
  res.json({
    status: 'success',
    sent: req.body
  });
  return next();
});

module.exports = router;
