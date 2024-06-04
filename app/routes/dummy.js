var express = require('express'),
  router = express.Router(),
  bodyParser = require('body-parser'); //parses information from POST

router.use(bodyParser.urlencoded({extended: true}));

/* Just a dummy request to check token validity
 */
router.get('/', function (req, res, next) {
  res.sendStatus(200);
});

module.exports = router;
