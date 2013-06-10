/*global define:true, localStorage:true, _:true */
/**
 * salesforce.js
 */
define([ "config", "forcetk" ], function(config, forcetk) {

  function getCookie(name) {
    var regexp = new RegExp(name+"=([^;]*)");
    var m = document.cookie.match(regexp);
    return m && m[1];
  }

  function loadValue(name) {
    return localStorage ? localStorage.getItem(name) : getCookie(name);
  }

  function saveValue(name, value) {
    if (localStorage) {
      localStorage.setItem(name, value);
    } else {
      document.cookie = name+'='+value;
    }
  }

  var client;
  var version = 'v27.0';
  var authzUrl = 'https://login.salesforce.com/services/oauth2/authorize';
  var userInfo = null;


  return {
    name: "Chatter Group",
    icon: "./image/chatter.png",

    init: function(callback) {
      client = new forcetk.Client();
      client.proxyUrl = '/proxy/';
      var hash = location.href.split('#')[1];
      if (hash) {
        var params = {};
        _.forEach(hash.split('&'), function(pair) {
          pair = pair.split('=');
          params[pair[0]] = decodeURIComponent(pair[1]);
        });
        if (params.access_token && params.instance_url) {
          console.log(params);
          saveValue("sf_access_token", params.access_token);
          saveValue("sf_instance_url", params.instance_url);
          saveValue("sf_id_url", params.id);
          window.open('', '_self');
          window.close();
        }
      }
      callback(true);
    },

    isLoggedIn: function(callback) {
      var accessToken = loadValue("sf_access_token");
      var instanceUrl = loadValue("sf_instance_url");
      if (!accessToken || !instanceUrl) {
        return callback(false);
      } else {
        client.setSessionToken(accessToken, version, instanceUrl);
        this.initUser(callback);
      }
    },

    initUser: function(callback) {
      var idUrl = loadValue('sf_id_url');
      if (idUrl) {
        $.ajax({
          type: 'GET',
          url: idUrl + '?oauth_token=' + client.sessionId,
          dataType: 'jsonp',
          success: function(res) {
            userInfo = res;
            callback(true);
          },
          error: function(res) { callback(false); }
        });
      } else {
        callback(false);
      }
    },

    getUserInfo: function() {
      return userInfo;
    },

    authorize: function(callback) {
      var self = this;
      var url = authzUrl;
      url += "?response_type=token";
      url += "&client_id=" + config.salesforce.clientId;
      url += "&redirect_uri=" + encodeURIComponent(config.salesforce.redirectUri);
      url += "&display=touch";
      var left = (window.screen.width - 800) * 0.5;
      var top = (window.screen.height - 600) * 0.5;
      var w = window.open(url, null, 'width=800,height=600,top='+top+',left='+left);
      var pid = setInterval(function() {
        if (w.closed) {
          clearInterval(pid);
          var accessToken = loadValue('sf_access_token');
          var instanceUrl = loadValue('sf_instance_url');
          if (accessToken && instanceUrl) {
            client.setSessionToken(accessToken, version, instanceUrl);
            self.initUser(callback);
          } else {
            callback(false);
          }
        }
      }, 100);
    },

    logout: function(callback) {
      userInfo = null;
      saveValue("sf_access_token", "");
      saveValue("sf_instance_url", "");
      saveValue("sf_id_url", "");
      callback();
    },

    getGroupList: function(callback) {
      client.query("SELECT Id, Name FROM CollaborationGroup", function(res) {
        var records = _.map(res.records, function(record) {
          return {
            id: record.Id,
            name: record.Name
          };
        });
        records.unshift({
          id: 'FOLLOWING',
          name : 'Following Users'
        }, {
          name : '---------------'
        });
        callback(records);
      });
    },

    getMemberList: function(gid, callback) {
      if (gid === 'FOLLOWING') {
        return this.getFollowingList(callback);
      }
      var self = this;
      var memberSOQL =
        "SELECT Id, MemberId "+
        "FROM CollaborationGroupMember "+
        "WHERE CollaborationGroupId = '"+gid+"' " +
        "LIMIT 1000";
      client.query(memberSOQL, function(res) {
        if (res.size === 0) { return callback([]); }
        var ids = _.map(res.records, function(r){ return r.MemberId; });
        self.getUserList(ids, callback);
      }, function(err) {
        console.error(err);
        callback([]);
      });
    },

    getFollowingList: function(callback) {
      var self = this;
      var followingSOQL =
        "SELECT Id, ParentId " +
        "FROM EntitySubscription " +
        "WHERE Parent.Type = 'User' " +
        "AND SubscriberId = '" + this.getUserInfo().user_id + "' " +
        "LIMIT 1000";
      console.log(followingSOQL);
      client.query(followingSOQL, function(res) {
        if (res.size === 0) { return callback([]); }
        var ids = _.map(res.records, function(r){ return r.ParentId; });
        self.getUserList(ids, callback);
      }, function(err) {
        console.error(err);
        callback([]);
      });
    },

    getUserList: function(ids, callback) {
      var userSOQL = 
        "SELECT Id, Name, SmallPhotoUrl, FullPhotoUrl " +
        "FROM User " +
        "WHERE Id IN ('" + ids.join("','") + "')";
      client.query(userSOQL, function(res) {
        var records = _.map(res.records, function(r) {
          return {
            provider: "salesforce",
            id: "sf-"+r.Id,
            name: r.Name,
            picture: {
              url : r.FullPhotoUrl + '?oauth_token=' + client.sessionId
            },
            thumbnail: {
              url: r.SmallPhotoUrl + '?oauth_token=' + client.sessionId
            }
          };
        });
        callback(records);
      });
    }

  };

});
