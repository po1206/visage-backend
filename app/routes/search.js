'use strict';

var express = require('express'),
  router = express.Router(),
  ErrorVisage = require('../constants/error'),
  bodyParser = require('body-parser'),
  Promise = require('promise'),
  PermissionsChecker = require('../services/permissions-checker');

  router.use(bodyParser.urlencoded({extended: true}));

var SearchService = require('../services/search-service');

var MAX_RESULTS_COUNT = 20;

router.get('/', function (req, res) {

  var queryString;

  var launchSearch = function (results) {
    if (results.count <= MAX_RESULTS_COUNT) {
      return SearchService.globalSearch(queryString);
    }
    else {
      return Promise.reject({
        code: ErrorVisage.Code.TOO_MANY_RESULTS,
        message: ErrorVisage.Message.TOO_MANY_RESULTS,
        count: results.count
      });
    }
  };

  var permissionsChecker = new PermissionsChecker(req.user);
  if (!permissionsChecker.isAdmin()) {
    return res.sendStatus(401);
  }
  if (!req.query && !req.query.q) {
    res.statusCode = 500;
    return res.json({
      code: ErrorVisage.Code.MISSING_PARAMETER,
      message: ErrorVisage.Message.MISSING_PARAMETER
    });
  }
  queryString = req.query.q;
  SearchService.countSearch(queryString)
    .then(launchSearch)
    .then(function (results) {
      return res.json(results);
    })
    .catch(function (err) {
      console.error(err);
      res.statusCode = 500;
      return res.json(err);
    });

  //SearchService.simpleSearch(queryString)
  //  .then(function (results) {
  //    return res.json(results);
  //  })
  //  .catch(function (err) {
  //    console.error(err);
  //    res.statusCode = 500;
  //    return res.json(err);
  //  });
});

module.exports = router;
