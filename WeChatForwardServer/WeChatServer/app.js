'use strict';

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.query());

const PORT = 80;
const REMOTE_URL = "http://118.25.194.18";
//const REMOTE_URL = "http://localhost:4390";

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
        var replyMessage = {
            touser: weixin_message.FromUserName,
            text: 'Hello'
        };
        forward_socket.emit('data', replyMessage);
    });
});

