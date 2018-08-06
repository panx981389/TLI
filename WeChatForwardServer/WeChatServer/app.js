'use strict';

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();
var WechatAPI = require('wechat-api');

const Botkit = require('botkit');
const xml = require('@xmpp/xml');

// database configurations
var MongoClient = require('mongodb').MongoClient;
var dbConnectionUrl = 'mongodb://localhost:27017/tliproject';
var dbCollection = 'messages';


var controller = Botkit.jabberbot({
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

var weixin_user;

forward_socket.on('connect', function () {
    console.log('Connect to forward server');

    forward_socket.on('message', (weixin_message) => {
        console.log(weixin_message);
        weixin_user = weixin_message.FromUserName;
        var msg = {
            text: weixin_message.Content,
            user: 'xinpa@jabberqa.cisco.com'
        };

        bot.say(msg);
        
        // save message to mongodb
        var documents = [{
            'toUser': weixin_message.ToUserName,
            'fromUser': weixin_message.FromUserName,
            'createTime': weixin_message.CreateTime,
            'msgType': weixin_message.MsgType,
            'content': weixin_message.Content,
            'msgId': weixin_message.MsgId
        }];

        MongoClient.connect(dbConnectionUrl, function(error, db) {
            if(error) {
                console.log("Connection to server failed");
                return;
            }
  
            console.log("Connected correctly to server");

            var collection = db.collection(dbCollection);
            collection.insert(documents, function(error, result) {
                if(!error) {
                    console.log("Success :" + result.ops.length + " chapters inserted!");
                } else {
                    console.log("Some error was encountered!");
                }
                db.close();
            });
        });
    });
});

controller.hears([/.*/i], ['direct_mention', 'self_message', 'direct_message'], function (bot, message) {
    var text = message.text;
    if (!weixin_user)
        return;
    api.sendText(weixin_user, text, function (err, data, res) {
        if (err) {
            console.log(err);
            return;
        }
    });
});


