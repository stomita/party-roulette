$(function() {

   window.fbAsyncInit = function() {
    // init the FB JS SDK
    var hostname = location.hostname;
    FB.init({
      // App ID from the App Dashboard
      appId :
        hostname === 'localhost' ? '372274212865913' :
        hostname === 'ferdinand.local' ? '121205298038999' : 
        hostname === 'party-roulette.herokuapp.com' ? '337801969660288' : '',
      status     : true, // check the login status upon init?
      cookie     : true, // set sessions cookies to allow your server to access the session?
      xfbml      : true  // parse XFBML tags on this page?
    });

    FB.getLoginStatus(function(response) {
      if (response.authResponse) {
        loadAttendingEvents();
      }
    });

  };

  // templates
  var templates = {};
  $("script[type=x-underscore-tmpl]").each(function() {
    var id = this.id
    var tmpl = $(this).html();
    templates[id] = _.template(tmpl);
  });

  // event handlers
  $("#events").on("click", "li a", function() {
    $('#events').hide();
    var eid = $(this).data("eventId");
    loadEventAttendees(eid);
  });

  $("#startBtn").click(function() {
    setDisplayPhase("spinning")
    startSpinning();
  });
  $("#stopBtn").click(function() {
    setDisplayPhase("stopping");
    stopSpinning();
  });
  $("#shuffleBtn").click(function() {
    shuffle();
    renderUsers("#attendees", attendees);
  });
  $('#okBtn').click(function() {
    elected = null;
    fanfare.pause();
    try { fanfare.currentTime = 0; } catch(e) {}
    setDisplayPhase("waiting");
  });

  function setDisplayPhase(phase) {
    var body = $(document.body);
    var classes = (body.attr('class') || '').split(/\s/);
    _.forEach(classes, function(cls) {
      if (cls.indexOf('phase-') === 0) { body.removeClass(cls); } 
    });
    body.addClass("phase-" + phase);
  }

  function showLoading() {
  }

  function hideLoading() {
  }

  function loadAttendingEvents() {
    showLoading();
    FB.api("me/events?fields=name,id,description,location&type=attending&locale=ja_JP", function(response) {
      hideLoading();
      renderEvents("#events", response.data);
    });
  }

  function renderEvents(el, events) {
    $(el).empty();
    _.forEach(events, function(event) {
      var html = templates.eventTmpl(event);
      $(el).append(html);
    });
  } 

  var attendees;

  function loadEventAttendees(eid) {
    showLoading();
    FB.api(eid + "?fields=attending.fields(id,name,picture.width(320).height(320).type(large),gender)&locale=ja_JP", function(response) {
      attendees = response.attending.data;
      preloadUserPhotos(attendees, function() {
        hideLoading();
        shuffle();
        renderUsers("#attendees", attendees);
        setDisplayPhase("waiting");
      });
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
      img.src = user.picture.data.url;
      img.onload = countdown;
    });
  }

  function renderUsers(el, users) {
    $(el).empty();
    _.forEach(users, function(user) {
      var html = templates.userTmpl(user);
      $(el).append(html);
    });
  }

  function shuffle() {
    attendees = _.map(
      _.map(attendees, function(a) { return [ Math.random(), a ]; })
       .sort(function(a1, a2) { return a1[0] > a2[0] ? 1 : -1; }),
      function(a) { return a[1]; }
    );
  }

  var events = ("loadstart progress suspend abort error emptied stalled " +
    "play pause loadedmetadata Metadata loaded loadeddata waiting playing " + 
    "canplay canplaythrough seeking seeked timeupdate ended ratechange " +
    "durationchange volumechange").split(/\s+/);
  var papapa = $('#papapa-audio').get(0);
  _.forEach(events, function(evt) {
    papapa.addEventListener(evt, function(){ console.log("papapa", evt, arguments); });
  })
  window.papapa = papapa;
  var fanfare = $('#fanfare-audio').get(0);
  _.forEach(events, function(evt) {
    fanfare.addEventListener(evt, function(){ console.log("fanfare", evt, arguments); });
  })
  window.fanfare = fanfare;
  var spinning = false;
  var stopping = false;
  var stopwaits = null;
  var elected = null;
  var SPINNING_DEFAULT_INTERVAL = 100;
  var SPINNING_LAST_INTERVAL = 2000;

  function startSpinning() {
    shuffle();
    var i=0, len=attendees.length, nominated;
    var next = function() {
      if (stopwaits && stopwaits.length === 0) {
        finishSpinning(nominated);
        return;
      }
      nominated = attendees[i];
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
      var baseNum = Math.min(attendees.length, 100);
      var num = 0.2 * baseNum + Math.floor(0.3 * Math.random() * baseNum);
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

  function focusUser(user) {
    $('#attendees .user-icon').removeClass("selected");
    $('#attendees #user-' + user.id).addClass("selected");
    $('#focused-user-win .image')
       .empty()
       .append($('<img>').attr('src', user.picture.data.url));
    $('#focused-user-win .name').text(user.name);
    papapa.pause();
    try { papapa.currentTime = 0; } catch(e) {}
    papapa.play();
  }

  // Load the SDK's source Asynchronously
  // Note that the debug version is being actively developed and might 
  // contain some type checks that are overly strict. 
  // Please report such bugs using the bugs tool.
  (function(d, debug){
     var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement('script'); js.id = id; js.async = true;
     js.src = "//connect.facebook.net/en_US/all" + (debug ? "/debug" : "") + ".js";
     ref.parentNode.insertBefore(js, ref);
  }(document, /*debug*/ false));


});
