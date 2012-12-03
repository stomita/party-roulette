/*global sforce:true, flensed:true */
/**
 * sforce-flxhr-override.js
 */
(function() {

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

})();
