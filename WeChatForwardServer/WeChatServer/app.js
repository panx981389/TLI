'use strict';

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();
var WechatAPI = require('wechat-api');

const JabberBot = require('./botkit/JabberBot.js');
const xml = require('@xmpp/xml');

// database configurations
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/tliproject');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('mongodb connected');
});

var SessionModel = require('./model/MessageModel.js').SessionModel;
var MessageModel = require('./model/MessageModel.js').MessageModel;

var controller = JabberBot({
    json_file_store: './jabberbot/'
});

var bot = controller.spawn({
    client: {
        jid: 'xinpa2@jabberqa.cisco.com',
        password: 'cisco123!@#',
        host: "164-34-CUP-TJ.jabberqa.cisco.com",
        port: 5222
    }
});


const appid = 'wx5cae0238664dd2ca';
const appsecret = '7dbee1945e8b6406510c44bfba7cb0eb';
var api = new WechatAPI(appid, appsecret);


var isProduction = process.env.NODE_ENV === 'production';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.query());

app.use(require('./routes'));
app.use(express.static(__dirname + '/public'));

// development error handler
// will print stacktrace
if (!isProduction) {
    app.use(function(err, req, res, next) {
      console.log(err.stack);
  
      res.status(err.status || 500);
  
      res.json({'errors': {
        message: err.message,
        error: err
      }});
    });
  }
  
  // production error handler
  // no stacktraces leaked to user
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({'errors': {
      message: err.message,
      error: {}
    }});
  });

const PORT = 80;
var server = app.listen(PORT, function () {
    console.log("WeChat Forward Server listening on port " + PORT);
});
var io = require('socket.io').listen(server);

var socket_user_map = new Map();

var client_socket = [];
io.on("connection", function (socket) {
    console.log("A user connected");
    client_socket.push(socket);
    
    socket.on('disconnect', () => {
        var index = client_socket.indexOf(socket);
        client_socket.splice(index, 1);
        socket_user_map.delete(socket);
    });

    //When new jabber connect
    //Associate a input jid with the socket and then send back all the sessions not hangup
    socket.on('add user', (username)=>{
        socket_user_map.set(socket, username);

        SessionModel.find({session_state : [0, 1]}, function(err, sessions){
            socket.emit('all message', sessions);
        });    
    });

    //hangup means jabber end session with the wechat customer
    //this operation will change session_state to 2
    //and notify client to remove this session from their list
    socket.on('hangup', (session_id)=>{
        var pickup_jid = socket_user_map.get(socket);
        if (!pickup_jid)
            return;

        SessionModel.findById(session_id).exec(function(err, session){
            if (err)
            {
                console.log(err);
                return;
            }

            session.session_state = 2;
            session.save(function(err, save_session){
                if (err)
                {
                    console.log(err);
                    return;
                }
                client_socket.forEach(function(socket)                                {
                    socket.emit('remove message', save_session);
                });
            });
        });
    });

    //pickup means jabber start chat session with the wechat customer
    //this operation will change session_state to 1 
    //and jabber bot will send all message associate with session to the jabber user
    socket.on('pickup', (session_id)=>{
        var pickup_jid = socket_user_map.get(socket);
        if (!pickup_jid)
            return;

        SessionModel.findById(session_id).populate('messages').exec(function(err, session){
            if (err)
            {
                console.log(err);
                return;
            }
            
            var roomname = session.wechat_id.toLowerCase() +'_' + pickup_jid.split('@')[0];
            bot.startGroupChat(roomname, pickup_jid, function(){
                session.messages.forEach((message)=>{
                    if (message.from_webchat)
                    {
                        bot.say({
                            text: message.content,
                            user: roomname + '@'+ bot.getMUCServer(),
                             group: true,
                             }); 
                    }
                });
                
            });

            session.jabber_id = pickup_jid;
            session.session_state = 1;
            session.save(function(err, save_session){
                if (err)
                {
                    console.log(err);
                    return;
                }
                client_socket.forEach(function(socket)                                {
                    socket.emit('pick message', save_session);
                });
            });
        });        
    });
});


//When receive wechat message.
//Find the session for the wechat customer
//If session_state == 1 exist, the session between this wechat customer and a jabber jid is created, save the message to the session and send the message to the jabber
//If session_state == 0 exist, the session for the wechat customer has created, but not bind to a jabber jid. Save the message 
//If session not exist, create the session, and notifer client to update the session list.
const REMOTE_URL = "http://118.25.194.18";
var forward_socket = require('socket.io-client')(REMOTE_URL);
forward_socket.on('connect', function () {
    console.log('Connect to forward server');

    forward_socket.on('message', (weixin_message) => {
        console.log(weixin_message);
        if (weixin_message.MsgType != 'text')
            return;

        var messageData = new MessageModel({
            from_webchat:true,
            type:weixin_message.MsgType,
            content:weixin_message.Content,
            id: weixin_message.MsgId.toString()
        });

        SessionModel.findOne({wechat_id:weixin_message.FromUserName, session_state : 1}, function(err, session){
            if (err)
            {
                console.log(err);
                return;
            }
            if (session)
            {
                messageData.save( function(err, message) {
                    if (err)
                    {
                        console.log(err)
                        return;
                    }
                    session.last_message = message.content;
                    session.messages.push(message);
                    session.save();
                    client_socket.forEach(function(socket)
                    {
                        socket.emit('update message', session);
                    });
                });
                var roomname = weixin_message.FromUserName.toLowerCase() +'_' + session.jabber_id.split('@')[0];
                bot.startGroupChat(roomname, session.jabber_id, function(){
                    bot.say({
                        text: weixin_message.Content,
                        user: roomname + '@'+ bot.getMUCServer(),
                         group: true,
                         }); 
                });        
            }
            else
            {
                SessionModel.findOne({wechat_id:weixin_message.FromUserName, session_state : 0}, function(err, session){
                    if (err)
                    {
                        console.log(err);
                        return;
                    }
                        
                    if (session)
                    {
                        messageData.save( function(err, message) {
                            if (err)
                            {
                                console.log(err)
                                return;
                            }
                            session.last_message = message.content;
                            session.messages.push(message);
                            session.save();

                            client_socket.forEach(function(socket)
                            {
                                socket.emit('update message', session);
                            });
                        });
                    }
                    else
                    {
                        messageData.save( function(err, message) {
                            if (err)
                            {
                                console.log(err)
                                return;
                            }
                            var sessionData = new SessionModel({
                                wechat_id: weixin_message.FromUserName,
                                jabber_id: '',
                                session_state: 0,
                                last_message : messageData.content,
                                messages: [
            
                                ],
                              });

                              sessionData.messages.push(message);
                              sessionData.save(function(err, newsession){
                                if (err)
                                {
                                    console.log(err)
                                    return;
                                }
            
                                client_socket.forEach(function(socket)
                                {
                                    socket.emit('new message', newsession);
                                });
                              });
                        });                        
                    }
                });
            }
        });        
    });
});

//When jabber bot receive XMPP message from jabber, find session with the jabber_id, 
// append message to this session and then send the message to wechat customer.
controller.hears([/.*/i], ['direct_mention', 'self_message', 'direct_message', 'plain_group_message'], function (bot, message) {
    var text = message.text;
    var from = message.from_jid;
    SessionModel.findOne({jabber_id:from, session_state : 1}, function(err, session){
        if (err)
        {
            console.log(err);
            return;
        }

        if (!session)
            return;

        var messageData = new MessageModel({
                from_webchat:false,
                type:'text',
                content:text                
            });
            
        messageData.save( function(err, message) {
                if (err)
                {
                    console.log(err)
                    return;
                }
                session.last_message = text;
                session.messages.push(message);
                session.save();
                client_socket.forEach(function(socket)
                {
                    socket.emit('update message', session);
                });
            });

        api.sendText(session.wechat_id, text, function (err, data, res) {
            if (err) {
                console.log(err);
                return;
            }
        });
    });
});


