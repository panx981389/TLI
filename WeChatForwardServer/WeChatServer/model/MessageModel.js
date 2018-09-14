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
    wechat_nickname:String,
    wechat_headimgurl : String,
    last_message: String,
    messages : [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  });
  

SessionSchema.methods.toJSON = function(){
    return {
      id: this._id,
      wechat_id: this.wechat_id,
      jabber_id: this.jabber_id,
      session_state: this.session_state,
      wechat_nickname:this.wechat_nickname,
      wechat_headimgurl: this.wechat_headimgurl,
      last_message: this.last_message
    };
  };

var SessionModel = mongoose.model('Session', SessionSchema);

module.exports = {SessionModel, MessageModel};
