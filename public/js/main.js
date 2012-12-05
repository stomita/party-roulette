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
    initEventHandlers();
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
    $('#clear-menu').click(clearMembers);
  }

  function initEventHandlers() {
    initSocialSelectDialogEventHandlers();
    initGroupListDialogEventHandlers();
    initMainControlEventHandlers();
    initNominationWindowEventHandlers();
    initAddEntryDialogEventHandlers();
  }

  function initSocialSelectDialogEventHandlers() {
    _.forEach(socials, function(social) {
      var btn = $('<button class="btn"/>')
        .text(social.name)
        .css("background-image", social.icon ? "url("+social.icon+")" : null)
        .attr('disabled', 'disabled')
        .appendTo($('#socials'));
      social.init(function() {
        social.isLoggedIn(function(loggedIn) {});
        btn.removeAttr('disabled');
        btn.click(function() {
          if (social.getUserInfo()) {
            showGroupList(social);
          } else {
            social.authorize(function(loggedIn) {
              if (loggedIn) { showGroupList(social); }
            });
          }
        });
      });
    });
  }

  function initGroupListDialogEventHandlers() {
    $("#groups").change(function() {
      var gid = $(this).val();
      var social = findSocial($(this).data('social-name'));
      showMemberList(social, gid);
    });
    $('#sign-out-link').click(function() {
      var social = findSocial($(this).data('social-name'));
      social.logout(function() { $('.modal').modal('hide'); });
    });
    $('#member-list').on('click', '.user-entry', function() {
      $(this).toggleClass('checked');
    });
    $('#member-select-all-link').click(function() {
      $('#member-list .user-entry').addClass('checked');
    });
    $('#member-unselect-all-link').click(function() {
      $('#member-list .user-entry').removeClass('checked');
    });
    $('#member-import-btn').click(function() {
      var members = [];
      $('#member-list .user-entry.checked').each(function() {
        var el = $(this);
        members.push({
          id: el.data('id'),
          name: el.data('name'),
          picture: {
            url: el.data('pictureUrl')
          },
          thumbnail: {
            url: el.data('thumbnailUrl')
          }
        });
      });
      $('#group-list-dialog').modal('hide');
      addMembers(members);
    });
  }

  function initMainControlEventHandlers() {
    $("#user-icons").on("click", ".user-icon", function() {
      var uid = $(this).data("userId");
      focusUser(findUser(uid));
    });
    $("#start-btn").click(function() {
      setDisplayPhase("spinning");
      startSpinning();
    });
    $("#shuffle-btn").click(function() {
      shuffle();
      renderUsers("#user-icons", users);
    });
    $("#delete-entry-btn").click(deleteSelectedUser);
  }

  function initNominationWindowEventHandlers() {
    $("#stop-btn").click(function() {
      setDisplayPhase("stopping");
      stopSpinning();
    });

    $('#ok-btn').click(function() {
      elected = null;
      fanfare.pause();
      try { fanfare.currentTime = 0; } catch(e) {}
      setDisplayPhase("waiting");
    });
  }

  function initAddEntryDialogEventHandlers() {
    $("#entry-save-btn").click(function() {
      var name = $('#entry-input-name').val();
      var imageUrl = $('#entry-input-image-url').val();
      if (!name) { return; }
      var user = {
        id: 'user-' + (Math.random()).toString().substring(2),
        name : name,
        picture : {
          url : imageUrl || '/image/empty.jpg'
        },
        thumbnail : {
          url : imageUrl || '/image/empty.jpg'
        }
      };
      users.push(user);
      var html = templates.userIconTmpl(user);
      var entry = $(html);
      $("#user-icons").append(entry);
      fitImage(entry.find("img"), user.picture);
      $('#add-entry-dialog input').val('');
      $('#add-entry-dialog').modal('hide');
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
    $('.modal').modal('hide');
    $('#group-list-dialog').modal('show');
    $('#member-list').empty();
    $('#groups').html('<option></option>')
                .data('social-name', social.name)
                .attr('disabled', 'disabled');
    $('#sign-out-link').data('social-name', social.name);
    $('#member-import-btn').attr("disabled", "disabled");
    social.getGroupList(function(groups) {
      _.forEach(groups, function(group) {
        $('#groups').append(
          $('<option>').val(group.id).text(group.name)
        );
      });
      $('#groups').removeAttr('disabled');
    });
  }

  function showMemberList(social, gid) {
    $('#member-list').empty();
    $('#member-loading-image').show();
    $('#member-selection-ctrl').hide();
    social.getMemberList(gid, function(members) {
      _.forEach(members, function(member) {
        var html = templates.userEntryTmpl(member);
        var entry = $(html);
        fitImage(entry.find("img"), member.thumbnail);
        $('#member-list').append(entry);
      });
      $('#member-loading-image').hide();
      if (members.length > 0) {
        $('#member-selection-ctrl').show();
      }
      $('#member-import-btn').removeAttr("disabled");
    });
  }

  // array of users
  var users = [];

  function clearMembers() {
    users = [];
    $('#user-icons').empty();
  }

  function addMembers(members) {
    users = users.concat(members);
    var ids = {};
    users = _.filter(users, function(user) {
      if (ids[user.id]) { return false; }
      ids[user.id] = true;
      return true;
    });
    $('#user-icons-loading-image').show();
    setDisplayPhase("loading");
    preloadUserPhotos(users, function() {
      $('#user-icons-loading-image').hide();
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
      img.src = user.picture.url;
      img.onload = function() {
        user.picture.width = img.width;
        user.picture.height = img.height;
        countdown();
      };
    });
  }

  function renderUsers(el, users) {
    $(el).empty();
    _.forEach(users, function(user) {
      var html = templates.userIconTmpl(user);
      var entry = $(html);
      $(el).append(entry);
      fitImage(entry.find("img"), user.thumbnail);
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
    window.scrollTo(0, 0);
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
    $('#nomination-win .image').html('<img src="./image/s.gif" >');
    fitImage($('#nomination-win .image img'), user.picture);
    $('#nomination-win .name').text(user.name);
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

  function fitImage(el, image) {
    if (!image.width || !image.height) {
      var img = new Image();
      img.src = image.url;
      img.onload = function() {
        image.width = img.width;
        image.height = img.height;
        fitImage(el, image);
      };
      return;
    }
    var ew = el.width(), eh = el.height();
    var iw = image.width, ih = image.height;
    var r = iw * eh > ih * ew ? eh / ih : ew / iw;
    var rw = iw * r, rh = ih * r;
    el.css({
      "background-image" : "url(" + image.url + ")",
      "background-size" : rw + "px " + rh + "px",
      "background-position" : (ew - rw) + "px " + (eh - rh) + "px"
    });
  }


});
