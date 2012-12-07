/*global FB:true, _:true */
/**
 * facebook.js
 */
define([ "config" ], function(config) {

  var userInfo = null;

  return {
    name: "Facebook Event",
    icon: "./image/facebook.png",

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
          FB.api("me", function(res) {
            userInfo = res; 
            callback(true);
          });
        } else {
          callback(false);
        }
      });
    },

    getUserInfo: function() {
      return userInfo;
    },

    authorize: function(callback) {
      FB.login(function(response){
        if (response.authResponse) {
          FB.api("me", function(res) { userInfo = res });
          callback(true);
        } else {
          callback(false);
        }
      }, { scope : 'email,user_events' });
    },

    logout: function(callback) {
      userInfo = null;
      FB.logout(callback || function(){});
    },

    getGroupList: function(callback) {
      var url = "me/events";
      url += "?fields=name,id";
      url += "&type=attending";
      url += "&locale=" + (userInfo ? userInfo.locale : 'en_US');
      FB.api(url, function(response) {
        callback(response.data);
      });
    },

    getMemberList: function(gid, callback) {
      var url = gid;
      url += "?fields=attending.fields(id,name,picture.width(320).height(320).type(large),gender)";
      url += "&locale=" + (userInfo ? userInfo.locale : 'en_US');
      FB.api(url, function(response) {
        var members = _.map(response.attending.data, function(member) {
          return {
            provider: "facebook",
            id: "fb-" + member.id,
            name: member.name,
            picture: {
              url: member.picture.data.url
            },
            thumbnail: {
              url: member.picture.data.url
            }
          };
        });
        callback(members);
      });
    }

  };

});
