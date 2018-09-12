var mongoose = require('mongoose');

var SessionMessageSchema = new mongoose.Schema({
    session_id : String,
    wechat_id : String,
    jabber_id:String,
    session_state : Number,
    messages : [{
        from:String,
        to:String,
        type:String,
        content:String,
        id : String
    }],
  });

  var SessionMessage = mongoose.model('SessionMessage', SessionMessageSchema);
module.exports = SessionMessage;