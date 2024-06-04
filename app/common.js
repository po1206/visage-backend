var env = require('./env');

var nodeEnv = process.env.NODE_ENV || 'development';

exports.config = env[nodeEnv];
