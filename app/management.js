var ManagementClient = require('auth0').ManagementClient;

var management = new ManagementClient({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJkSWtSd0VVNURINUZ3MGwxbDdtZGRhMTdZaXVDWnVmRyIsInNjb3BlcyI6eyJ1c2VycyI6eyJhY3Rpb25zIjpbInJlYWQiXX19LCJpYXQiOjE0NTY3MjkwODAsImp0aSI6ImU0NjQ1MDMyNmZhOGMxYzhkMWRiMmMzODVmMmQ2OGJlIn0.kED-MZyzz6JReaCKTeXwWrkQyHR1fPf97MbZDAEuP74',
  domain: 'visage.auth0.com'
});

module.exports = management;