/*global FB:true, _:true */
/**
 * facebook.js
 */
define([ "config" ], function(config) {

  var locale = "en_US";

  return {
    name: "Facebook",

    init: function(callback) {
      window.fbAsyncInit = function() {
        // init the FB JS SDK
        FB.init({
          appId : config.facebook.appId, // App ID from the App Dashboard
          status : true, // check the login status upon init?
          cookie : true, // set sessions cookies to allow your server to access the session?
          xfbml : true  // parse XFBML tags on this page?
        });
        callback();
      };

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
    },

    isLoggedIn: function(callback) {
      FB.getLoginStatus(function(response) {
        if (response.authResponse) {
          FB.api("me", function(res) { locale = res.locael; });
          callback(true);
        } else {
          callback(false);
        }
      });
    },

    authorize: function(callback) {
      FB.login(function(response){
        if (response.authResponse) {
          FB.api("me", function(res) { locale = res.locael; });
          callback(true);
        } else {
          callback(false);
        }
      }, { scope : 'email,user_events' });
    },

    logout: function(callback) {
      FB.logout(callback || function(){});
    },

    getGroupList: function(callback) {
      var url = "me/events";
      url += "?fields=name,id";
      url += "&type=attending";
      url += "&locale=" + locale;
      FB.api(url, function(response) {
        callback(response.data);
      });
    },

    getMemberList: function(gid, callback) {
      var url = gid;
      url += "?fields=attending.fields(id,name,picture.width(320).height(320).type(large),gender)";
      url += "&locale=" + locale;
      FB.api(url, function(response) {
        var members = _.map(response.attending.data, function(member) {
          return {
            id: "fb-" + member.id,
            name: member.name,
            pictureUrl: member.picture.data.url,
            provider: "facebook"
          };
        });
        callback(members);
      });
    }

  };

});