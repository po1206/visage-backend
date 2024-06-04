'use strict';

var common = require('../common'),
  constants = require('../constants'),
  path = require('path'),
  EmailTemplate = require('email-templates').EmailTemplate,
  nodemailer = require('nodemailer');

var moment = require('moment');

var sesTransport = require('nodemailer-ses-transport');

var visageUserPostedJobTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'visage',
  'user-posted-job');
var recruitersUserPostedJobTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'recruiters',
  'user-posted-job');
var recruitersJobClosedToSubmissionTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'recruiters',
  'stop-sourcing');
var recruitersInvitationTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'recruiters',
  'invitation');
var recruiterRecruiterValidated = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'recruiters',
  'recruiter-validated');
var recruitersRequirementsUpdated = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'recruiters',
  'requirements-updated');

var expertsInvitationTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'experts',
  'invitation');
var expertsUserPostedJobTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'experts',
  'user-posted-job');
var expertsJobClosedToSubmissionTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'experts',
  'stop-evaluation');
var expertsRequirementsUpdated = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'experts',
  'requirements-updated');
var visageCampaignLaunchedTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'visage',
  'campaign-launched');
var employersValidateCalibration = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'employers',
  'validate-calibration');

var employersRequirementsUpdated = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'employers',
  'requirements-updated');
var employersPaymentRequest = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'employers',
  'payment-request');
var employersValidateOrder = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'employers',
  'order-confirmation');

var visageUserValidatedCalibrationTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'visage',
  'calibration-validated');

var visageUserMessageCandidateTemplate = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'candidates',
  'message-candidate');
var employersShortlistReady = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'employers',
  'shortlist-ready');
var employersLonglistReady = path.join(__dirname,
  '..',
  'templates',
  'emails',
  'employers',
  'longlist-ready');


//Check if prod or DEV
var nodeEnv = process.env.NODE_ENV || 'development';

var MailDispatcher = function () {
};

MailDispatcher.sendEmail = function (from, to, subject, content, bcc, attachements) {
  if (from && to && subject && content) {
    if (nodeEnv !== 'production') {

      //Do not send emails to client while testing
      bcc = null;

      var toToString = (Array.isArray(to)) ? to.join(',') : to;
      var bccToString = (Array.isArray(bcc)) ? bcc.join(',') : bcc;

      //To check the test write the original dest in the content
      content.html += 'Original dest : ' + toToString + '<br>\n';
      content.html += 'Original bcc : ' + bccToString;

      if (nodeEnv !== 'staging') {
        //development use locally set email
        to = process.env.LOCAL_EMAIL_TO;
        subject = '[LOCAL] ' + subject;
      }
      else {
        to = 'test@visage.ae';
        subject = '[STAGING] ' + subject;
      }
    }
    // create reusable transporter object using the default SMTP transport
    var transporter = nodemailer.createTransport(sesTransport({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'us-west-2',
      rateLimit: 5 // do not send more
                   // than 5 messages in
                   // a second
    }));

    // setup e-mail data with unicode symbols
    var mailOptions = {
      from: from,
      to: to, // list of receivers
      subject: subject, // Subject line
      text: content.text, // plaintext body
      html: content.html // html body
    };

    if (bcc) {
      mailOptions.bcc = bcc;
    }

    if (attachements) {
      mailOptions.attachements = attachements;
    }

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error('Error sending mail');
        return console.error(error);
      }
    });
  }
};

MailDispatcher.sendExpertInvitation = function (invitation) {
  var notifyExpert = function () {
    var template = new EmailTemplate(expertsInvitationTemplate);
    var invitationUrl = common.config.fo.host +
      constants.fo.methods.expert.profile +
      '?inviteExpert=' +
      invitation._id +
      '&key=' +
      invitation.key;

    var title = 'You have been invited to work with Visage';
    template.render({
      title: title,
      greetings: 'Hey fellow expert,',
      invitationUrl: invitationUrl,
      invitation: invitation
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        invitation.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam
      );
    });
  };
  notifyExpert();
};

MailDispatcher.sendRecruiterInvitation = function (invitation) {
  var notifyRecruiter = function () {
    var template = new EmailTemplate(recruitersInvitationTemplate);
    var invitationUrl = common.config.fo.host +
      constants.fo.methods.recruiter.profile +
      '?inviteRecruiter=' +
      invitation._id +
      '&key=' +
      invitation.key;

    var title = 'You have been invited to work with Visage';
    template.render({
      title: title,
      greetings: 'Hey fellow recruiter,',
      invitationUrl: invitationUrl,
      invitation: invitation
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        invitation.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };
  notifyRecruiter();
};

MailDispatcher.messageCandidate = function (origin, client, message, candidate) {
  var notifyVisage = function () {
    var encodedUser = new Buffer(client.user_id).toString('base64');

    var template = new EmailTemplate(visageUserMessageCandidateTemplate);
    var authLink = common.config.thirdParties.auth0.adminUsersBaseUrl +
      encodedUser.replace(new RegExp('=', 'g'), '');

    var title = 'Contact request from an employer';
    template.render({
      title: title,
      client: client,
      authLink: authLink,
      message: message,
      origin: origin,
      candidate: candidate
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        [candidate.email, origin],
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyVisage();
};

MailDispatcher.calibrationValidated = function (job) {
  var notifyVisage = function (job) {
    var jobsBOBaseURL = common.config.bo.host + constants.bo.methods.jobOffer;
    var template = new EmailTemplate(visageUserValidatedCalibrationTemplate);

    var title = job.title + ' - Customer has validated the calibration';
    template.render({
      title: title,
      jobsBOBaseURL: jobsBOBaseURL,
      job: job
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        common.config.emailAddresses.visageOperations,
        title,
        renderedEmail);
    });
  };

  notifyVisage(job);
};

MailDispatcher.campaignLaunched = function (recruiters, job) {
  var notifyVisage = function (job) {
    var jobsBOBaseURL = common.config.bo.host + constants.bo.methods.jobOffer;
    var template = new EmailTemplate(visageCampaignLaunchedTemplate);

    var title = 'Job campaign launched';
    template.render({
      title: title,
      jobsBOBaseURL: jobsBOBaseURL,
      recruiters: recruiters,
      job: job
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        common.config.emailAddresses.visageTeam,
        title,
        renderedEmail);
    });
  };
  notifyVisage(job);
};

MailDispatcher.stopSourcing = function (recruiters, experts, job) {

  var notifyRecruiters = function (recruiters, job) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.recruiter.jobOffer;
    var template = new EmailTemplate(recruitersJobClosedToSubmissionTemplate);

    var title = job.title + ' - Job Closed for CV submissions';
    if (nodeEnv !== 'production' && recruiters[0]) {
      //just send to one recruiter if not in production
      recruiters = [recruiters[0]];
    }
    recruiters.forEach(function (recruiter) {
      var name = recruiter.name || 'fellow recruiter';
      template.render({
        title: title,
        greetings: 'Hey ' + name + ',',
        jobsRecBaseURL: jobsRecBaseURL,
        job: job
      }, function (err, renderedEmail) {
        if (err) {
          console.error(err);
          return;
        }
        MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
          recruiter.email,
          title,
          renderedEmail,
          common.config.emailAddresses.visagePlatform);
      });
    });
  };

  var notifyExperts = function (experts, job) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.expert.jobOffer;
    var template = new EmailTemplate(expertsJobClosedToSubmissionTemplate);

    var title = job.title + ' - Job Closed for CV filtering';
    if (nodeEnv !== 'production' && experts[0]) {
      //just send to one expert if not in production
      experts = [experts[0]];
    }
    experts.forEach(function (expert) {
      var name = expert.name || 'fellow expert';
      template.render({
        title: title,
        greetings: 'Hey ' + name + ',',
        jobsRecBaseURL: jobsRecBaseURL,
        job: job
      }, function (err, renderedEmail) {
        if (err) {
          console.error(err);
          return;
        }
        MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
          expert.email,
          title,
          renderedEmail,
          common.config.emailAddresses.visagePlatform);
      });
    });
  };
  notifyRecruiters(recruiters, job);
  notifyExperts(experts, job);

};

MailDispatcher.requestSourcing = function (recruiters, experts, job) {

  var notifyRecruiters = function (recruiters, job) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.recruiter.jobOffer;
    var template = new EmailTemplate(recruitersUserPostedJobTemplate);

    var title = job.title + ' - Job Open for CV Submissions';
    if (nodeEnv !== 'production' && recruiters[0]) {
      //just send to one recruiter if not in production
      recruiters = [recruiters[0]];
    }
    recruiters.forEach(function (recruiter) {
      var name = recruiter.name || 'fellow recruiter';
      template.render({
        title: title,
        greetings: 'Hey ' + name + ',',
        jobsRecBaseURL: jobsRecBaseURL,
        job: job
      }, function (err, renderedEmail) {
        if (err) {
          console.error(err);
          return;
        }
        MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
          recruiter.email,
          title,
          renderedEmail,
          common.config.emailAddresses.visagePlatform);
      });
    });
  };

  var notifyExperts = function (experts, job) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.expert.jobOffer;

    var template = new EmailTemplate(expertsUserPostedJobTemplate);

    var title = job.title + ' - Filter candidates for this role';
    if (nodeEnv !== 'production' && experts[0]) {
      //just send to one expert if not in production
      experts = [experts[0]];
    }
    experts.forEach(function (expert) {
      var name = expert.name || 'fellow expert';
      template.render({
        title: title,
        greetings: 'Hey ' + name + ',',
        jobsRecBaseURL: jobsRecBaseURL,
        job: job
      }, function (err, renderedEmail) {
        if (err) {
          console.error(err);
          return;
        }
        MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
          expert.email,
          title,
          renderedEmail,
          common.config.emailAddresses.visagePlatform);
      });
    });
  };

  notifyRecruiters(recruiters, job);
  notifyExperts(experts, job);

};

MailDispatcher.recruiterValidated = function (recruiter) {
  var notifyRecruiter = function (recruiter) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.recruiter.jobs;
    var template = new EmailTemplate(recruiterRecruiterValidated);

    var title = 'Your account has been reviewed';
    var name = (recruiter.name) ? recruiter.name : '';
    template.render({
      title: title,
      greetings: 'Hey ' + name + ',',
      jobsRecBaseURL: jobsRecBaseURL,
      recruiter: recruiter
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        recruiter.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyRecruiter(recruiter);
};

MailDispatcher.calibrationValidation = function (client, job) {
  var notifyClient = function (client, job) {
    var jobsEmpBaseURL = common.config.fo.host + constants.fo.methods.employer.jobOffer;
    var template = new EmailTemplate(employersValidateCalibration);

    var title = 'Validate your calibration';
    var name = (client.name) ? client.name : '';
    template.render({
      title: title,
      greetings: 'Hey ' + name + ',',
      jobsEmpBaseURL: jobsEmpBaseURL,
      client: client,
      job: job
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        client.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyClient(client, job);
};

MailDispatcher.requirementsChanged = function (client, job, recruiters, experts) {
  var notifyClient = function (client, job) {
    var jobsEmpBaseURL = common.config.fo.host + constants.fo.methods.employer.jobOffer;
    var template = new EmailTemplate(employersRequirementsUpdated);

    var title = job.title + ' - Candidates requirements updated';
    var name = (client.name) ? client.name : '';
    template.render({
      title: title,
      greetings: 'Hey ' + name + ',',
      jobsEmpBaseURL: jobsEmpBaseURL,
      client: client,
      job: job
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        client.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  var notifyRecruiters = function (recruiters, job) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.recruiter.jobOffer;
    var template = new EmailTemplate(recruitersRequirementsUpdated);

    var title = job.title + ' - Candidates requirements updated';
    recruiters.forEach(function (recruiter) {
      var name = recruiter.name || 'fellow recruiter';
      template.render({
        title: title,
        greetings: 'Hey ' + name + ',',
        jobsRecBaseURL: jobsRecBaseURL,
        job: job
      }, function (err, renderedEmail) {
        if (err) {
          console.error(err);
          return;
        }
        MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
          recruiter.email,
          title,
          renderedEmail,
          common.config.emailAddresses.visagePlatform);
      });
    });
  };

  var notifyExperts = function (experts, job) {
    var jobsRecBaseURL = common.config.fo.host + constants.fo.methods.expert.jobOffer;
    var template = new EmailTemplate(expertsRequirementsUpdated);

    var title = job.title + ' - Candidates requirements updated';
    experts.forEach(function (expert) {
      var name = expert.name || 'fellow expert';
      template.render({
        title: title,
        greetings: 'Hey ' + name + ',',
        jobsRecBaseURL: jobsRecBaseURL,
        job: job
      }, function (err, renderedEmail) {
        if (err) {
          console.error(err);
          return;
        }
        MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
          expert.email,
          title,
          renderedEmail,
          common.config.emailAddresses.visagePlatform);
      });
    });
  };

  notifyClient(client, job);
  if(job.launched) {
    notifyExperts(experts, job);
    if(job.sourcing) {
      notifyRecruiters(recruiters, job);
    }
  }

};

MailDispatcher.notifyNewJobs = function (userId, jobs) {
  var newSavedJobs = jobs.filter(function (job) {
    return job.status === 'Approved';
  });
  MailDispatcher.jobPosted(userId,newSavedJobs);
};

MailDispatcher.jobPosted = function (userId, jobs) {
  var notifyTeam = function (encodedId, jobs) {
    var clientId = encodedId.replace(new RegExp('=', 'g'), '');
    var authLink = common.config.thirdParties.auth0.adminUsersBaseUrl + clientId;
    var profileLink = common.config.bo.host + constants.bo.methods.clients + '/' + clientId;

    var jobsBOBaseURL = common.config.bo.host + constants.bo.methods.jobOffer;
    var template = new EmailTemplate(visageUserPostedJobTemplate);

    var title = 'User has submitted a job';
    template.render({
      title: title,
      authLink: authLink,
      visageProfile: profileLink,
      jobsBOBaseURL: jobsBOBaseURL,
      jobs: jobs
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        common.config.emailAddresses.visageOperations,
        title,
        renderedEmail);
    });
  };

  var encodedUser = new Buffer(userId).toString('base64');

  notifyTeam(encodedUser, jobs);

};

MailDispatcher.orderConfirmation = function (email, receipt) {
  var notifyClient = function (email, receipt) {
    var template = new EmailTemplate(employersValidateOrder);

    var title = 'Receipt for your job credit(s) purchase';
    template.render({
      title: title,
      email: email,
      receipt: receipt,
      paidOn: moment(receipt.paidOn).format('LLL')
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyClient(email, receipt);
};

MailDispatcher.paymentRequest = function (client, temporaryToken, iv, receipt) {
  var notifyClient = function (client, temporaryToken, iv, receipt) {
    var template = new EmailTemplate(employersPaymentRequest);
    var checkoutEmpBaseUrl = common.config.fo.host + constants.fo.methods.employer.checkout;

    var urlCheckout = checkoutEmpBaseUrl +
      '?temporaryToken=' +
      temporaryToken +
      '&price=' +
      receipt.negociatedPrice +
      '&iv=' +
      iv;
    var title = 'Payment request for your job\'s campaign';
    var name = (client.name) ? client.name : '';
    template.render({
      title: title,
      greetings: 'Hey ' + name + ',',
      client: client,
      urlCheckout: urlCheckout,
      receipt: receipt
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        client.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyClient(client, temporaryToken, iv, receipt);
};

MailDispatcher.longlistReady = function (client, job) {
  var notifyClient = function (client, job) {
    var jobsEmpBaseURL = common.config.fo.host + constants.fo.methods.employer.jobOffer;
    var template = new EmailTemplate(employersLonglistReady);

    var title = 'We finished crowdsourcing your candidates';
    var name = (client.name) ? client.name : '';
    template.render({
      title: title,
      greetings: 'Hey ' + name + ',',
      jobsEmpBaseURL: jobsEmpBaseURL,
      client: client,
      job: job
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        client.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyClient(client, job);
};

MailDispatcher.shortlistReady = function (client, job) {
  var notifyClient = function (client, job) {
    var jobsEmpBaseURL = common.config.fo.host + constants.fo.methods.employer.jobOffer;
    var template = new EmailTemplate(employersShortlistReady);

    var title = 'Your shortlist of candidates has been updated';
    var name = (client.name) ? client.name : '';
    template.render({
      title: title,
      greetings: 'Hey ' + name + ',',
      jobsEmpBaseURL: jobsEmpBaseURL,
      client: client,
      job: job
    }, function (err, renderedEmail) {
      if (err) {
        console.error(err);
        return;
      }
      MailDispatcher.sendEmail(common.config.emailAddresses.visagePlatform,
        client.email,
        title,
        renderedEmail,
        common.config.emailAddresses.visageTeam);
    });
  };

  notifyClient(client, job);
};

module.exports = MailDispatcher;