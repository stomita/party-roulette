/*global requirejs, require, soundManager, FB, $, _, location */

// force https
if (location.protocol !== 'https:' && location.hostname !== 'localhost' && !/\.local$/.test(location.hostname)) {
  location.protocol = 'https:';
}

requirejs.config({
  paths: {
    forcetk: '/lib/forcetk'
  },
  shim: {
    forcetk: {
      exports: 'forcetk'
    }
  }
});

require([ "social/facebook", "social/salesforce" ], function(facebook, salesforce) {

  // templates
  var templates, sounds, socials = [ facebook, salesforce ];
  var EVENT = {
    mousedown : 'ontouchstart' in document.documentElement ? 'touchstart' : 'mousedown'
  };

  $(init);

  function init() {
    resetScroll();
    initTemplates();
    initSounds();
    initMenu();
    initEventHandlers();
  }

  function resetScroll() {
    window.scrollTo(0, 1);
  }

  var papapa, fanfare;

  function initSounds() {
    papapa = $('#papapa-audio').get(0);
    fanfare = $('#fanfare-audio').get(0);
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
    $("#shuffle-menu").click(function() {
      shuffle();
      renderUsers("#user-icons", users);
    });
  }

  function initEventHandlers() {
    initSocialSelectDialogEventHandlers();
    initGroupListDialogEventHandlers();
    initMainControlEventHandlers();
    initNominationWindowEventHandlers();
    initAddEntryDialogEventHandlers();
    initUserDetailDialogEventHandlers();
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
            $('#socials .btn').attr('disabled', 'disabled');
            $('#social-loading-image').show();
            social.authorize(function(loggedIn) {
              $('#socials .btn').removeAttr('disabled');
              $('#social-loading-image').hide();
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
      console.log(gid);
      var social = findSocial($(this).data('social-name'));
      showMemberList(social, gid);
    });
    $('#sign-out-btn').click(function() {
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
    $("#user-icons").on(EVENT.mousedown, ".user-icon", function(e) {
      e.preventDefault();
      e.stopPropagation();
      var el = $(this);
      var now = new Date().getTime();
      var name = el.find('img').attr('title');
      var uid = el.data("userId");
      var lastClicked = el.data('lastClicked');
      var user = findUser(uid);
      if (el.hasClass('selected') && lastClicked + 500 > now) {
        showUserDetailDialog(user);
      } else {
        focusUser(user);
      }
      el.data('lastClicked', now);
    });
    $("#start-btn").click(function() {
      setDisplayPhase("spinning");
      startSpinning();
      setTimeout(function() {
        setDisplayPhase("stop-waiting");
      }, 1000);
    });
  }

  function initNominationWindowEventHandlers() {
    $("#stop-btn").click(function(e) {
      e.preventDefault();
      e.stopPropagation();
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

  function initUserDetailDialogEventHandlers() {
    $("#entry-delete-btn").click(function() {
      $('#user-detail-dialog').modal('hide');
      deleteSelectedUser();
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
    $('#group-loading-image').show();
    $('#member-selection-ctrl').hide();
    $('#groups').empty()
                .data('social-name', social.name)
                .attr('disabled', 'disabled');
    $('#sign-out-btn').data('social-name', social.name).hide();
    $('#member-import-btn').attr("disabled", "disabled");
    social.getGroupList(function(groups) {
      $('#group-loading-image').hide();
      $('#sign-out-btn').show();
      _.forEach(groups, function(group) {
        $('#groups').append(
          $('<option>').val(group.id).text(group.name)
        );
      });
      $('#groups').removeAttr('disabled');
      $('#groups').change();
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
      resetScroll();
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


  var spinning = false;
  var stopping = false;
  var stopwaits = null;
  var elected = null;
  var SPINNING_DEFAULT_INTERVAL = 100;
  var SPINNING_LAST_INTERVAL = 2000;

  function startSpinning() {
    resetScroll();
    fanfare.load();
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

  function showUserDetailDialog(user) {
    $('#user-detail-dialog .modal-header h3').text(user.name);
    fitImage($('#user-detail-dialog .modal-body .image'), user.picture);
    $('#user-detail-dialog').modal('show');
  }

  function deleteSelectedUser() {
    var userIcon = $('#user-icons .selected').first();
    if (userIcon.length > 0) {
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
