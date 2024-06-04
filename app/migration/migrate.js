'use strict';

var Promise = require('promise');

var semver = require('semver');

var Version = require('../domain/version');

//TODO Externalize this part
var updates = {
  '1.6.0': function () {
    var Invitation = require('../domain/invitation');

    //Set all the invitations document role : recruiter because now we can invite experts
    // too
    return Invitation.update({}, {$set: {'role': 'recruiter'}}, {multi: true});
  },
  '1.7.3': function () {
    var JobOffer = require('../domain/job-offer');
    //Set all ths jobs to pre 1.8 to know which job is not to be referred on the app
    return JobOffer.update({}, {$set: {'pre1dot8': true}}, {multi: true});
  },
  '1.8.3': function () {
    var updateCandidatesSubmissionsPromise = new Promise(function (resolve, reject) {
      var CandidateSubmission = require('../domain/candidate-submission');
      //Set all ths jobs to pre 1.8 to know which job is not to be referred on the app
      CandidateSubmission.find({at: {$exists: true}}).cursor()
        .on('error', function (error) {
          return reject(error);
        })
        .on('data', function (candidateSubmission) {
          candidateSubmission.submittedAt = candidateSubmission.at;
          candidateSubmission.save();
        })
        .on('end', function () {
          return resolve();
        });
    });

    var JobOffer = require('../domain/job-offer');
    var updateJobOffersPromise = JobOffer.update({status: 'Copywrited'},
      {$set: {'status': 'Copywritten'}},
      {multi: true});

    var updateJobOffersPromise2 = JobOffer.update({}, {$set: {'maxSourced': 999}}, {multi: true});

    var RecruiterAssignment = require('../domain/recruiter-assignment');
    var updateRecruiterAssignmentPromise = RecruiterAssignment.update({},
      {$set: {'maxSlots': 99}},
      {multi: true});

    return Promise.all([updateCandidatesSubmissionsPromise,
      updateJobOffersPromise,
      updateJobOffersPromise2,
      updateRecruiterAssignmentPromise]);
  },
  '1.9.4': function () {
    var JobOffer = require('../domain/job-offer');
    //We quitted workable, remove this tag
    return JobOffer.update({}, {$unset: {'pre1dot8': 1}}, {multi: true});
  },
  '1.10.0': function () {
    var JobOffer = require('../domain/job-offer');
    //Remove the approval step in the process
    return JobOffer.update({$or: [{'status': 'Saved'}, {'status': 'Copywritten'}]},
      {$set: {'status': 'Draft'}},
      {multi: true});
  }
};

var Migrate = function (versionNumber) {
  if (versionNumber) {

    var getLatestVersion = function () {
      return Version.findOne({}, {}, {sort: {'updatedAt': -1}});
    };

    var chainUpdates = function (updatesVersionNumbers, currentVersion) {
      return updatesVersionNumbers.reduce(function (promise, version) {
        return promise.then(function (newVersion) {
          currentVersion = newVersion || currentVersion;
          console.info('updating from ' + currentVersion.current + ' to ' + version);
          return updates[version].call(this)
            .then(function (results) {
              console.info('Success, database has been updated');
              console.info(results);
              return Version.create({current: version, previous: currentVersion.current});
            });
        });
      }, Promise.resolve());
    };

    console.info('checking version number...');
    //Update database if not at the right version
    getLatestVersion().then(function (lastVersion) {
        lastVersion = lastVersion || {current: '1.0.0'};
        if (lastVersion.current === versionNumber) {
          console.info('database is up to date ');
        }
        //upgrading if version number > latest version in db
        else if (semver.gt(versionNumber, lastVersion.current)) {
          console.info('upgrading database....');

          var updatesToExec = [];
          var sortedVersions = Object.keys(updates).sort(semver.compare);
          sortedVersions.forEach(function (version) {
            if (semver.gt(version, lastVersion.current) && semver.lte(version, versionNumber)) {
              updatesToExec.push(version);
            }
          });

          chainUpdates(updatesToExec, lastVersion)
            .then(function () {
              console.info('Terminated');
              console.info('Upgrades: ', updatesToExec.join(', '));
            })
            .catch(function (err) {
              console.error('error while updating the database');
              console.error(err);
            });

        }
        //TODO Support downgrading
        else {
          console.error('Database migrations script does not support downgrading yet');
        }
      })
      .catch(function (err) {
        console.error(err);
      });
  }
  else {
    console.error('Missing version number');
  }
};

module.exports = Migrate;
