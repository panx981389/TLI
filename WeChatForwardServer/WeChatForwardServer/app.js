'use strict';

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();

var wechat = require('wechat');

var config = {
    token: '83f16297bf1ff0e884198e414102f998',
    appid: 'wx5cae0238664dd2ca',
    appsecret :'7dbee1945e8b6406510c44bfba7cb0eb',
    encodingAESKey: '7dbee1945e8b6406510c44bfba7cb0eb12345678901',
    checkSignature: false // ??????true?????????????????????????????????????????????false
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.query());

const PORT = 80;

var server = app.listen(PORT, function () {
    console.log("WeChat Forward Server listening on port " + PORT);
});

var io = require('socket.io').listen(server);

var client_socket = [];
io.on("connection", function (socket) {
    console.log("A user connected");
    client_socket.push(socket);

    socket.on('disconnect', () => {
        var index = client_socket.indexOf(socket);
        client_socket.splice(index, 1);
    });
});

app.use('/wechat', wechat(config, function (req, res, next) {
    for (let i = 0, len = client_socket.length; i < len; i++) {
        client_socket[i].emit("message", req.weixin);
        console.log(req.weixin);
        res.reply('success');
    }
}));

app.get('/test', function (req, res) {
    res.send('Test Success');
});