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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.query());



const PORT = 80;
const REMOTE_URL = "http://118.25.194.18";

var server = app.listen(PORT, function () {
    console.log("WeChat Forward Server listening on port " + PORT);
});
var io = require('socket.io').listen(server);

var forward_socket = require('socket.io-client')(REMOTE_URL);

var client_socket = [];
io.on("connection", function (socket) {
    console.log("A user connected");
    client_socket.push(socket);

    socket.on('disconnect', () => {
        var index = client_socket.indexOf(socket);
        client_socket.splice(index, 1);
    });
});

var weinxin_user_map = new Map();

forward_socket.on('connect', function () {
    console.log('Connect to forward server');

    forward_socket.on('message', (weixin_message) => {
        console.log(weixin_message);
        var weixin_user = weixin_message.FromUserName;

        weinxin_user_map.set('xinpa3', weixin_user);
        bot.startGroupChat(weixin_user, 'xinpa3@jabberqa.cisco.com', function(){
            bot.say({
                text: weixin_message.Content,
                user: weixin_user + '@'+ bot.getMUCServer(),
                 group: true,
                 }); 
        });        
    });
});

controller.hears([/.*/i], ['direct_mention', 'self_message', 'direct_message', 'plain_group_message'], function (bot, message) {
    var text = message.text;
    var from = message.from_jid;
    var weixin_user = weinxin_user_map.get(from.split('@')[0]);
    if (!weixin_user || weixin_user.length == 0)
        weixin_user = message.user.split('@')[0];
    api.sendText(weixin_user, text, function (err, data, res) {
        if (err) {
            console.log(err);
            return;
        }
    });
});


