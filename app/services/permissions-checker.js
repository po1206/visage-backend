'use strict';

var crypto = require('crypto');

var PermissionsChecker = function (user) {
  this.user = user;
};

PermissionsChecker.prototype.isAdmin = function () {
  return (this.user.roles && this.user.roles.indexOf('admin') !== -1);
};

PermissionsChecker.prototype.isOwner = function (userId) {
  return (this.user.encodedAuthUser === userId);
};

PermissionsChecker.prototype.isInvited = function (key, salt) {
  return (key ===
  crypto.createHash('md5')
    .update(this.user.encodedEmail + salt.toString('base64'))
    .digest('hex'));
};

PermissionsChecker.prototype.isRole = function (role) {
  return (this.user.preferences.roles.indexOf(role) !== -1);
};

PermissionsChecker.prototype.isEmployer = function () {
  return this.isRole('employer');
};

PermissionsChecker.prototype.isRecruiter = function () {
  return this.isRole('recruiter');
};

PermissionsChecker.prototype.isUnknown = function () {
  return !(this.user);
};

PermissionsChecker.prototype.isExpert = function () {
  return this.isRole('expert');
};

PermissionsChecker.prototype.isValidatedRecruiter = function () {
  return (this.isRecruiter() && this.user.preferences.recruiter.validated);
};

PermissionsChecker.prototype.isValidatedExpert = function () {
  return this.isExpert();
};

module.exports = PermissionsChecker;