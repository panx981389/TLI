var mongoose = require('mongoose');

var MessageSchema = new mongoose.Schema({
    from_webchat : Boolean,
    type:String,
    content:String,
    id : String
});

var MessageModel = mongoose.model('Message', MessageSchema);

var SessionSchema = new mongoose.Schema({
    wechat_id : String,
    jabber_id:String,
    session_state : Number,
    last_message: String,
    messages : [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  });
  

SessionSchema.methods.toJSON = function(){
    return {
      id: this._id,
      wechat_id: this.wechat_id,
      jabber_id: this.jabber_id,
      session_state: this.session_state,
      last_message: this.last_message
    };
  };

var SessionModel = mongoose.model('Session', SessionSchema);

module.exports = {SessionModel, MessageModel};
