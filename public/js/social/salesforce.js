/*global sforce:true, localStorage:true, _:true */
/**
 * salesforce.js
 */
define([ "config" ], function(config) {

  function loadScript(url, callback) {
    var d = document;
    var s, id = 'sforce-ajax-toolkit';
    var ref = d.getElementsByTagName('script')[0];
    if (d.getElementById(id)) { return; }
    s = d.createElement('script'); s.id = id; s.async = true;
    s.src = url;
    s.onload = function() {
      s.onload = null;
      s.onreadystatechange = null;
      callback();
    };
    s.onreadystatechange = function() {
      if (s.readyState === 'completed' || s.readyState === 'loaded') {
        if (s.onload) { s.onload(); }
      }
    };
    ref.parentNode.insertBefore(s, ref);
  }

  /**
   *
   */
  function overrideTransport() {

    var requestQueue = {};
    var requestSeq = 1;

    var FlashXMLHttpRequest = function() {
      var loadPolicyURL =
        sforce.connection.serverUrl.split('/').slice(0, 3).join('/')+
        '/services/Soap/u/crossdomain.xml';
      this.flxhr = new flensed.flXHR({ autoUpdatePlayer : true, loadPolicyURL : loadPolicyURL });
      var _this = this;
      this.flxhr.onreadystatechange = function() {
        if (_this.flxhr.readyState===4) {
          delete requestQueue['_'+_this.seqnum];
        }
        if (_this.onreadystatechange) {
          var props = 'readyState,status,statusText,responseText,responseXML'.split(',');
          for (var i=0; i<props.length; i++) {
            _this[props[i]] = _this.flxhr[props[i]];
          }
          _this.onreadystatechange.apply(_this, arguments);
        }
      };
    };

    FlashXMLHttpRequest.prototype = {
      setRequestHeader : function(name, value) {
        // override xmlhttprequest, because sforce client sets user-agent header but flXHR doesn't support it and raises error.
        if (name.toLowerCase()!=='user-agent') {
          this.flxhr.setRequestHeader(name, value);
        }
      },
      open : function(method, url, async) {
        this.flxhr.open.apply(this.flxhr, arguments);
      },
      send : function(data) {
        this.seqnum = requestSeq++;
        requestQueue['_'+this.seqnum] = this;
        this.flxhr.send.apply(this.flxhr, arguments);
      },
      getResponseHeader : function() {
        return null;
      },
      getAllResponseHeader : function() {
        return '';
      }
    };

    setTimeout(function() {
      if (window.flensed) {
        window.flensed.throwUnhandledError = function(e) {
          for (var k in requestQueue) {
            var xhr = requestQueue[k];
            delete requestQueue[k];
            if (xhr.onreadystatechange) {
              xhr.readyState = 4;
              xhr.status = 500;
              xhr.statusText = 'Internal Server Error';
              var xml = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
                ' xmlns:sf="urn:fault.partner.soap.sforce.com" ',
                ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
                '<soapenv:Body><soapenv:Fault>',
                '<faultcode>UNKNOWN_ERROR</faultcode>',
                '<faultstring>Unknown Error</faultstring>',
                '<detail><sf:UnexpectedErrorFault xsi:type="sf:UnexpectedErrorFault">',
                '<sf:exceptionCode>UNKNOWN_ERROR</sf:exceptionCode>',
                '<sf:exceptionMessage>Unknown Error</sf:exceptionMessage>',
                '</sf:UnexpectedErrorFault></detail>',
                '</soapenv:Fault></soapenv:Body></soapenv:Envelope>'
              ].join('');
              xhr.responseText = xml;
              xhr.responseXML = new DOMParser().parseFromString(xml, "text/xml");
              xhr.onreadystatechange();
              delete xhr.onreadystatechange;
            }
          }
          throw new Error(e);
        };
      }
    }, 1000);

    var _Transport = sforce.Transport;
    sforce.Transport = function() {
      _Transport.apply(this, arguments);
      this.newConnection = function() {
        return this.connection = new FlashXMLHttpRequest();
      };
    };
  }


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

  var version = '26.0';
  var authzUrl = 'https://login.salesforce.com/services/oauth2/authorize';
  var userInfo = null;

  return {
    name: "Salesforce",

    init: function(callback) {
      loadScript("//login.salesforce.com/soap/ajax/"+version+"/connection.js", function() {
        overrideTransport();
        callback();
      });
    },

    isLoggedIn: function(callback) {
      var accessToken = loadValue("sf_access_token");
      var instanceUrl = loadValue("sf_instance_url");
      if (!accessToken || !instanceUrl) {
        return callback(false);
      } else {
        sforce.connection.sessionId = accessToken;
        sforce.connection.serverUrl = instanceUrl + "/services/Soap/u/"+version;
        sforce.connection.getUserInfo({
          onSuccess: function(res) {
            userInfo = res;
            callback(true);
          },
          onFailure: function(res) { callback(false); }
        });
      }
    },

    getUserInfo: function() {
      return userInfo;
    },

    authorize: function(callback) {
      var url = authzUrl;
      url += "?response_type=token";
      url += "&client_id=" + config.salesforce.clientId;
      url += "&redirect_uri=" + encodeURIComponent(config.salesforce.redirectUri);
      url += "&display=popup";
      var left = (window.screen.width - 800) * 0.5;
      var top = (window.screen.height - 600) * 0.5;
      var w = window.open(url, null, 'width=800,height=600,top='+top+',left='+left);
      var pid = setInterval(function() {
        if (w.closed) {
          clearTimeout(pid);
          callback(false);
        }
        try {
          var hash = w.location.href.split('#')[1];
          var params = {};
          _.forEach(hash.split('&'), function(pair) {
            pair = pair.split('=');
            params[pair[0]] = decodeURIComponent(pair[1]);
          });
          if (params.access_token && params.instance_url) {
            saveValue("sf_access_token", params.access_token);
            saveValue("sf_instance_url", params.instance_url);
            sforce.connection.sessionId = params.access_token;
            sforce.connection.serverUrl = params.instance_url + "/services/Soap/u/"+version;
            w.close();
            clearInterval(pid);
            callback(true);
          }
        } catch(e) {}
      }, 100);
    },

    logout: function(callback) {
      userInfo = null;
      saveValue("sf_access_token", "");
      saveValue("sf_instance_url", "");
      callback();
    },

    getGroupList: function(callback) {
      sforce.connection.query("SELECT Id, Name FROM CollaborationGroup", function(res) {
        var records = res.getArray("records");
        records = _.map(records, function(record) {
          return {
            id: record.Id,
            name: record.Name
          };
        });
        callback(records);
      });
    },

    getMemberList: function(gid, callback) {
      var memberSOQL =
        "SELECT Id, MemberId "+
        "FROM CollaborationGroupMember "+
        "WHERE CollaborationGroupId = '"+gid+"'";
      sforce.connection.query(memberSOQL, function(res) {
        if (res.getInt("size") === 0) { return callback([]); }
        var ids = _.map(res.getArray("records"), function(r){ return r.MemberId; });
        var userSOQL = 
          "SELECT Id, Name, SmallPhotoUrl, FullPhotoUrl " +
          "FROM User " +
          "WHERE Id IN ('" + ids.join("','") + "')";
        sforce.connection.query(userSOQL, function(res) {
          var records = res.getArray("records");
          records = _.map(records, function(r) {
            return {
              id : "sf-"+r.Id,
              name : r.Name,
              picture : {
                url : r.FullPhotoUrl,
                thumnailUrl: r.SmallPhotoUrl
              },
              provider: "salesforce"
            };
          });
          callback(records);
        });
      });
    }

  };

});
