'use strict';

module.exports = function (indexableCollection) {
  var count =0;
  var stream = indexableCollection.synchronize();

  stream.on('data', function (err) {
    if (err) {
      console.error(err);
    }
    count++;
  });

  stream.on('close', function () {
    console.log(count, ' document(s) indexed');
  });

  stream.on('error', function (err) {
    console.log(err);
  });
};
