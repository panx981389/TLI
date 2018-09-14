$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  // Sets the client's username
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  const addChatMessages = (datas, options) => {
    datas.forEach(function(data){
      addChatMessage(data, options);
    });
  }
  
  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {
    var $headerBodyDiv = $('<img class="headerBody">').attr("src",data.wechat_headimgurl).attr("width", '35').attr("height", '35');
    var $userBodyDiv = $('<span class="userBody">')
      .text(data.wechat_nickname);
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.last_message);
    if (data.session_state == 0)
    {
      var $pickupDiv = $('<span class="callButton">');
      $pickupDiv.click(()=>{
        socket.emit('pickup', data.id);
      });
      var $messageDiv = $('<li class="message"/>').attr('id', data.id)
       .append($headerBodyDiv, $userBodyDiv, $messageBodyDiv, $pickupDiv);

      addMessageElement($messageDiv, options);
    }
    else if (data.session_state == 1 && data.jabber_id == username)
    {
      var $hangupDiv = $('<span class="endCallButton">');
      $hangupDiv.click(()=>{
        socket.emit('hangup', data.id);
      });
      var $messageDiv = $('<li class="message"/>').attr('id', data.id)
       .append($headerBodyDiv, $userBodyDiv, $messageBodyDiv, $hangupDiv);

      addMessageElement($messageDiv, options);
    }    
  };

  const removeChatMessage = (data) =>{
    var message = $('#' + data.id);
    if (message)
    {
      message.remove();
    }
  };

  const updateChatMessage = (data) =>{
    var message = $('#' + data.id);
    if (message)
    {
      message.children(".messageBody").text(data.last_message);
    }
  }; 


  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  const cleanInput = (input) => {
    return $('<div/>').text(input).html();
  }

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (!username) {
        setUsername();
      }
    }
  });
  // Socket events

  const SetNotificationBadge = (number) => {
    window.external.SetNotificationBadge(number.toString());
  };

  var all_datas = [];
  const removeData = (data) =>{
    for(var i=0; i<all_datas.length;i++){
      if (data.id == all_datas[i].id)
      {
        all_datas.splice(i, 1);
        return;
      }
    }
  };

  const addData = (data) =>{
    for(var i=0; i<all_datas.length;i++){
      if (data.id == all_datas[i].id)
      {
        return;
      }
    }
    all_datas.push(data);
  };
  // Whenever the server emits 'new message', update the chat body
  socket.on('all message', (datas) => {
    addChatMessages(datas);
    all_datas = datas;
    SetNotificationBadge(all_datas.length);
  });

  socket.on('new message', (data) => {
    addChatMessage(data);
    addData(data);

    SetNotificationBadge(all_datas.length);
  });

  socket.on('remove message', (data) => {
    removeChatMessage(data);
    removeData(data);
    SetNotificationBadge(all_datas.length);
  });

  socket.on('update message', (data) => {
    updateChatMessage(data);
  });

  socket.on('pick message', (data) => {
    removeChatMessage(data);
    addChatMessage(data);
  });

  socket.on('disconnect', () => {
    log('you have been disconnected');
  });

  socket.on('reconnect', () => {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    log('attempt to reconnect has failed');
  });

});
