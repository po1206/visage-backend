'use strict';

var express = require('express');
var path = require('path');
var cors = require('cors');
var bodyParser = require('body-parser');
var packagejson = require('./package');
var common = require('./common');

//migrate if necessary
require('./migration/migrate')(packagejson.version);

var errorhandler = require('errorhandler');
var jwt = require('express-jwt');
var userLoader = require('./services/user-loader');
var jobOfferQueryChecker = require('./services/job-offer-query-checker');
var jobOfferResponseFilter = require('./services/job-offer-response-filter');
var macValidation = require('./services/validate-mac');

var app = express();

var jwtCheck = jwt({
  secret: new Buffer(
    'pykXWMycDMkYESaGHOYMgKX0y2qlzbynX8u6ys3sHH4EWbxPeyB4NYF1Zac4n7gP',
    'base64'),
  audience: 'bQ1LbVxzegv8oUew3SO7eHa8bemGgcu0'
});

var errorNotification = function(err, str, req) {
  var title = 'Error in ' + req.method + ' ' + req.url;
  console.error({
    error:err,
    title: title,
    message: str
  });
};

var corsOptions = {
  origin: function(origin, callback){
    var originIsWhitelisted = common.config.whitelist.indexOf('*')!==-1 || common.config.whitelist.indexOf(origin) !== -1;
    callback(originIsWhitelisted ? null : 'Bad Request', originIsWhitelisted);
  },
  'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
  'preflightContinue': false
};

//DON T RUN CORS FOR HEALTH CHECK (and typeform...)
//app.use('^(?!(\/|\/typeform\/jobs\/|\/media\/.*|\/reports\/.*)$)', cors(corsOptions));
//app.options('*', cors(corsOptions)); // include before other routes

app.use(cors());

app.use(errorhandler({log: errorNotification}));

var routes = require('./routes/index');
var dummy = require('./routes/dummy');
var services = require('./routes/services');
var jobOffers = require('./routes/job-offers');
var publicJobOffers = require('./routes/public-job-offers');
var recruiters = require('./routes/recruiters');
var users = require('./routes/users');
var preferences = require('./routes/preferences');
var candidates = require('./routes/candidates');
var typeform = require('./routes/typeform');
var media = require('./routes/media');
var invitations = require('./routes/invitations');
var search = require('./routes/search');
var reports = require('./routes/reports');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(path.join(__dirname, 'public')));

//Middleware authentication
app.use('/dummy', jwtCheck);
app.use('/users', jwtCheck);
app.use('/preferences', jwtCheck);
app.use('/job-offers', jwtCheck);
app.use('/services', jwtCheck);
app.use('/candidates', jwtCheck);
app.use('/recruiters', jwtCheck);
app.use('/invitations', jwtCheck);
app.use('/search', jwtCheck);


//Middleware loading preferences
app.use('/dummy', userLoader);
app.use('/users', userLoader);
app.use('/preferences', userLoader);
app.use('/job-offers', userLoader);
app.use('/services', userLoader);
app.use('/candidates', userLoader);
app.use('/recruiters', userLoader);
app.use('/invitations', userLoader);
app.use('/search', userLoader);


//TODO Secure typeform creation when we will allow the bo to create forms dynamically
//app.use('/typeform', jwtCheck);
//TODO Check Authorization for media API...
//app.use('/media', jwtCheck);

//TODO Find out why this is delaying all requests big time
app.use('/job-offers', jobOfferQueryChecker);
//app.use('/reports', macValidation);

app.use('/', routes);
app.use('/dummy', dummy);
app.use('/services', services);
app.use('/job-offers', jobOffers);
app.use('/public-job-offers', publicJobOffers);
app.use('/users', users);
app.use('/preferences', preferences);
app.use('/candidates', candidates);
app.use('/recruiters', recruiters);
app.use('/media', media);
app.use('/typeform', typeform);
app.use('/invitations', invitations);
app.use('/search', search);
app.use('/reports', reports);


app.use('/job-offers', jobOfferResponseFilter);



//app.use(cors());

//// catch 404 and forward to error handler
//app.use(function(req, res, next) {
//  var err = new Error('Not Found');
//  err.status = 404;
//  next(err);
//});
//
//// error handlers
//
//// development error handler
//// will print stacktrace
//if (app.get('env') === 'development') {
//  app.use(function(err, req, res, next) {
//    res.status(err.status || 500);
//    res.render('error', {
//      message: err.message,
//      error: err
//    });
//  });
//}
//
//// production error handler
//// no stacktraces leaked to user
//app.use(function(err, req, res, next) {
//  res.status(err.status || 500);
//  res.render('error', {
//    message: err.message,
//    error: {}
//  });
//});

module.exports = app;
