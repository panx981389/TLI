const Botkit = require('botkit').core;
const Stanza = require('node-xmpp-client').Stanza;
const Element = require('node-xmpp-client').Element;
const GroupManager = require('./JabberGroupManager.js')
const uuidv1 = require('uuid/v1');

function JabberBot(configuration) {
    // Create a core botkit bot
    var controller = Botkit(configuration || {});


    function toUTCDateTimeString(date) {
        var yyyy = date.getUTCFullYear();
        var mm = date.getUTCMonth() < 9 ? "0" + (date.getUTCMonth() + 1) : (date.getUTCMonth() + 1); // getMonth() is zero-based
        var dd = date.getUTCDate() < 10 ? "0" + date.getUTCDate() : date.getUTCDate();
        var hh = date.getUTCHours() < 10 ? "0" + date.getUTCHours() : date.getUTCHours();
        var min = date.getUTCMinutes() < 10 ? "0" + date.getUTCMinutes() : date.getUTCMinutes();
        var ss = date.getUTCSeconds() < 10 ? "0" + date.getUTCSeconds() : date.getUTCSeconds();
        return "".concat(yyyy).concat('-').concat(mm).concat('-').concat(dd).concat('T').concat(hh).concat(':').concat(min).concat(':').concat(ss);
    };

    controller.middleware.format.use(function (bot, message, platform_message, next) {
        // clone the incoming message
        for (var k in message) {
            platform_message[k] = message[k];
        }
        next();
    });

    // customize the bot definition, which will be used when new connections
    // spawn!
    controller.defineBot(function (botkit, config) {
        var xmpp = require('simple-xmpp');

        var group_chat_data = {};
        group_chat_data.mucserver = 'None';
        group_chat_data.room_map = new Map();
        group_chat_data.room_callback_map = new Map();

        var bot = {
            type: 'xmpp',
            botkit: botkit,
            config: config || {},
            client_jid: config.client.jid,
            utterances: botkit.utterances,
        };

        GroupManager(config, xmpp, bot, controller);

        function request_roster() {
            let roster_stanza = new Stanza('iq', { 'from': config.client, 'type': 'get' });
            roster_stanza.c('query', { xmlns: 'jabber:iq:roster' });
            xmpp.conn.send(roster_stanza);
        }

        xmpp.on('online', function (data) {
            let user = data.jid.user;
            console.log(toUTCDateTimeString(new Date()) + ':Connected with JID: ' + data.jid.user);
            console.log('Yes, I\'m connected!');
            request_roster();

            group_chat_data.myFullJid = config.client.jid;
            var stanza = new Stanza('iq', { to: data.jid.domain, type: 'get', id: 'disco_tc_items' });
            stanza.c('query', { xmlns: 'http://jabber.org/protocol/disco#items' });
            xmpp.conn.send(stanza);

            // send whitespace to keep the connection alive
            // and prevent timeouts
            setInterval(function () {
                xmpp.conn.send(' ');
            }, 1800000);
        });

        xmpp.on('close', function () {
            console.log(toUTCDateTimeString(new Date()) + ':connection has been closed!');
            process.exit();
        });

        xmpp.on('error', function (err) {
            console.log(toUTCDateTimeString(new Date()) + ":" + err);
            process.exit();
        });

        xmpp.on('subscribe', function (from) {
            xmpp.acceptSubscription(from);
            console.log(toUTCDateTimeString(new Date()) + ':accept subscribe from:' + from);
            controller.trigger('subscribe', [bot, from]);
        });

        xmpp.on('unsubscribe', function (from) {
            console.log(toUTCDateTimeString(new Date()) + ':accept unsubscribe from:' + from);
            xmpp.acceptUnsubscription(from);
        });

        function findBotJid(jid) {
            return matchBotJid(jid, bot.client_jid);
        }

        function matchBotJid(jid_left, jid_right) {
            return jid_left.toLowerCase() === jid_right.toLowerCase();
        }

        function IsBotMentioned(message) {
            let mention_jids = extractMentionJids(message);
            if (mention_jids.find(findBotJid)) {
                return true;
            }
            return false;
        }

        function extractMentionJids(message) {
            let direct_mention_reg = /href="xmpp:\s?(\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+)\s?"/ig;
            let email_reg = /\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+/i;
            let match = message.stanza.toString().match(direct_mention_reg);
            let mention_jids = [];
            if (match) {
                for (let i = 0; i < match.length; i++) {
                    let jid_match = match[i].match(email_reg);
                    if (jid_match) {
                        let jid = jid_match[0];
                        mention_jids.push(jid);
                    }
                }
            }
            return mention_jids;
        }

        controller.on('message_received', function (bot, message) {
            if (message.group == false) {
                if (matchBotJid(message.user, bot.client_jid)) {
                    controller.trigger('self_message', [bot, message]);
                    return false;
                } else {
                    controller.trigger('direct_message', [bot, message]);
                    return false;
                }
            }
            else {
                if (IsBotMentioned(message)) {
                    if (matchBotJid(bot.client_jid, message.from_jid)) {
                        controller.trigger('self_message', [bot, message]);
                    }
                    else {
                        controller.trigger('direct_mention', [bot, message]);
                    }
                    return false;
                }
                else
                {
                    if (!matchBotJid(bot.client_jid, message.from_jid)) {
                        controller.trigger('plain_group_message', [bot, message]);
                        return false;
                    }
                }
            }
        });

        xmpp.on('stanza', function (stanza) {
            if (stanza.is('message')) {
                if (stanza.attrs.type == 'chat') {
                    var body = stanza.getChild('body');
                    if (body) {
                        var message = body.getText();
                        var from = stanza.attrs.from;
                        var id = from.split('/')[0];

                        var xmpp_message = {};
                        xmpp_message.user = from;
                        xmpp_message.text = message;
                        xmpp_message.group = false;
                        xmpp_message.stanza = stanza;
                        xmpp_message.channel = 'chat',
                            controller.ingest(bot, xmpp_message, null);
                    }
                }
                else if (stanza.attrs.type == 'groupchat') {
                    var body = stanza.getChild('body');
                    if (body) {
                        let message = body.getText();
                        let from = stanza.attrs.from;
                        let from_split = from.split('/');
                        let conference = from_split[0];
                        let from_jid = null;
                        if (from_split.length > 1)
                            from_jid = from_split[1];
                        if (!from_jid)
                            return;

                        let history_reg = /xmlns="http:\/\/www.jabber.com\/protocol\/muc#history"/i;
                        if (history_reg.test(stanza.toString()))
                            return false;

                        var xmpp_message = {};
                        xmpp_message.user = conference;
                        xmpp_message.text = message;
                        xmpp_message.group = true;
                        xmpp_message.channel = 'groupchat';
                        xmpp_message.from_jid = from_jid;
                        xmpp_message.stanza = stanza;
                        controller.ingest(bot, xmpp_message, null);
                    }
                }
            }
            if (stanza.is('iq')) {

                if (stanza.id == 'disco_tc_items') {
                    console.log('\n');
                    console.log('>> recv:' + stanza);
                    console.log('\n');
                    console.log(stanza.getChild('query').children[0].name);
                    group_chat_data.mucserver = stanza.getChild('query').children[0].attrs.jid;
                    console.log(group_chat_data.mucserver);
                    return;
                }
                handleGetRoomConfiguration(stanza);
                
            }
            if (stanza.is('presence')) {
                if (group_chat_data.mucserver != 'None') {
                    handleGroupChatStarted(stanza);                    
                }
            }
        });

        function handleGetRoomConfiguration(stanza)
        {
            if (stanza.id != 'get_room_configuration_form')
                return;
            console.log('\n');
            console.log('>> recv:' + stanza);
            console.log('\n');
 
            var iq = new Stanza('iq', { to: stanza.attrs.from, type: 'set', id: 'set_room_configuration' });
            var child = iq.c('query', { xmlns: 'http://jabber.org/protocol/muc#owner' }).c('x', { xmlns: 'jabber:x:data', type: 'submit' });

            var element = new Element('field', { type: 'text-single', var: 'muc#roomconfig_roomname' });
            element.children.push(new Element('value').t('xxx'));

            child.children.push(element);
            console.log(">> send:" + iq.toString());

            xmpp.conn.send(iq); 

                // send invite
            var invitee = group_chat_data.room_map.get(stanza.attrs.from.toLowerCase());
            var message = new Stanza('message', { to: stanza.attrs.from });
            message.c('x', { xmlns: 'http://jabber.org/protocol/muc#user' }).c('invite', { to: invitee }).c('reason');

            console.log(">> send:" + message.toString());
            xmpp.conn.send(message);

            var cb = group_chat_data.room_callback_map.get(stanza.attrs.from.toLowerCase());
            if (cb)
            {
                cb();
            }
        }

        function handleGroupChatStarted(stanza)
        {
            let group_type = stanza.getChild('x', 'http://jabber.org/protocol/muc#user');
            if (!group_type)
                return;

            let item = group_type.getChild('item');
            if (!item)
                return;

            let jid = item.attrs.jid;
            if (!jid)
                return;
            let bareJid = jid.split('/')[0];
            if (bareJid.toLowerCase() !== bot.client_jid.toLowerCase())
                return;

            let room_id = stanza.attrs.from;
            console.log('\n');
            console.log('>> recv*****:' + stanza);

            var stanza = new Stanza('iq', { to: room_id.split('/')[0], type: 'get', id: 'get_room_configuration_form' });
            stanza.c('query', { xmlns: 'http://jabber.org/protocol/muc#owner' });
            console.log('>> send:' + stanza.toString());
            xmpp.conn.send(stanza);
        }

        bot.startConversation = function (message, cb) {
            botkit.startConversation(this, message, cb);
        };

        bot.createConversation = function (message, cb) {
            botkit.createConversation(this, message, cb);
        };

        bot.send = function (message, cb) {
            if (message.stanza) {
                message.stanza.attrs.id = uuidv1();
                xmpp.conn.send(message.stanza);
            }
            else {
                var stanza = new Stanza('message', { to: message.user, type: (message.group ? 'groupchat' : 'chat'), id: uuidv1() });
                stanza.c('body').t(message.text);
                xmpp.conn.send(stanza);
            }

            if (cb) {
                cb();
            }
        };

        bot.reply = function (src, resp, cb) {
            var msg = {};

            if (typeof (resp) == 'string') {
                msg.text = resp;
            } else {
                msg = resp;
            }
            msg.user = src.user;
            msg.channel = src.channel;
            msg.group = src.group;

            bot.say(msg, cb);
        };

        bot.findConversation = function (message, cb) {
            botkit.debug('CUSTOM FIND CONVO', message.user, message.channel);
            for (var t = 0; t < botkit.tasks.length; t++) {
                for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
                    if (
                        botkit.tasks[t].convos[c].isActive() &&
                        botkit.tasks[t].convos[c].source_message.user == message.user &&
                        botkit.tasks[t].convos[c].source_message.channel == message.channel
                    ) {
                        botkit.debug('FOUND EXISTING CONVO!');
                        cb(botkit.tasks[t].convos[c]);
                        return;
                    }
                }
            }

            cb();
        };

        bot.startGroupChat = function (roomName, invite_jid, cb) {
            var roomjid = roomName + '@' + group_chat_data.mucserver;
            group_chat_data.room_map.set(roomjid.toLowerCase(), invite_jid.split('/')[0]);
            group_chat_data.room_callback_map.set(roomjid.toLowerCase(), cb);
            var stanza = new Stanza('presence', { to: roomjid + '/' + group_chat_data.myFullJid });
            stanza.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
            console.log('>> send:' + stanza.toString());
            xmpp.conn.send(stanza);
            console.log('\n');
        };

        bot.getMUCServer = function() {
            return group_chat_data.mucserver;
        }

        xmpp.connect(config.client);
        return bot;
    });

    controller.startTicking();

    return controller;
}

module.exports = JabberBot;
