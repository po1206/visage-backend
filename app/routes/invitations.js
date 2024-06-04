'use strict';

var express = require('express'),
  router = express.Router(),
  merge = require('merge'),
  common = require('../common'),
  crypto = require('crypto');

var Invitation = require('../domain/invitation');

var PermissionsChecker = require('../services/permissions-checker');

var addInvitation = function (req) {
  var invitation = req.body;

  var salt = common.config.saltHashInvitation.toString('base64');

  invitation.key =
    crypto.createHash('md5').update(invitation.email.toString('base64') + salt).digest('hex');

  return Invitation.create(invitation);
};

var updateInvitation = function (req) {

  var invitationId = req.params.invitationId;
  return Invitation.findOne({_id: invitationId})
    .then(function (invitation) {
      invitation = merge(invitation, req.body);
      return invitation.save();
    });
};

var successInvitationCreation = function (res, created, next) {
  res.json(created);
  return next();
};

var errInvitationCreation = function (res, err) {
  res.statusCode = 500;
  return res.json({
    message: 'There was a problem adding the invitation.',
    error: err
  });
};

//TODO Implement a real messaging QUEUE with REDIS
var successInvitationUpdate = function (res, updated, next) {
  //MailDispatcher.newFreecruiter(req.user.sub, user);
  res.json(updated);
  return next();
};

var errInvitationUpdate = function (res, err) {
  res.statusCode = 500;
  return res.json({
    message: 'There was a problem updating the invitation.',
    error: err
  });
};

router.route('/')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }
    var limitObject = {};
    var params;
    if (req.query) {
      params = req.query;
      if (params.sortType) {
        limitObject.sortType = parseInt(params.sortType, 10);
        delete params.sortType;
      }
      if (params.offset) {
        limitObject.offset = parseInt(params.offset, 10);
        delete params.offset;
      }
      if (params.limit) {
        limitObject.limit = parseInt(params.limit, 10);
        delete params.limit;
      }
    }
    var find = Invitation.find(params);
    if (limitObject.limit) {
      find
        .sort({created_at: limitObject.sortType})
        .skip(limitObject.offset)
        .limit(limitObject.limit);
    }
    find.find(function (err, invitations) {
      if (err) {
        return res.json({
          message: 'There was a problem retrieving invitations',
          error: err
        });
      }
      else {
        res.json(invitations);
        return next();
      }
    });
  })
  .post(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (!permissionsChecker.isAdmin()) {
      return res.sendStatus(401);
    }
    // Get values from POST request. These can be done through forms or REST calls. These rely
    // on the 'name' attributes for forms
    if (req.body) {
      addInvitation(req).then(function (invitation) {
        successInvitationCreation(res, invitation, next);
      }, function (err) {
        errInvitationCreation(res, err);
      });
    }
  });

router.route('/:invitationId')
  .get(function (req, res, next) {
    var permissionsChecker = new PermissionsChecker(req.user);
    //if there is an employer id in the request filter by employer_id
    if (req.params) {
      if (!permissionsChecker.isAdmin() &&
        !permissionsChecker.isInvited(req.query.key, common.config.saltHashInvitation)) {
        return res.sendStatus(401);
      }
      var invitationID = req.params.invitationId;
      Invitation.findOne({_id: invitationID}, function (err, invitation) {
        if (err) {
          return res.json({
            message: 'There was a problem retrieving the invitation',
            error: err
          });
        }
        else {
          res.json(invitation);
          return next();
        }
      });
    }
  })
  .put(function (req, res, next) {
    if (req.body) {
      updateInvitation(req).then(function (userUpdated) {
        successInvitationUpdate(res, userUpdated, next);
      }, function (err) {
        errInvitationUpdate(res, err);
      });
    }
  })
  .delete(function (req, res, next) {
    var invitationId = req.params.invitationId;
    Invitation.findOne({_id: invitationId}, function (err, invitation) {
      invitation.remove({
        _id: invitationId
      }, function (err, invitation) {
        if (err) {
          res.statusCode = 500;
          return res.json({
            message: 'There was a problem deleting the invitation',
            error: err
          });
        }
        res.json(invitation);
        return next();
      });
    });
  });

module.exports = router;
