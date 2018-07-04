'use strict';

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();
var WechatAPI = require('wechat-api');

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

forward_socket.on('connect', function () {
    console.log('Connect to forward server');

    forward_socket.on('message', (weixin_message) => {
        console.log(weixin_message);

        api.sendText(weixin_message.FromUserName, 'Hello World!', function (err, data, res) {
            if (err) {
                console.log(err);
                return;
            }
        });
    });
});

