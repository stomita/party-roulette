/**
 * config.js
 */
define(function() {
  var hostname = location.hostname;
  return {
    facebook: {
      appId : 
        hostname === 'localhost' ? '372274212865913' :
        hostname === 'party-roulette.herokuapp.com' ? '337801969660288' : ''
    },
    salesforce: {
      clientId : 
        hostname === 'localhost' ? 
          '3MVG9rFJvQRVOvk4hLXJcsIs0xUb5QDLRFSKfsF.Y9caN3AE6oszTiH7g7Y1eyoASpoRv_xGfA2.nU2LADXEe' :
        hostname === 'party-roulette.herokuapp.com' ? 
          '3MVG9rFJvQRVOvk4hLXJcsIs0xc4oeZyTfGx5NSax9TQes.XerrWVpjpo2rsVdD8_UDu1VM.bd5BYus5SHVs0' :
        '',
      redirectUri :
        hostname === 'localhost' ? 'http://localhost:7000/' :
        hostname === 'party-roulette.herokuapp.com' ?  'https://party-roulette.herokuapp.com/' :
        ''
    }
  };
});