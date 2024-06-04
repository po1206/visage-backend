'use strict';

var common = require('../common'),
  merge = require('merge');

var confidentiality = require('../data/confidentiality');

var TypeformMapper = {
  toJob: function (formResponses) {

    var clientId = formResponses.hidden.id;
    if (formResponses.answers) {
      var answersById = {};
      formResponses.answers.forEach(function (answer) {
        var answerValue;
        switch (answer.type) {
          case 'text' :
            answerValue = answer.text;
            break;
          case 'choice' :
            answerValue = answer.choice.label;
            break;
          case 'choices' :
            var choices = [];
            if(answer.choices.labels) {
              choices = answer.choices.labels;
            }
            if (answer.choices.other){
              choices.push(answer.choices.other) ;
            }
            answerValue = choices.join(', ');
            break;
          case 'boolean' :
            answerValue = answer.boolean;
            break;
        }
        answersById[answer.field.id] = answerValue;
      });
      var jobTransitionObject = merge({},
        common.config.thirdParties.typeform.employers.newJob.fields);
      for (var fieldName in jobTransitionObject) {
        if (jobTransitionObject.hasOwnProperty(fieldName)) {
          jobTransitionObject[fieldName] = answersById[jobTransitionObject[fieldName]];
        }
      }

      var job = {};
      job.employer_id = clientId;
      job.status = 'Draft';
      job.title = jobTransitionObject.jobTitle;
      job.industry = jobTransitionObject.jobIndustry;
      job.role = jobTransitionObject.jobRole;
      job.location = jobTransitionObject.jobLocation;
      job.city = jobTransitionObject.city;
      job.description = jobTransitionObject.jobDescription;
      job.salaryRange = jobTransitionObject.salaryRange;

      //FIXME We really need Typeform to allow responses id instead of having to compare the
      // strings...
      switch (jobTransitionObject.confidentiality) {
        case 'You can advertise the job but don\'t mention the company':
          job.confidentiality = 'NO_MENTION';
          break;
        case 'No, it\'s confidential' :
          job.confidentiality = 'NO_ADVERTISE';
          break;

      }

      job.requirements = {};
      job.requirements.resLocation = jobTransitionObject.jobLocation ;
      if (jobTransitionObject.sourcingExternally) {
        job.requirements.resLocation += ', ' + jobTransitionObject.candidateLocation;
      }

      job.requirements.salary = jobTransitionObject.salaryRange;
      job.requirements.candidateDescription = jobTransitionObject.candidateDescription;

      job.requirements.jobTitle = jobTransitionObject.candidateJobTitles;
      job.requirements.employer = jobTransitionObject.previousCompanies;
      job.requirements.yearsExp = jobTransitionObject.yearsExp;
      job.requirements.degree = jobTransitionObject.degree;
      job.requirements.certifications = jobTransitionObject.candidateCertifications;
      job.requirements.miscellaneous = jobTransitionObject.miscellaneous;

      return job;
    }

  }
};

module.exports = TypeformMapper;