/*global soundManager:true, FB:true, $:true, _:true */

// force https
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.protocol = 'https:';
}

require([ "social/facebook", "social/salesforce" ], function(facebook, salesforce) {

  // templates
  var templates, sounds, socials = [ facebook, salesforce ];

  init();

  function init() {
    initTemplates();
    initSounds();
    initMenu();
    initDOMEventHandlers();
  }

  function initSounds() {
    sounds = {};
    // Setup SoundManagger
    // soundManager.setup({ url : '/lib/soundmanager2/swf/', onready : function(){} });
  }

  function initTemplates() {
    templates = {};
    $('script[type="text/x-underscore-tmpl"]').each(function() {
      var id = this.id;
      var tmpl = $(this).html();
      templates[id] = _.template(tmpl);
    });
  }

  function initMenu() {
    _.forEach(socials, function(social) {
      var li = $('<li />').append(
        $('<a href="#" />').text(social.name)
      ).appendTo($('#importMenu'));
      social.init(function() {
        social.isLoggedIn(function(loggedIn) {
          if (loggedIn) {
            li.find('a').click(function() {
              showGroupList(social);
            });
          } else {
            li.find('a').click(function() {
              if (social.getUserInfo()) {
                showGroupList(social);
              } else {
                social.authorize(function() {
                  showGroupList(social);
                });
              }
            });
          }
        });
      });
    });
  }

  function initDOMEventHandlers() {
    $("#groups").change(function() {
      var gid = $(this).val();
      var social = findSocial($(this).data('social-name'));
      showMemberList(social, gid);
    });
    $('#member-list').on('click', '.user-entry', function() {
      var checkbox = $(this).find('input[type=checkbox]');
      if (checkbox.is(':checked')) {
        checkbox.removeAttr('checked');
      } else {
        checkbox.attr('checked', 'checked');
      }
      $(this).toggleClass('checked');
    });
    $('#memberSelectAllLink').click(function() {
      $('#member-list .user-entry').addClass('checked');
    });
    $('#memberUnselectAllLink').click(function() {
      $('#member-list .user-entry').removeClass('checked');
    });
    $('#memberImportBtn').click(function() {
      var members = [];
      $('#member-list .user-entry.checked').each(function() {
        var el = $(this);
        members.push({
          id: el.data('id'),
          name: el.data('name'),
          pictureUrl: el.data('pictureUrl')
        });
      });
      $('#groupListDialog').modal('hide');
      addMembers(members);
    });

    $("#user-icons").on("click", ".user-icon", function() {
      var uid = $(this).data("userId");
      focusUser(findUser(uid));
    });
    $("#startBtn").click(function() {
      setDisplayPhase("spinning");
      startSpinning();
    });
    $("#shuffleBtn").click(function() {
      shuffle();
      renderUsers("#user-icons", users);
    });
    $("#deleteEntryBtn").click(deleteSelectedUser);

    $("#stopBtn").click(function() {
      setDisplayPhase("stopping");
      stopSpinning();
    });
    $("#entrySaveBtn").click(function() {
      var name = $('#inputName').val();
      var imageUrl = $('#inputImageUrl').val();
      if (!name) { return; }
      var user = {
        id: 'user-' + (Math.random()).toString().substring(2),
        name : name,
        pictureUrl : imageUrl || '/image/empty.jpg'
      };
      users.push(user);
      var html = templates.userIconTmpl(user);
      $("#user-icons").append(html);
      $('#addEntryDialog input').val('');
      $('#addEntryDialog').modal('hide');
    });
    $('#okBtn').click(function() {
      elected = null;
      fanfare.pause();
      try { fanfare.currentTime = 0; } catch(e) {}
      setDisplayPhase("waiting");
    });
  }

  function findSocial(name) {
    return _.find(socials, function(social){ return social.name === name; });
  }

  function setDisplayPhase(phase) {
    var body = $(document.body);
    var classes = (body.attr('class') || '').split(/\s/);
    _.forEach(classes, function(cls) {
      if (cls.indexOf('phase-') === 0) { body.removeClass(cls); } 
    });
    body.addClass("phase-" + phase);
  }

  function showGroupList(social) {
    $('#groupListDialog').modal('show');
    $('#member-list').empty();
    $('#groups').html('<option></option>')
                .data('social-name', social.name);
    social.getGroupList(function(groups) {
      _.forEach(groups, function(group) {
        $('#groups').append(
          $('<option>').val(group.id).text(group.name)
        );
      });
    });
  }

  function showMemberList(social, gid) {
    $('#member-list').empty();
    social.getMemberList(gid, function(members) {
      _.forEach(members, function(member) {
        var html = templates.userEntryTmpl(member);
        $('#member-list').append(html);
      });
    });
  }

  // array of users
  var users = [];

  function addMembers(members) {
    users = users.concat(members);
    var ids = {};
    users = _.filter(users, function(user) {
      if (ids[user.id]) { return false; }
      ids[user.id] = true;
      return true;
    });
    preloadUserPhotos(users, function() {
      shuffle();
      renderUsers("#user-icons", users);
      setDisplayPhase("waiting");
    });
  }

  function preloadUserPhotos(users, callback) {
    var cnt = users.length;
    if (cnt===0 && callback) { callback(); }
    var countdown = function() {
      cnt--;
      if (cnt === 0 && callback) { callback(); }
    };
    _.forEach(users, function(user) {
      var img = new Image();
      img.src = user.pictureUrl;
      img.onload = countdown;
    });
  }

  function renderUsers(el, users) {
    $(el).empty();
    _.forEach(users, function(user) {
      var html = templates.userIconTmpl(user);
      $(el).append(html);
    });
  }

  function shuffle() {
    users = _.map(
      _.map(users, function(a) { return [ Math.random(), a ]; })
       .sort(function(a1, a2) { return a1[0] > a2[0] ? 1 : -1; }),
      function(a) { return a[1]; }
    );
  }

  var papapa = $('#papapa-audio').get(0);
  var fanfare = $('#fanfare-audio').get(0);

  var spinning = false;
  var stopping = false;
  var stopwaits = null;
  var elected = null;
  var SPINNING_DEFAULT_INTERVAL = 100;
  var SPINNING_LAST_INTERVAL = 2000;

  function startSpinning() {
    shuffle();
    var i=0, len=users.length, nominated;
    var next = function() {
      if (stopwaits && stopwaits.length === 0) {
        finishSpinning(nominated);
        return;
      }
      nominated = users[i];
      focusUser(nominated);
      var interval = stopping ? stopwaits.shift() : SPINNING_DEFAULT_INTERVAL;
      if (spinning) {
        i = (i + 1) % len;
        setTimeout(next, interval);
      }
    };
    spinning = true;
    next();
  }

  function stopSpinning() {
    var delay = Math.floor(Math.random() * 1000);
    setTimeout(function() {
      stopping = true;
      var baseNum = 50;
      var num = 0.4 * baseNum + Math.floor(0.6 * Math.random() * baseNum);
      stopwaits = [];
      var diff = SPINNING_LAST_INTERVAL - SPINNING_DEFAULT_INTERVAL;
      for (var i=0; i<num; i++) {
        var x = i / num;
        var t = SPINNING_DEFAULT_INTERVAL + Math.floor(diff * Math.pow(x, 6));
        stopwaits.push(t);
      }
    }, delay);
  }

  function finishSpinning(user) {
    elected = user;
    spinning = false;
    stopping = false;
    stopwaits = null;
    setDisplayPhase("finished");
    fanfare.play();
  }

  function findUser(uid) {
    uid = String(uid);
    return _.find(users, function(attendee) {
      return attendee.id === uid;
    });
  }

  function focusUser(user) {
    $('#user-icons .user-icon').removeClass("selected");
    $('#user-icons #user-' + user.id).addClass("selected");
    $('#focused-user-win .image')
       .empty()
       .append($('<img>').attr('src', user.pictureUrl));
    $('#focused-user-win .name').text(user.name);
    papapa.pause();
    try { papapa.currentTime = 0; } catch(e) {}
    papapa.play();
  }

  function deleteSelectedUser() {
    var userIcon = $('#user-icons .selected').first();
    if (userIcon.length>0) {
      var uid = String(userIcon.data('userId'));
      users = _.reject(users, function(attendee) {
        return attendee.id === uid;
      });
      userIcon.remove();
    }
  }


});
