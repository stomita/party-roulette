/**
 * config.js
 */
define(function() {
  var hostname = location.hostname;
  return {
    facebook: {
      appId : 
        hostname === 'localhost' ? '372274212865913' :
        hostname === 'party-roulette.herokuapp.com' ? '337801969660288' :
        hostname === 'party-roulette.s3.amazonaws.com' ? '532043653474264' : ''
    },
    salesforce: {
      clientId : 
        hostname === 'localhost' ? 
          '3MVG9rFJvQRVOvk4hLXJcsIs0xUb5QDLRFSKfsF.Y9caN3AE6oszTiH7g7Y1eyoASpoRv_xGfA2.nU2LADXEe' :
        hostname === 'party-roulette.herokuapp.com' ? 
          '3MVG9rFJvQRVOvk4hLXJcsIs0xc4oeZyTfGx5NSax9TQes.XerrWVpjpo2rsVdD8_UDu1VM.bd5BYus5SHVs0' :
        hostname === 'party-roulette.s3.amazonaws.com' ?
          '3MVG9rFJvQRVOvk4hLXJcsIs0xanY4LBqoUBK0BA3LEghiHhdJRbEnWTZiQJJmyIws.f9LP_0ISkjivtWX8.i' :
        '',
      redirectUri :
        hostname === 'localhost' ? 'http://localhost:7000/' :
        hostname === 'party-roulette.herokuapp.com' ?  'https://party-roulette.herokuapp.com/' :
        hostname === 'party-roulette.s3.amazonaws.com' ? 'https://party-roulette.s3.amazonaws.com/index.html' :
        ''
    }
  };
});