var mongoose = require('mongoose');
var db = require('./db');

var voucherSchema = new mongoose.Schema({
  user_email: String,
  code: String,
  discountValue: Number,
  discountPercentage: Number,
  expires: String
});
db.model('Voucher', voucherSchema);