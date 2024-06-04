'use strict';

var management = require('../management'),
  Promise = require('promise');

var UserService = {
  getUsers: function (ids) {
    return new Promise(function (resolve, reject) {
      var params;
      if (ids) {
        if (!Array.isArray(ids)) {
          ids = [ids];
        }
        var query = '';
        ids.forEach(function (userId, index) {
          if (index > 0) {
            query += ' OR ';
          }
          query += 'user_id:\'' + userId + '\'';
        });
        params = {
          search_engine: 'v2',
          q: query
        };
      }
      if (Array.isArray(ids) && ids.length === 0) {
        resolve([]);
      }
      else {
        management.getUsers(params).then(function (users) {
          resolve(users);
        }).catch(function (err) {
          reject(err);
        });
      }
    });
  },
  getUser: function (userId) {

    return new Promise(function (resolve, reject) {
      management.getUser({id: userId}).then(function (user) {
        resolve(user);
      }).catch(function (err) {
        if (err) {
          reject(err);
        }
      });
    });
  }
};

module.exports = UserService;