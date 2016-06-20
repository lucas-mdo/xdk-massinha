/*xdk-auto-gen:service-methods:common:start:32f90f8cf0799dc30ee39ffa0c86326b*/

var intel;
if (!intel) intel = {};
if (typeof intel !== "object") throw new Error("Unexpected use of intelnamespace");
if (!intel.xdk) intel.xdk = {};
if (typeof intel.xdk !== "object") throw new Error("Unexpected use of intel.xdknamespace");
if (!intel.xdk.services) intel.xdk.services = {};
if (typeof intel.xdk.services !== "object") throw new Error("Unexpected use of intel.xdk.servicesnamespace");
intel.xdk.services.iodocs_ = (function () {
/**
 * @license Copyright 2013 - 2014 Intel Corporation All Rights Reserved.
 *
 * The source code, information and material ("Material") contained herein is owned by Intel Corporation or its
 * suppliers or licensors, and title to such Material remains with Intel Corporation or its suppliers or
 * licensors. The Material contains proprietary information of Intel or its suppliers and licensors. The
 * Material is protected by worldwide copyright laws and treaty provisions. No part of the Material may be used,
 * copied, reproduced, modified, published, uploaded, posted, transmitted, distributed or disclosed in any way
 * without Intel's prior express written permission. No license under any patent, copyright or other intellectual
 * property rights in the Material is granted to or conferred upon you, either expressly, by implication,
 * inducement, estoppel or otherwise. Any license under such intellectual property rights must be express and
 * approved by Intel in writing.
 *
 * Unless otherwise agreed by Intel in writing, you may not remove or alter this notice or any other notice
 * embedded in Materials by Intel or Intel's suppliers or licensors in any way.
 */

/* global X2JS */

/* This file contains helper functions for all api-requests (i.e., data bindings) */
  var exports = {};

  /* Merge the second argument into the first, return the first. A simple version of _.extend() */
  exports.mergeParams = function (params, runtimeParams) {
    runtimeParams = runtimeParams || {};
    for (var p in runtimeParams) {
      if (Object.prototype.hasOwnProperty.call(runtimeParams, p)) {
        params[p] = runtimeParams[p];
      }
    }
    for (p in params) {
      if(params[p] === '') {
        delete params[p];
      }
    }
    return params;
  };

  /* Invoke the given common function, run checks on the result, and run a filter function if provided */
  exports.bindCommon = function (functionName, commonFunc, params, runtimeParams) {
    /* 
     * Pull xdkFilter from runtimeParams, otherwise the filter function may run before
     * the data is returned, which could cause any number of problems
     */
    var filterFunc;
    if (runtimeParams && typeof runtimeParams.xdkFilter === 'function') {
      filterFunc = runtimeParams.xdkFilter;
      delete runtimeParams.xdkFilter;
    }
    var p = commonFunc(exports.mergeParams(params, runtimeParams));
    return p.then(function (data, status, xhr) {
      var finalData = data;
      /* If the returned data is XML, convert it to JSON before sending out */
      if ($.isXMLDoc(data)) {
        var x2j = new X2JS();
        finalData = x2j.xml2json(data);
        finalData.xml2json = true;
      }
      /* If the user passes a filter function, run that filter before returning the response */
      if (filterFunc) finalData = filterFunc(finalData);
      $(document).trigger(functionName, [finalData, status, xhr]);
      return finalData;
    });
  };

  exports.helpers = {};

  /* checks if url for OAuth flow ends with ? */
  function urlChecker(url){
    if (url.substr(-1) !== '?') url = url.concat('?');
    return url;
  }

  /* OAuth 2.0 */

  /**
   * Launches window to input user credential for authentication
   * If already authenticated, then opens and closes window to get code/access_token
   * @param {object} url String containing url used for authentication
   * @param {object} params Object containing parameters passed along with url to authenticate (e.g. client_id, client_secret, etc)
   * @param {string} mode Determines the oauth mode (authCode, implicit, etc)
   */
  function doOAuth2_(url, params, mode){
    var d = $.Deferred();
    var completeUrl = urlChecker(url) + $.param(params);
    var l = params.redirect_uri.length;
    var authWindow = window.open(completeUrl, '_blank', 'location=yes');

    /* services tab */
    $(document).on('OAuthSuccess', function(e){
      //OAuthSuccess event tells us we're at the redirect_uri, so no need to check
      if (mode === 'authCode'){
        var results = {};
        var code, error;
        if (e.originalEvent.detail.result.code){
          code = e.originalEvent.detail.result.code;
        } else if (e.originalEvent.detail.result.error){
          error = e.originalEvent.detail.result.error;
        }
        if (code) results.code = code; //oauth2Callback sends the query string, so no need to parse the url
        if (error) results.error = error;
        $(document).off('OAuthSuccess');
        authWindow.close();
        d.resolve(results);
      } else if (mode === 'implicit'){
        var token = /access_token=([^&]+)/.exec(e.originalEvent.detail.hash);
        if (token) {
          $(document).off('OAuthSuccess');
          authWindow.close();
          d.resolve(token[1]);
        }
      }
    });

    /* emulator and device */
    $(authWindow).on('loadstart', function(e){
      var authUrl = e.originalEvent.url;
      if (authUrl.substring(0, l) === params.redirect_uri) {
        if (mode === 'authCode'){
          var results = {};
          var code = /\?code=(.+)(?=&)|\?code=(.+)(?=#)|\?code=(.+)$/.exec(e.originalEvent.url);
          if (code) results.code = code[1]||code[2]||code[3];
          results.error = /\?error=(.+)$/.exec(e.originalEvent.url);
          $(authWindow).off('loadstart');
          authWindow.close();
          d.resolve(results);
        } else if (mode === 'implicit'){
          var hash = /access_token=([^&]+)/.exec(e.originalEvent.url);
          if (hash) {
            $(authWindow).off('loadstart');
            authWindow.close();
            d.resolve(hash[1]);
          }
        }
      }
    });
    return d.promise();
  }

  /**
   * Achieve authentication using authorization code OAuth2.0
   * @param {object} url Object containing urls used for authentication
   * @param {object} params Object containing parameters passed along with url to authenticate (e.g. client_id, client_secret, etc)
   *
   * @returns {string} Access token used in OAuth 2.0
   */
  exports.helpers.oauth2AuthCode = function (url, params){
    return doOAuth2_(url.codeUrl, params.code, 'authCode')
    .then(function(e){
      if (e.code){
        var tokenParams = {
          code: encodeURIComponent(e.code),
          client_id: params.code.client_id,
          client_secret: params.token.client_secret,
          redirect_uri: params.code.redirect_uri,
          grant_type: 'authorization_code'
        };
        return $.ajax({ //returns response containing access_token
          url: url.tokenUrl,
          type: 'POST',
          contentType: 'application/x-www-form-urlencoded',
          data: tokenParams,
          dataType: 'json',
          headers: {
            Accept : 'application/json'
          }
        });
      } else {
        var d = $.Deferred();
        d.reject(e.error);
        return d.promise();
      }
    });
  };

  /**
   * Achieve authentication using implicit OAuth2.0
   * @param {object} url String containing url used for authentication
   * @param {object} params Object containing parameters passed along with url to authenticate (e.g. client_id, client_secret, etc)
   *
   * @returns {string} Access token used in OAuth 2.0
   */
  exports.helpers.oauth2Implicit = function(url, params){
    return doOAuth2_(url, params, 'implicit');
  };

  /**
   * Achieve authentication using client credential OAuth2.0
   * @param {object} url String containing urls used for authentication
   * @param {object} params Object containing parameters passed along with url to authenticate (e.g. client_id, client_secret, etc)
   *
   * @returns {string} Access token used in OAuth 2.0
   */
  exports.helpers.oauth2CC = function(url, params, header){
    var d = $.Deferred();
    return $.ajax({
      url: urlChecker(url) + $.param(params),
      type: 'POST',
      contentType: 'application/x-www-form-urlencoded;charset=UTF-8',
      headers: {
        'Authorization': header
      },
      data: 'grant_type=client_credentials',
      dataType: 'json'
    })
    .then(function(response){
      d.resolve(response);
      return d.promise();
    });
  };

  return exports;
})();;
intel.xdk.services.iodocs_.usatoday = ((function (credentials) {
  var exports = {};
  var baseUrl = 'http://api.usatoday.com/open/';

  function getCensusData(path, params) {
    params = params || {};
    var url = baseUrl + 'census/' + path + '?api_key=' + credentials.apiKey + '&' + $.param(params);
    return $.ajax({url: url});
  }

  exports.getLocations = getCensusData.bind(null, 'locations');
  exports.getEthnicity = getCensusData.bind(null, 'ethnicity');
  exports.getHousing = getCensusData.bind(null, 'housing');
  exports.getPopulation = getCensusData.bind(null, 'population');
  exports.getRace = getCensusData.bind(null, 'race');

  return exports;
}))(intel.xdk.services.credentials.usatoday,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.rottentomatoes = ((function (credentials) {
  var exports = {};
  var baseUrl = 'http://api.rottentomatoes.com/api/public/v1.0/';
    
  function getList(path, params) {
    params = params || {};
    params.apiKey = credentials.apiKey;
    var url = baseUrl + path + '.json?' + $.param(params);
    return $.ajax({url: url, dataType: "json"});
  }

  function getDetailedInfo(path, params) {
    params = params || {};
    params.apiKey = credentials.apiKey;
    var url = baseUrl + 'movies/' + params.id + path + '.json?';
    var params_temp = {};
    for (var prop in params) {
      if((prop!='id') && Object.prototype.hasOwnProperty.call(params,prop)){
        params_temp[prop] = params[prop];  
      }
    }
    url = url + $.param(params_temp);
    return $.ajax({url: url, dataType: "json"});
  }

  exports.box_office = getList.bind(null, 'lists/movies/box_office');
  exports.in_theatres = getList.bind(null, 'lists/movies/in_theaters');
  exports.opening = getList.bind(null, 'lists/movies/opening');
  exports.upcoming = getList.bind(null, 'lists/movies/upcoming');
  exports.top_rentals = getList.bind(null, 'lists/dvds/top_rentals');
  exports.current_releases = getList.bind(null, 'lists/dvds/current_releases');
  exports.new_releases = getList.bind(null, 'lists/dvds/new_releases');
  exports.upcomingDVD = getList.bind(null, 'lists/dvds/upcoming');
  exports.movie_info = getDetailedInfo.bind(null,'');
  exports.cast_info = getDetailedInfo.bind(null, '/cast');
  exports.movie_clips = getDetailedInfo.bind(null, '/clips');
  exports.movie_reviews = getDetailedInfo.bind(null, '/reviews');
  exports.movie_similar = getDetailedInfo.bind(null, '/similar');
  exports.movie_alias = getList.bind(null, 'movie_alias');
  exports.search = getList.bind(null, 'movies');
  exports.listsDirectory = getList.bind(null, '');
  exports.movieListsDirectory = getList.bind(null, 'lists/movies');
  exports.dvdListsDirectory = getList.bind(null, 'lists/dvds');

  return exports;
}))(intel.xdk.services.credentials.rottentomatoes,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.sandbox = ((function (credentials) {
  // Attempt to parse the given string as JSON, but fail gracefully
  // returning the original string if it is not JSON
  function tryJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }

  var exports = {};
  exports.RESTAPI = function (params) {
    return $.ajax({
      url: params.URL,
      method: params.Method,
      headers: tryJsonParse(params.Headers),
      data: tryJsonParse(params.body)
    });
  };

  return exports;
}))(intel.xdk.services.credentials.sandbox,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.klout = ((function (credentials) {
  var exports = {};
  var baseUrl = 'http://api.klout.com/v2/';

  function getId(path, params) {
    params = params || {};
    var substring = '/' + params.Id + '?';
    if(params.screenName) {
      substring = '?' + 'screenName=' + params.screenName + '&';
    }
    if(params.KId) {
      substring = '/' + params.KId + '/tw?';
    }
    var url = baseUrl + 'identity.json/' + path + substring + 'key=' + credentials.apiKey;
    return $.ajax({url: url});
  }

  function getUser(path, params) {
    params = params || {};
    if (path) {path = '/' + path; }
    var url = baseUrl + 'user.json/' + params.kloutId +  path + '?key=' + credentials.apiKey;
    return $.ajax({url: url});
  }

  exports.getIdByTwitterId = getId.bind(null, 'tw');
  exports.getIdByGoogle = getId.bind(null, 'gp');
  exports.getIdByInstagram = getId.bind(null, 'ig');
  exports.getIdByTwitterName = getId.bind(null, 'twitter');
  exports.getTwitterIdByKloutId = getId.bind(null, 'klout');
  exports.showUser = getUser.bind(null, '');
  exports.Score = getUser.bind(null, 'score');
  exports.Topics = getUser.bind(null, 'topics');
  exports.Influence = getUser.bind(null, 'influence');

  return exports;
}))(intel.xdk.services.credentials.klout,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.foursquare = ((function (credentials, helpers) {
  var exports = {};
  
  /* helper functions */
  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
  function currentDate(){
    // var d = new Date();
    // var m = d.getMonth()+1;
    // var day = d.getDate();
    // if(m < 10) m = '0'.concat(m);
    // if(day<10) day = '0'.concat(day);
    // return d.getFullYear() + '' + m + '' + day;
    return '20150101';
  }

  function getToken() {
    var db = window.localStorage;
    return db.getItem('foursquare_access_token');
  }

  function showError(message){
    console.log(message);
    return message;
  }
  
  /* Authentication */
  exports.authenticate = function(params) {
    var url = {codeUrl: 'https://foursquare.com/oauth2/authenticate?',
               tokenUrl: 'https://foursquare.com/oauth2/access_token?'};
    var urlParams = {code: {
                        client_id: credentials.apiKey,
                        redirect_uri: params.redirect_uri,
                        response_type: params.response_type
                     },
                     token: {
                        client_secret: credentials.apiSecret,
                        grant_type: 'authorization_code'
                     }
                    };
    return helpers.oauth2AuthCode(url, urlParams)
    .then(function(response){
      var token = response.access_token;
      var db = window.localStorage;
      db.setItem('foursquare_access_token', token);
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  /* Users */
  exports.user = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userLeaderboard = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/leaderboard?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(leaderboard){
      return leaderboard;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userRequests = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/requests?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(requests){
      return requests;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userSearch = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/search?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(leaderboard){
      return leaderboard;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userBadges = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/badges?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userCheckins = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/checkins?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userFriends = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/friends?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userLists = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/lists?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userMayorships = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/mayorships?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userPhotos = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/photos?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userVenueHistory = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/venuehistory?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userApprove = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/approve?' + $.param(urlParams),
      type: 'POST'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userDeny = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/deny?' + $.param(urlParams),
      type: 'POST'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userSetPings = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/setpings?' + $.param(urlParams),
      type: 'POST'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userUnfriend = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/unfriend?' + $.param(urlParams),
      type: 'POST'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userUpdate = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/users/' + params.USER_ID + '/update?' + $.param(urlParams),
      type: 'POST'
    })
    .then(function(user){
      return user;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  /* Venue */
  exports.venueDetail = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/venues/' + params.venue_id + '?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.venueCategories = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/venues/categories?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.venueExplore = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/venues/explore?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.venueSearch = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/venues/search?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Checkins */
  exports.checkin = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/checkins/' + params.checkin_id + '?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.checkinAdd = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/checkins/add?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Events */
  exports.events = function(params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    params = jsonCleaner(params);
    var urlParams = $.extend({},{client_id: credentials.apiKey,
                                 client_secret: credentials.apiSecret,
                                 oauth_token: token,
                                 v:currentDate(),
                                 m:'foursquare'}, params);
    return $.ajax({
      url: 'https://api.foursquare.com/v2/events/' + params.event_id + '?' + $.param(urlParams),
      type: 'GET'
    })
    .then(function(venue){
      return venue;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  return exports;
}))(intel.xdk.services.credentials.foursquare,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.itunes = ((function (credentials, helpers) {
  'use strict';

  var ITUNES = 'https://itunes.apple.com/search?';

  return {
    search: function(params) {
      return $.ajax({
        type: 'GET',
        dataType: 'json',
        url: ITUNES + $.param(params)
      });
    }
  };

})
)(intel.xdk.services.credentials.itunes,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.wunderground = ((function (credentials, helpers) {
  'use strict';

  var API = 'https://api.wunderground.com/api';
  var WU_SETTINGS = ['lang','pws','bestfct'];

  // get a WU API URI from a method name and parameters
  var wu_uri = function(method, params) {
    var key = credentials.apiKey;

    // history and planner methods optionally have a date (method_YYYYMMDD)
    var method = params.date ? (method + '_' + params.date) : method;
    var location = params.query;

    var settings = WU_SETTINGS.reduce(function(memo, setting) {
      var val = params[setting];

      if (val !== undefined && val !== '1') { // pws, bestfct default to 1
        memo += (setting + ':' + val) + '/';
      }

      return memo;
    }, '/');

    return API + '/' + key + '/' + method + settings + 'q/' + location + '.json';
  };

  // get WU API data from a method name and parameters
  var wu_ajax = function(method, params) {
    return $.ajax({
      type: 'GET',
      dataType: 'json',
      url: wu_uri(method, params)
    });
  };

  return [
    'alerts', 'almanac', 'astronomy', 'conditions', 'currenthurricane',
    'forecast', 'forecast10day', 'geolookup', 'hourly', 'hourly10day',
    'rawtide', 'tide', 'webcams', 'yesterday', 'history', 'planner'
  ].reduce(function(exports, method) {
    exports[method] = function(params) {
      return wu_ajax(method, params);
    };

    return exports;
  }, {});

})
)(intel.xdk.services.credentials.wunderground,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.googleplaces = ((function (credentials) {
  var exports = {};
  var baseUrl = 'https://maps.googleapis.com/maps/api/place/';

  function getPlaceData(path, params) {
    params = params || {};
    var url = baseUrl + path + '/json?key=' + credentials.apiKey + '&sensor=false&' + $.param(params);
    return $.ajax({url: url});
  }

  exports.placeSearch = getPlaceData.bind(null, 'nearbysearch');
  exports.textSearch = getPlaceData.bind(null, 'textsearch');
  exports.radarSearch = getPlaceData.bind(null, 'radarsearch');
  exports.placeDetails = getPlaceData.bind(null, 'details');

  return exports;
}))(intel.xdk.services.credentials.googleplaces,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.spotify = ((function (credentials) {
  var exports = {};

  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }

  var searchURL = 'https://api.spotify.com/v1/';

  function getSearchData(path, params) {
    params = jsonCleaner(params);
    var url = searchURL + path + "?" + $.param(params);
    return $.ajax({url: url});
  }

  function getSpecificData(path, params) {
    params = jsonCleaner(params);
    var url = searchURL + path + "/" + params.id;
    return $.ajax({url: url});
  }

  exports.search = getSearchData.bind(null, "search");
  exports.lookupArtist = getSpecificData.bind(null, "artists");
  exports.lookupAlbum = getSpecificData.bind(null, "albums");
  exports.lookupTrack = getSpecificData.bind(null, "tracks");

  return exports;
}))(intel.xdk.services.credentials.spotify,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.flickr = ((function (credentials, helpers) {
  var exports = {photos:{}, people:{}, galleries:{}, interestingness:{}, photosets:{}};
    
    var utils = {};
    
    utils.sprintf = function(format, etc)
    {
        var arg = arguments;
        var i = 1;
        return format.replace(/%((%)|s)/g, function (m) { return m[2] || arg[i++] ;});
    };
  
    function jsonCleaner(x) 
    {
        var type = typeof x;
        if (x instanceof Array) {
          type = 'array';
        }
        if ((type == 'array') || (type == 'object')) {
          for (var k in x) {
            var v = x[k];
            if ((v === '') && (type == 'object')) {
              delete x[k];
            } else {
              jsonCleaner(v);
            }
          }
          return x;
        }
    }
    
    /*
     photo_object
        Object
        farm: 3
        id: "14427316793"
        isfamily: 0
        isfriend: 0
        ispublic: 1
        owner: "62591523@N08"
        secret: "e5d42a9a0d"
        server: "2933"
        title: "cat"
    */
    function construct_url(photo_obj)
    {
        //https://farm{farm-id}.staticflickr.com/{server-id}/{id}_{secret}.jpg
        var template = "https://farm%s.staticflickr.com/%s/%s_%s.jpg";
        return utils.sprintf(template, photo_obj.farm, photo_obj.server, photo_obj.id, photo_obj.secret);        
    }
    
    function get_method_call(method_name, append_url)
    {
        return function(params) 
               {
                var url = 'https://api.flickr.com/services/rest/';
                params.method = "flickr." + method_name; 
                params.api_key = credentials.apiKey;
                params.format = "json";
                if (params) url = url + '?' + $.param(jsonCleaner(params));
                var promise =  $.ajax({url: url, type: 'GET', dataType:'jsonp', jsonp:'jsoncallback'});
                if(append_url)
                {
                    return promise.then(function(data)
                          {
                              //data.photos.photo[ {photoObj}...]
                              var photo_obj = data[append_url];
                              $.each(photo_obj.photo, function(index, photo_obj)
                                     {
                                         photo_obj.url = construct_url(photo_obj);
                                     });
                              return data;
                          });
                }
                else
                {
                    return promise; 
                }
              };
    }
  
  exports.photos_search             = get_method_call("photos.search", "photos");
  
  exports.people_getPublicPhotos    = get_method_call("people.getPublicPhotos", "photos");
  exports.people_getPhotosOf        = get_method_call("people.getPhotosOf", "photos");
    
  exports.galleries_getPhotos       = get_method_call("galleries.getPhotos", true);
  exports.galleries_getListForPhoto = get_method_call("galleries.getListForPhoto", false);
  exports.galleries_getList         = get_method_call("galleries.getList", false);
  exports.galleries_getInfo         = get_method_call("galleries.getInfo", false);
    
  exports.interestingness_getList   = get_method_call("interestingness.getList", "photos");
    
  exports.photosets_getPhotos       = get_method_call("photosets.getPhotos", "photoset");
  exports.photosets_getList         = get_method_call("photosets.getList", false);
  exports.photosets_getInfo         = get_method_call("photosets.getInfo", false);
  
  return exports;
}))(intel.xdk.services.credentials.flickr,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.woot = ((function (credentials, helpers) {
  'use strict';

  var WOOT = 'https://api.woot.com/2';

  var woot_uri = function(method, params) {
    var extra = '';

    if (method === 'offers') {
      extra = '/' + params.id;
      delete params.id;
    }

    return WOOT + '/' + method + extra + '.json?key=' + credentials.apiKey + '&' + $.param(params);
  };

  var woot_ajax = function(method, params) {
    return $.ajax({
      type: 'GET',
      dataType: 'json',
      url: woot_uri(method, params)
    });
  };

  return [
    'events', 'offers', 'monkeychats', 'polls', 'wootcasts'
  ].reduce(function(exports, method) {
    exports[method] = function(params) {
      return woot_ajax(method, params);
    };

    return exports;
  }, {});

})
)(intel.xdk.services.credentials.woot,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.MarkitOnDemand = ((function (credentials, helpers) {
  var exports = {};
    
    
    function get_method_call(method_name)
    {
          return function(params) 
          {
            var url = 'http://dev.markitondemand.com/Api/v2/' + method_name + '/json';
            if (params) url = url + '?' + $.param(params);
            return $.ajax({url: url, type: 'GET', dataType:'json'});
          };
    }
  
  
  exports.Lookup           = get_method_call('Lookup');
  exports.Quote            = get_method_call('Quote');
  
  
  
  
  return exports;
}))(intel.xdk.services.credentials.MarkitOnDemand,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.forecast = ((function (credentials, helpers) {
  'use strict';

  var FORECAST = 'https://api.forecast.io';

  var forecast_url = function(method, params) {
    return FORECAST + '/' + method + '/' + credentials.apiKey + '/' +
      params.latitude + ',' + params.longitude + (params.time ? (',' + params.time) : '');
  };

  return {
    forecast: function(params) {
      return $.ajax({
        type: 'GET',
        dataType: 'json',
        url: forecast_url('forecast', params)
      });
    }
  };

})
)(intel.xdk.services.credentials.forecast,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.EventBrite = ((function (credentials, helpers) {
  var exports = {};

  function getToken() {
    var db = window.localStorage;
    return db.getItem('eventbrite_access_token');
  }

  function showError(message){
    console.log(message);
    return message;
  }
  
  function convertKey(params, base, updated){
    if(params[base]){
      var temp = params[base];
      delete params[base];
      params[updated] = temp;
    }
    return params;
  }
    
  exports.authenticate = function(params) {
    var url ='https://www.eventbrite.com/oauth/authorize?';
    var urlParams = {
        client_id: credentials.apiKey,
        redirect_uri: params.redirect_uri,
        response_type: params.response_type
    };
    
    return helpers.oauth2Implicit(url, urlParams)
    .then(function(token){
      var db = window.localStorage;
      db.setItem('eventbrite_access_token', token);
      return token;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  }
  
  exports.eventSearch = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    convertKey(params, "venue_city", "venue.city");
    convertKey(params, "start_date_keyword", "start_date.keyword");
    
    var urlParams = $.extend({token: token}, params);
    var completeUrl = 'https://www.eventbriteapi.com/v3/events/search/?' +  $.param(urlParams);
    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };  
  
  return exports;
}))(intel.xdk.services.credentials.EventBrite,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.instagram = ((function (credentials, helpers) {
  var exports = {};

  function getToken() {
    var db = window.localStorage;
    return db.getItem('instagram_access_token');
  }

  function showError(message){
    console.log(message);
    return message;
  }

  /* Users */
  exports.authenticate = function(params) {
    var url = 'https://instagram.com/oauth/authorize/?';
    var param = {client_id: credentials.apiKey,
                 redirect_uri: params.redirect_uri,
                 response_type: params.response_type};
    return helpers.oauth2Implicit(url, param)
    .then(function(token){
      var db = window.localStorage;
      db.setItem('instagram_access_token', token);
      return token;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.user = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/' + params.userId + '?' +  $.param(urlParams);
    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userFeed = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/self/feed?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.userRecent = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/' + params.userId + '/media/recent?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.userLiked = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/self/media/liked?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  exports.userSearch = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/search?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Relationships */
  exports.userFollows = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/' + params.userId + '/follows?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.userFollowedBy = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/' + params.userId + '/followed-by?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.userRequestedBy = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/self/requested-by?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.userRelationship = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/users/' + params.userId + '/relationship?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Media */
  exports.media = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/media/' + params.mediaId + '?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.mediaSearch = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/media/search?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.mediaPopular = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/media/popular?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(feed){
      return feed;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Comments */
  exports.mediaComments = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/media/' + params.mediaId + '/comments?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  /* Likes */
  exports.mediaLikes = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/media/' + params.mediaId + '/likes?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };
  
  /* Tags */
  exports.tag = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/tags/' + params.tagName + '?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.tagRecent = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/tags/' + params.tagName + '/media/recent?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.tagSearch = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/tags/search?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Locations */
  exports.location = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/locations/' + params.locationId + '?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.locationRecent = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/locations/' + params.locationId + '/media/recent?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  exports.locationSearch = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/locations/search?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  /* Geographies */
  exports.geoRecent = function(params){
    var token = getToken();
    if (!token) return showError('Need access token before making call');

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.instagram.com/v1/geographies/' + params.geoId + '/media/recent?' + $.param(urlParams);

    return $.ajax({
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return showError(err.responseText);
    });
  };

  return exports;
}))(intel.xdk.services.credentials.instagram,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.db_core = ((function (credentials, helpers) {
  var exports = {};
  
  function getToken() {
    return window.localStorage.getItem('dropbox_access_token');
  }

  function showError(message){
    console.log(message);
    return message;
  }
  
  /* OAuth 2.0 */
  exports.authorize = function (params) {
    var urls = {codeUrl:'https://www.dropbox.com/1/oauth2/authorize?',
               tokenUrl: 'https://api.dropbox.com/1/oauth2/token?'};
    var urlParams = {
                     code: {
                       client_id: credentials.apiKey,
                       redirect_uri: params.redirect_uri,
                       response_type: params.response_type
                     },
                     token: {
                       client_secret: credentials.apiSecret
                     }
                    };
    
    if (params.state !== '') urlParams.code.state = params.state;
    if (params.force_reapprove !== '') urlParams.code.force_reapprove = params.force_reapprove;
    if (params.disable_signup !== '') urlParams.code.disable_signup = params.disable_signup;
    
    return helpers.oauth2AuthCode(urls, urlParams)
    .then(function(response){
      var token = response.access_token;
      var db = window.localStorage;
      db.setItem('dropbox_access_token', token);
      return response;
    })
    .fail(function(err){
      console.log(err.responseText);
    });
  };
  
  /* Dropbox Accounts */
  exports.accountInfo = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = {oauth_consumer_key: credentials.apiKey,
                     oauth_secret: credentials.apiSecret,
                     access_token: token};
    var url = 'https://api.dropbox.com/1/account/info?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'GET',
      dataType: 'json'
     })
    .then(function(response){
      return response;
    })
    .fail(function(error){
      return error;
    });
  };
  
  /* Files and Metadata */
  exports.metadata = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/metadata/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'GET',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };
  
  exports.delta = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/delta?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(response){
      return response;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.longpoll_delta = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api-notify.dropbox.com/1/longpoll_delta?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'GET',
      dataType: 'json'
     })
    .then(function(response){
      return response;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.revisions = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/revisions/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'GET',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.restore = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/restore/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.search = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/search/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'GET',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.shares = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/shares/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.media = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/media/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.copy_ref = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/copy_ref/' + params.root + '/' + params.path + '?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'GET',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  /* File Operations */
  exports.copy = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/fileops/copy?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.create_folder = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/fileops/create_folder?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.delete = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/fileops/delete?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      return error;
    });
  };

  exports.move = function (params) {
    var token = getToken();
    if (!token) return showError('Need access token before making call');
    
    var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
    var url = 'https://api.dropbox.com/1/fileops/move?' + $.param(urlParams);
    return $.ajax({
      url: url,
      type: 'POST',
      dataType: 'json'
     })
    .then(function(metadata){
      return metadata;
    })
    .fail(function(error){
      error.responseText
    });
  };
  
  exports.upload_file = function(params)
  {
      var token = getToken();
      if (!token) return showError('Need access token before making call');
      //params = jsonCleaner(params);
      var file = params.file;
      var path = encodeURI(params.path || file.name);
      delete params.path;
      delete params.file; 

      var urlParams = $.extend({oauth_consumer_key: credentials.apiKey,
                             oauth_secret: credentials.apiSecret,
                             access_token: token}, params);
      var url = 'https://api-content.dropbox.com/1/files_put/auto/' + 
                 path + 
                 '?'  + $.param(urlParams);
      
      if(file == '-')
      {
          var deferred = $.Deferred();
          deferred.resolve({'status':'ok'});
          return deferred.promise();
      }
      else
      {
          //var fd = new FormData();
          //fd.append(path, file);
          return $.ajax({
                  url: url,
                  type: "PUT",
                  data: file,
                  processData: false,  // tell jQuery not to process the data
                  contentType: false   // tell jQuery not to set contentType
                });
      }
  };

  return exports;
}))(intel.xdk.services.credentials.db_core,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.OpenTable = ((function (credentials, helpers) {
  var exports = {};
    
  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
    
  exports.stats = function (params) {
    var url = 'http://opentable.herokuapp.com/api/';
    url += 'stats';
    return $.ajax({url: url});
  };

  exports.cities = function (params) {
    var url = 'http://opentable.herokuapp.com/api/';
    url += 'cities';
    return $.ajax({url: url});
  };
    
  exports.restaurants = function (params) {
    params = jsonCleaner(params);
    var url = 'http://opentable.herokuapp.com/api/';
    url += 'restaurants';
    if (params) url = url + '?' + $.param(params);
    return $.ajax({url: url});
  };
    
  exports.restaurant_by_id = function (params) {
    //params = jsonCleaner(params);
    var url = 'http://opentable.herokuapp.com/api/';
    url += 'restaurants/' + params.id;
    //if (params) url = url + '?' + $.param(params);
    return $.ajax({url: url});
  };
  
 
  
  
  
  return exports;
}))(intel.xdk.services.credentials.OpenTable,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.google_analytics = ((function (credentials) {
  var exports = {};
    
  function init() {
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
    ga('create', credentials.apiKey, 'auto');
  }
    
  exports.trackPageView = function(params) {
      init();
      var d = $.Deferred();
      
      if (params.Location) ga('set','location', params.Location);
      if (params.Page) ga('set','page', params.Page);
      if (params.Title) ga('set','title', params.Title);
      ga('send', 'pageview');
      
      d.resolve('Pageview sent!');
      return d.promise();
  };
    
    exports.trackEvent = function(params) {
        init();
        var d = $.Deferred();
        if (params.Label) ga('set','eventLabel', params.Label);
        if (params.Value) ga('set','eventValue', params.Value);
        ga('send', 'event', params.Category, params.Action);
        d.resolve('Check your analytics account');
        return d.promise();
    };

  return exports;
}))(intel.xdk.services.credentials.google_analytics,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.RSS = ((function (credentials, helpers) {
  var exports = {};
  exports.Request = function (params) {
    
    return $.ajax(params);
  };
  
  

  
  return exports;
}))(intel.xdk.services.credentials.RSS,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.kinvey = ((function (credentials) {
  var exports = {};
  var isInit;

  /*Only Init*/
  function kinveyInit() {
    if(isInit) return emptyPromise();
    return kinveyToJqueryProm(Kinvey.init.bind(Kinvey,{appKey : credentials.apiKey, appSecret: credentials.apiSecret}))
    .then(function (result) {
      if(result) {isInit = true;}
      return result || {result: null};
    })
    .fail(function (err) {
      isInit = false
      return err.name + ' : ' + err.description + '\n' + err.debug;
    });
  }
  
  function emptyPromise(){
    var deferred = $.Deferred();
    deferred.resolve();
    return deferred.promise();
  }
  
  /*Init and then do the passed function. isSpecial = true, if passed function is not a kinvey promise;else false.*/
  function initThenCall(func, isSpecial) {
    isSpecial = isSpecial || false;
    return kinveyInit()
    .then(function (response)
    {
      if(isSpecial) {return func();}
      else{ return kinveyToJqueryProm(func);}
    })
    .fail(function(err){
      return err.name + ' : ' + err.description + '\n' + err.debug;
    })
  }

  function kinveyToJqueryProm(func, params) {
    var deferred = $.Deferred();
    func()
    .then(function (response) {
      deferred.resolve(response || true );
    }, function(err) {
      deferred.reject(err.name + ' : ' + err.description + '\n' + err.debug);
    }); 
    return deferred.promise();
  }
  
  function getActiveUser_() {
    var user = Kinvey.getActiveUser();
    if(null !== user) { return user; }
    else { return {result : null}; }
  }

  function logout_() {
    var user = Kinvey.getActiveUser();
    if(null !== user) { return Kinvey.User.logout() }
    else { return {result : null}; }
  }

  function verificationStatus_() {
    var user = Kinvey.getActiveUser();
    if(null !== user) { 
      emailStatus = new Kinvey.Metadata(user).getEmailVerification();
      return { status : emailStatus };
    }
    else { return {result : null}; }
  }
  function exists_(params) {
    return Kinvey.User.exists(params.username)
    .then(function(exists){
      return {result : (exists ? 'true':'false')};   
    });
  }
  function count_(params) {
    return Kinvey.DataStore.count(params.collection_name)
    .then(function(count){
      return {result : count};   
    });
  }

  exports.init = function (params) {
    isInit = false;
    return kinveyInit();
  };
  exports.getActiveUser = function () {
    return initThenCall(
      getActiveUser_.bind(Kinvey),
      true
   );
  };
  exports.signup = function(params) {
    return initThenCall(
      Kinvey.User.signup.bind(Kinvey.User, params)
    );
  };
  exports.destroy = function(params) {
    return initThenCall(
      Kinvey.User.destroy.bind(Kinvey.User, params.user_id)
    );
  };

  exports.login = function(params) {
    return initThenCall(
      Kinvey.User.login.bind(Kinvey.User, params)
    );
  };
  exports.logout = function() {
    return initThenCall(
      logout_.bind(Kinvey)
    );
  };
  exports.verifyEmail = function(params) {
    return initThenCall(
      Kinvey.User.verifyEmail.bind(Kinvey.User, params)
    );
  };
  exports.getActiveUserEmailVerification = function() {
    return initThenCall(
      verificationStatus_.bind(Kinvey),
      true
    );
  };
  exports.resetPassword = function(params) {
    return initThenCall(
      Kinvey.User.resetPassword.bind(Kinvey.User, params)
    );
  };
  exports.forgotUsername = function(params) {
    return initThenCall(
      Kinvey.User.forgotUsername.bind(Kinvey.User, params)
    );
  };
  exports.exists = function(params) {
    return initThenCall(
      exists_.bind(Kinvey.User, params)
    );
  };
  exports.Datastore_save = function (params) {
    var obj = {};
    obj[params.propName] = params.propValue;
    return initThenCall(
      Kinvey.DataStore.save.bind(Kinvey.Datastore, params.collection_name, obj)
    );
  };
  exports.Datastore_update = function (params) {
    var obj = {};
    obj['_id'] = params.entity_id;
    obj[params.propName] = params.propValue;
    return initThenCall(
      Kinvey.DataStore.update.bind(Kinvey.Datastore, params.collection_name, obj)
    );
  };
  exports.Datastore_get = function (params) {
    return initThenCall(
      Kinvey.DataStore.get.bind(Kinvey.Datastore, params.collection_name, params.entity_id)
    );
  };
  exports.Datastore_findAll = function (params) {
    return initThenCall(
      Kinvey.DataStore.find.bind(Kinvey.Datastore, params.collection_name, null)
    );
  };
  exports.Datastore_destroy = function (params) {
    return initThenCall(
      Kinvey.DataStore.destroy.bind(Kinvey.Datastore, params.collection_name, params.entity_id)
    );
  };
  exports.Datastore_clean = function (params) {
    return initThenCall(
      Kinvey.DataStore.clean.bind(Kinvey.Datastore, params.collection_name)
    );
  };
  exports.Datastore_count = function (params) {
    return initThenCall(
      count_.bind(Kinvey.Datastore, params)
    );
  };
  return exports;
}))(intel.xdk.services.credentials.kinvey,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.twitter = ((function (credentials, helpers) {
  var exports = {};

  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
  function getToken() {
    var db = window.localStorage;
    return db.getItem('twitter_access_token');
  }
  
  exports.authenticate = function(params) {
    var url = 'https://api.twitter.com/oauth2/token';
    var rfcConsumerKey = credentials.apiKey;
    var rfcConsumerSecret = credentials.apiSecret;
    var bearerToken = rfcConsumerKey + ':' + rfcConsumerSecret;
    var b64BearerToken = btoa(bearerToken);
    var header = 'Basic ' + b64BearerToken;
    var twitParams = {};

    return helpers.oauth2CC(url, twitParams, header)
    .then(function(response){
      var db = window.localStorage;
      db.setItem('twitter_access_token', response.access_token);
      return response.access_token;
    })
    .fail(function(err){
      console.log(JSON.stringify(err));
    });
  };

  /* Timelines */
  exports.user_timeline = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/statuses/user_timeline.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  /* Tweets */
  exports.get_retweets = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/statuses/retweets/' + params.id + '.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_tweets = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/statuses/show.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_retweeters = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/statuses/retweeters/ids.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.search_tweets = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    params.q = encodeURIComponent(params.q);

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/search/tweets.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  /* Friends & Followers */
  exports.get_friends = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/friends/ids.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_followers = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/followers/ids.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.show_friendship = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/friendships/show.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_friend_list = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/friends/list.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  /* Users */
  exports.lookup_user = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/users/lookup.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.show_user = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/users/show.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  /* Lists */
  exports.get_user_lists = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/lists/list.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_list_statuses = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/lists/statuses.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_list_memberships = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/lists/memberships.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_list_subscribers = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/lists/subscribers.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_list_members = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/lists/members.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_list = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/lists/show.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  /* Trends */
  exports.get_trends_place = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/trends/place.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_trends_available = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/trends/available.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.get_trends_closest = function(params) {
    params = jsonCleaner(params);
    var token = getToken();
    var header = 'Bearer ' + token;

    return $.ajax({
      type: 'GET',
      url: 'https://api.twitter.com/1.1/trends/closest.json?' + $.param(params),
      headers: {
        'Authorization': header
      }
    })
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };
  
  return exports;
}))(intel.xdk.services.credentials.twitter,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.UPS = ((function (credentials, helpers) {
  var exports = {};
    
  function createRequest(){
      
  };
  function createAccessSubstr(account_no, user_id, password){
      return '<?xml version="1.0"?><AccessRequest xml:lang="en-US"><AccessLicenseNumber>'+ account_no + '</AccessLicenseNumber>            <UserId>'+ user_id +'</UserId><Password>' + password +'</Password></AccessRequest>';
  };
  function createRequestTypeSubstr(request_type, customer_context, request_action, request_option, request_details_string){
      return '<?xml version="1.0"?><'+ request_type+ ' xml:lang="en-US"><Request><TransactionReference><CustomerContext>' + customer_context + '</CustomerContext><XpciVersion>1.0</XpciVersion></TransactionReference><RequestAction>'+ request_action +'</RequestAction><RequestOption>'+ request_option +'</RequestOption></Request>' + request_details_string + '</'+request_type+'>';
  };    
    
    
  exports.tracking = function (params) {
    var url = 'https://www.ups.com/ups.app/xml/Track' ;
      var request_type = 'TrackRequest';
      var customer_context = 'QAST Track';
      var request_action = 'Track';
      var request_option = 'activity';
      var access_string = createAccessSubstr(params.account_no, params.user_id, params.password);
      var request_details_string = '<TrackingNumber>' + params.tracking_no +'</TrackingNumber>';
      var request_string = createRequestTypeSubstr(request_type, customer_context, request_action, request_option, request_details_string);
      var xml_req = access_string + request_string;
    return $.ajax({url: url, 
                   data: xml_req,
                   type: 'POST'                   
                  });
  };
  exports.address_validation = function (params) {
    var url = 'https://www.ups.com/ups.app/xml/AV' ;
    var request_type = 'AddressValidationRequest';
    var customer_context = 'Maryam Dennis-Customer Data';
    var request_action = 'AV';
      var request_option = '';
      var access_string = createAccessSubstr(params.account_no, params.user_id, params.password);
      var request_details_string = '<Address><City>' + params.city +'</City><StateProvinceCode>' + params.StateProvinceCode + '</StateProvinceCode></Address>';
      var request_string = createRequestTypeSubstr(request_type, customer_context, request_action, request_option, request_details_string);
      var xml_req = access_string + request_string;
    return $.ajax({url: url, 
                   data: xml_req,
                   type: 'POST'                   
                  });      
  };
    exports.street_address_validation = function (params) {
    var url = 'https://www.ups.com/ups.app/xml/XAV' ;
    var request_type = 'AddressValidationRequest';
    var customer_context = '';
    var request_action = 'XAV';
      var request_option = '3';
      var access_string = createAccessSubstr(params.account_no, params.user_id, params.password);
      var request_details_string = '<AddressKeyFormat><AddressLine>' + params.address_line1 +'</AddressLine><AddressLine>' + params.address_line2 +'</AddressLine><PostCodePrimaryLow>' + params.postcode_primary + '</PostCodePrimaryLow><CountryCode>'+ params.country_code +'</CountryCode></AddressKeyFormat>';
      var request_string = createRequestTypeSubstr(request_type, customer_context, request_action, request_option, request_details_string);
      var xml_req = access_string + request_string;
    return $.ajax({url: url, 
                   data: xml_req,
                   type: 'POST'                   
                  });      
  };
    exports.locator = function (params) {
    var url = 'https://www.ups.com/ups.app/xml/Locator' ;
    var request_type = 'LocatorRequest';
    var customer_context = '';
    var request_action = 'Locator';
      var request_option = '1';
      var access_string = createAccessSubstr(params.account_no, params.user_id, params.password);
      var request_details_string = '<OriginAddress><AddressKeyFormat><AddressLine>' + params.address_line1 +'</AddressLine><AddressLine>' + params.address_line2 +'</AddressLine><PostCodePrimaryLow>' + params.postcode_primary + '</PostCodePrimaryLow><CountryCode>'+ params.country_code +'</CountryCode></AddressKeyFormat></OriginAddress>';
        request_details_string = request_details_string + '<Translate><LanguageCode>ENG</LanguageCode></Translate>';
        request_details_string = request_details_string + '<LocationSearchCriteria><SearchOption><OptionType><Code>' + params.search_criteria + '</Code></OptionType></SearchOption></LocationSearchCriteria>';
        
      var request_string = createRequestTypeSubstr(request_type, customer_context, request_action, request_option, request_details_string);
      var xml_req = access_string + request_string ;
    return $.ajax({url: url, 
                   data: xml_req,
                   type: 'POST'                   
                  });      
  };    
    
  
  return exports;
}))(intel.xdk.services.credentials.UPS,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.jambase = ((function (credentials, helpers) {
  var exports = {};
    
function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (var k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
  /* Data Feed Function */
  exports.methodA1 = function (params) {
    var url = 'http://example.api/methodA1?api_key_var_name=' + credentials.apiKey;
    return $.ajax({url: url});
  };
    
  function get_jambase_handler(endpoint_uri)
  {
      return function(params) {
        params = jsonCleaner(params);
        var url = endpoint_uri; 
        params.api_key = credentials.apiKey;
        url = url + '?' + $.param(params);
        return $.ajax({url: url, type: 'GET'});
      };
  }
    
  //all the 'eventById, eventListByZipcode, etc are just the same endpoint with different param combinations.
  function get_eventBy_method()
  {
      return get_jambase_handler('http://api.jambase.com/events');
  }
  
  function get_artistBy_method()
  {
      return get_jambase_handler('http://api.jambase.com/artists');
  }

  function get_venuesBy_method()
  {
      return get_jambase_handler('http://api.jambase.com/venues');
  }
  
  exports.eventById           = get_eventBy_method();
  exports.eventListByZipcode  = get_eventBy_method()
  exports.eventListByArtistId = get_eventBy_method();
  exports.eventListByVenueId  = get_eventBy_method();

  exports.artistsByName       = get_artistBy_method();
  exports.artistById          = get_artistBy_method();
  
  exports.venuesByName        = get_venuesBy_method();
  exports.venuesByZipcode     = get_venuesBy_method();
  exports.venueById           = get_venuesBy_method();
    
  return exports;
}))(intel.xdk.services.credentials.jambase,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.tms = ((function (credentials, helpers) {
  var exports = {};
  var version = 'v1.1';
  
  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (var k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  

  //a helper function
  exports.dateToISO8601 = function(d)
  {
      return d.toISOString().match(/[^:]*:[^:]*/)[0] + 'Z';
  };
    
  get_tms_iso8601_method = function(endpoint_uri)
  {
      return function(params)
      {
        params = jsonCleaner(params);
        var url = endpoint_uri;
        if(!params.startDateTime) //oddly, startDateTime is required.  
        {
            var now = new Date();
            params.startDateTime = exports.dateToISO8601(now);
        }
        params.api_key = credentials.apiKey;
        url = url + '?' + $.param(params);
        return $.ajax({url: url, type: 'GET'});
      };
  };
    
  exports.movieShowings = function(params) {
        params = jsonCleaner(params);
        var url = 'http://data.tmsapi.com/'+ version +'/movies/showings';
        if(!params.startDate) //oddly, startDate is required.  
        {
            var now = new Date();
            var now_str = now.toISOString();
            params.startDate = now_str.match(/[^T]*/)[0];
        }
        params.api_key = credentials.apiKey;
        url = url + '?' + $.param(params);
        return $.ajax({url: url, type: 'GET'});
  };
    
  exports.newShowAirings = get_tms_iso8601_method('http://data.tmsapi.com/'+ version +'/programs/newShowAirings');
    
  exports.movieAirings = get_tms_iso8601_method('http://data.tmsapi.com/'+ version +'/movies/airings');
    

  exports.sportEventAirings = function(params)
  {
    params = jsonCleaner(params);
    var url = 'http://data.tmsapi.com/'+ version +'/sports/';
    url += params.sportsId;
    delete params.sportsId;
    url += '/events/airings';
      
    if(!params.startDateTime) //oddly, startDateTime is required.  
    {
        var now = new Date();
        params.startDateTime = exports.dateToISO8601(now);
    }
    params.api_key = credentials.apiKey;
    url = url + '?' + $.param(params);
    return $.ajax({url: url, type: 'GET'});
  };

    /*
  exports.newShowAirings = function(params) {
        params = jsonCleaner(params);
        var url = 'http://data.tmsapi.com/v1/programs/newShowAirings';
        if(!params.startDateTime) //oddly, startDateTime is required.  
        {
            var now = new Date();
            params.startDateTime = exports.dateToISO8601(now);
        }
        params.api_key = credentials.apiKey;
        url = url + '?' + $.param(params);
        return $.ajax({url: url, type: 'GET'});
  };
    */
  
  
  
  
  return exports;
}))(intel.xdk.services.credentials.tms,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.soundcloud = ((function (credentials, helpers) {
  var exports = {};
  
  function getToken() {
    return window.localStorage.getItem('soundcloud_access_token');
  }

  /* OAuth Functions */
  exports.authenticate = function(params) {
    var url = {
      codeUrl: 'https://soundcloud.com/connect?',
      tokenUrl: 'https://api.soundcloud.com/oauth2/token?'
    };
    
    var urlParams = {
      code: {
        client_id: credentials.apiKey,
        redirect_uri: params.redirect_uri,
        response_type: 'code',
        scope: 'non-expiring',
        display: 'popup'
      },
      token: {
        client_secret: credentials.apiSecret,
        grant_type: 'authorization_code'
      }
    };
    
    return helpers.oauth2AuthCode(url, urlParams)
    .then(function(response){
      var token = response.access_token;
      var db = window.localStorage;
      db.setItem('soundcloud_access_token', token);
      return response;
    });
  };
  
  exports.users = function(params) {
    var url = 'http://api.soundcloud.com/users/' + params.id + '.json?client_id=' + credentials.apiKey;
    
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }
  
  exports.tracks = function(params) {
    var url = 'http://api.soundcloud.com/tracks/' + params.id + '.json?client_id=' + credentials.apiKey;
    
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }
  
  exports.playlists = function(params) {
    var url = 'http://api.soundcloud.com/playlists/' + params.id + '.json?client_id=' + credentials.apiKey;
    
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }
  
  exports.groups = function(params) {
    var url = 'http://api.soundcloud.com/groups/' + params.id + '.json?client_id=' + credentials.apiKey;
    
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }
  
  exports.comments = function(params) {
    var url = 'http://api.soundcloud.com/comments/' + params.id + '.json?client_id=' + credentials.apiKey;
    
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }
  
  exports.me = function(params){
    var token = getToken();
    var url = 'https://api.soundcloud.com/me.json?oauth_token=' + token;
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }

  exports.meConnections = function(params){
    var token = getToken();
    var url = 'https://api.soundcloud.com/me/connections.json?oauth_token=' + token;
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }

  exports.meActivities = function(params){
    var token = getToken();
    var url = 'https://api.soundcloud.com/me/activities?limit=' + params.limit + '&oauth_token=' + token;
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }

  exports.apps = function(params){
    var token = getToken();
    var url = 'http://api.soundcloud.com/apps/' + params.appId + '/tracks?client_id=' + credentials.apiKey + '&limit=' + params.limit;
    return $.ajax({
      url: url,
      type: 'GET'
    });
  }
  
  return exports;
}))(intel.xdk.services.credentials.soundcloud,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.github = ((function (credentials, helpers) {
  var exports = {};
  /* OAuth Functions */
  function authenticate(params) {
    var url = {
      codeUrl: 'https://github.com/login/oauth/authorize?',
      tokenUrl: 'https://github.com/login/oauth/access_token?'
    };
    var urlParams = {
      code: {
        client_id: credentials.apiKey,
        redirect_uri: params.redirect_uri,
        response_type: params.response_type,
        scope: params.scope
      },
      token: {
        client_id: credentials.apiKey,
        client_secret: credentials.apiSecret,
        grant_type: 'authorization_code'
      }
    };
    return helpers.oauth2AuthCode(url, urlParams)
    .then(function(response){
      var token = response.access_token;
      var db = window.localStorage;
      db.setItem('github_access_token', token);
      return response;
    });
  };

  function getNotifications(path, params){
    var token = window.localStorage.getItem('github_access_token');
    if (!token) return 'Need access token before making call';
    
    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.github.com/' + path + '?' + $.param(urlParams);
    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getRepoNotifications(path, params){
    var token = window.localStorage.getItem('github_access_token');
    if (!token) return 'Need access token before making call';

    var owner = params.owner;
    var repo = params.repo;
    delete params.owner;
    delete params.repo;
    
    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.github.com/repos/' + owner + '/' + repo + '/' + path + '?' + $.param(urlParams);

    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };
  
  function getEvents(params){
    var completeUrl = 'https://api.github.com/events';

    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getRepoEvents(params){
    var owner = params.owner;
    var repo = params.repo;
    var completeUrl = 'https://api.github.com/repos/' + owner + '/' + repo + '/events';

    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getIssueEvents(params){
    var owner = params.owner;
    var repo = params.repo;
    var completeUrl = 'https://api.github.com/repos/' + owner + '/' + repo + '/issues/events';

    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getUserReceivedEvents(params){
    var username = params.username;
    var completeUrl = 'https://api.github.com/users/' + username + '/received_events';

    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getUserPerformedEvents(params){
    var username = params.username;
    var completeUrl = 'https://api.github.com/users/' + username + '/events';

    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getIssues(params){
    var token = window.localStorage.getItem('github_access_token');
    if (!token) return 'Need access token before making call';

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.github.com/issues' + '?' + $.param(urlParams);
    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getRepos(params){
    var token = window.localStorage.getItem('github_access_token');
    if (!token) return 'Need access token before making call';

    var urlParams = $.extend({access_token: token}, params);
    var completeUrl = 'https://api.github.com/user/repos' + '?' + $.param(urlParams);
    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getUserRepos(params){
    var username = params.username;
    var completeUrl = 'https://api.github.com/users/' + username + '/repos';
    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function getAllRepos(params){
    var completeUrl = 'https://api.github.com/repositories' + '?' + $.param(params);
    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  function searchRepositories(params){
    var token = window.localStorage.getItem('github_access_token');
    if(token) {
      params = $.extend({access_token: token}, params);
    }

    var completeUrl = 'https://api.github.com/search/repositories' + '?' + $.param(params);
    return $.ajax({
      headers: { 
        Accept : "application/vnd.github.v3+json"
      },
      url: completeUrl,
      type: 'GET',
      dataType: 'json'})
    .then(function(response){
      return response;
    })
    .fail(function(err){
      return err.responseText;
    });
  };

  exports.authenticate = authenticate.bind(null);
  exports.getNotifications = getNotifications.bind(null, 'notifications');
  exports.getEvents = getEvents.bind(null);
  exports.getRepoEvents = getRepoEvents.bind(null);
  exports.getIssueEvents = getIssueEvents.bind(null);
  exports.getUserReceivedEvents = getUserReceivedEvents.bind(null);
  exports.getUserPerformedEvents = getUserPerformedEvents.bind(null);
  exports.getIssues = getIssues.bind(null);
  exports.getRepos = getRepos.bind(null);
  exports.getUserRepos = getUserRepos.bind(null);
  exports.getAllRepos = getAllRepos.bind(null);
  exports.searchRepositories = searchRepositories.bind(null);
  
  return exports;
}))(intel.xdk.services.credentials.github,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.centralIndex = ((function (credentials, helpers) {
  var exports = {};
  
  var baseUrl = 'http://api.centralindex.com';
  
  function getCentralIndexData(type, path, params) {
    console.log(credentials.apiKey);
    var url = baseUrl + path + '?api_key=' + credentials.apiKey + $.param(params);
    return $.ajax({
      type: type,
      url: url
    });
  }

  exports.advertiserUpdated =  getCentralIndexData.bind(null, 'GET', '/v1/advertiser/updated');
  exports.autocompleteCategory = getCentralIndexData.bind(null, 'GET', '/v1/autocomplete/category');
  exports.autocompleteKeyword = getCentralIndexData.bind(null, 'GET', '/v1/autocomplete/keyword');
  exports.autocompleteLocation = getCentralIndexData.bind(null, 'GET', '/v1/autocomplete/location');
  exports.entity = getCentralIndexData.bind(null, 'GET', '/v1/entity');
  exports.entityAdvertisers = getCentralIndexData.bind(null, 'GET', '/v1/entity/advertisers');
  exports.entitySupplier = getCentralIndexData.bind(null, 'GET', '/v1/entity/by_supplier_id');
  exports.entitySearchKeywordNearest = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/keyword/bynearest');
  exports.entitySearchWhat = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/what');
  exports.entitySeatchWhatLocation = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/what/bylocation');
  exports.entitySearchWhatBoundingBox = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/what/byboundingbox');
  exports.entitySearchWhatNearest = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/what/bynearest');
  exports.entitySearchWho = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/what/bylocation');
  exports.entitySearchWhoLocation = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/who/bylocation');
  exports.entitySearchWhatBoundingBox = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/who/byboundingbox');
  exports.entitySearchWhatNearest = getCentralIndexData.bind(null, 'GET', '/v1/entity/search/who/bynearest');
  exports.locationContext = getCentralIndexData.bind(null, 'GET', '/v1/location/context');

  return exports;
}))(intel.xdk.services.credentials.centralIndex,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.Weibo = ((function (credentials, helpers) {
  var exports = {};
  
  function getCachedToken () {
    if ($.jStorage && $.jStorage.storageAvailable()) {
      return $.jStorage.get("intel_xdk_services_sina_weibo_access_token_");
    }
    return null;
  }
  
  function showError(msg) {
    console.log(msg);
    return msg;
  }
  
  exports.get_access_token = function(params) {
    var url = {
      codeUrl: 'https://api.weibo.com/oauth2/authorize?',
      tokenUrl: 'https://api.weibo.com/oauth2/access_token?'
    };
    var deferred = $.Deferred();
    
    var jStorageAvailable = false, keyName, accessToken;
    if ($.jStorage && $.jStorage.storageAvailable()) {
      jStorageAvailable = true;
      keyName = "intel_xdk_services_sina_weibo_access_token_";
      accessToken = $.jStorage.get(keyName);
      if (accessToken) {
        deferred.resolve({access_token: accessToken});
        return deferred.promise();
      }
    }
    
    var urlParams = {
      code: {
        client_id: credentials.apiKey,
        redirect_uri: params.redirect_uri,
        response_type: "code",
        scope: params.scope,
        forcelogin: params.forcelogin
      },
      token: {
        client_id: credentials.apiKey,
        client_secret: credentials.apiSecret,
        grant_type: 'authorization_code'
      }
    };
    
    //helper oauth functions return access token. check to see if service uses authentication code or implicit oauth
    
    helpers.oauth2AuthCode(url, urlParams)
    .then(function(response){
      var access_token = response.access_token;
      if (jStorageAvailable) {
        $.jStorage.set(keyName, access_token, {TTL: 24 * 3600 * 1000});
      }
      deferred.resolve({ access_token: access_token });
    })
    .fail(function(err){
      deferred.reject(err);
    });
    
    return deferred.promise();
  };
  
  exports.update = function(params) {
    var filteredParams = {}, d = $.Deferred();
    for (var k in params) {
      if (params.hasOwnProperty(k) && params[k]) {
        filteredParams[k] = params[k];
      }
    }
    
    var access_token;
    if (!filteredParams.access_token) {
      access_token= getCachedToken();
      if (!access_token) {
        d.reject(showError("Need access token before making call"));
        return d.promise();
      } else {
        filteredParams.access_token = access_token;
      }
    }
    var url = "https://api.weibo.com/2/statuses/update.json";
    return $.ajax({
      url: url,
      type: 'POST',
      data: filteredParams
    });
  };
  
  exports.upload = function(params) {
    var d = $.Deferred();
    var access_token;
    if (!params.access_token) {
      access_token = getCachedToken();
      if (!access_token) {
        d.reject(showError("Need access token before making call"));
        return d.promise();
      } else {
        params.access_token = access_token;
      }
    }
    var url = "https://upload.api.weibo.com/2/statuses/upload.json";
    var fd;

    if(params.pic == '-')
    {
      d.resolve({'status':'ok'});
      return d.promise();
    }

    fd = new FormData();
    for (var i in params) {
      if (params.hasOwnProperty(i) && params[i]) {
        fd.append(i, params[i]);
      }
    }

    return $.ajax({
      url: url,
      type: "POST",
      data: fd,
      processData: false,  // tell jQuery not to process the data
      contentType: false   // tell jQuery not to set contentType
    });
  };
  
  return exports;
}))(intel.xdk.services.credentials.Weibo,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.mapquest = ((function (credentials, helpers) {
  'use strict';

  var MAPQUEST = 'https://www.mapquestapi.com/traffic/v2/';

  return {
    incidents: function(params) {
      var url = MAPQUEST + 'incidents?inFormat=kvp&key=' + credentials.apiKey;
      url += '&boundingBox=' + params.boundingBox;
      url += '&incidents=';

      var incidents = {
        incidents: params.incidents,
        construction: params.construction,
        event: params.event,
        congestion: params.congestion
      };

      url += Object.keys(incidents).filter(function(incident) {
        return incidents[incident] === 'true';
      }).join(',');

      return $.ajax({
        type: 'GET',
        url:  url
      });
    }
  };

})
)(intel.xdk.services.credentials.mapquest,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.amazon_product_search = ((function (credentials, helpers) {
  var exports = {};
    
    function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (var k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
    function sort_params(params)
    {
        var keys = Object.keys(params);
        keys.sort();
        var newparams  ={}
        keys.forEach(function(k){ newparams[k] = params[k]; });
        return newparams;
    }
    
    function timestamp(date) {
    //var date = new Date();
    var y = date.getUTCFullYear().toString();
    var m = (date.getUTCMonth() + 1).toString();
    var d = date.getUTCDate().toString();
    var h = date.getUTCHours().toString();
    var min = date.getUTCMinutes().toString();
    var s = date.getUTCSeconds().toString();

    if(m.length < 2) { m = "0" + m; }
    if(d.length < 2) { d = "0" + d; }
    if(h.length < 2) { h = "0" + h; }
    if(min.length < 2) { min = "0" + min; }
    if(s.length < 2) { s = "0" + s}

    var date = y + "-" + m + "-" + d;
    var time = h + ":" + min + ":" + s;
    return date + "T" + time + "Z";
}
    
    function sha256(stringToSign, secretKey) 
    {
        var hex = CryptoJS.HmacSHA256(stringToSign, secretKey);
        return hex.toString(CryptoJS.enc.Base64);
    } 
    
    function date_string(now)
    {
        var date_str = now.toISOString().match(/[^T]*/)[0];
        return date_str.replace(/-/g, "");
    }
    
    function get_aws_cs_function(operation)
    {
        return function(params) {
      
                var url = 'http://webservices.amazon.com/onca/xml';
                params = jsonCleaner(params);

                params.Service = 'AWSECommerceService';
                params.Operation = operation;
                params.AWSAccessKeyId = credentials.apiKey;
                var now = new Date();
                params.Timestamp = timestamp(now); //now.toISOString();

                params = sort_params(params);

                var paramString = $.param(params);
                var signingKey = "GET\n" + "webservices.amazon.com\n" + "/onca/xml\n" + paramString;
                var signature = sha256(signingKey, credentials.apiSecret);
                params.Signature = signature;

                url = url + '?' +  $.param(params);
                return $.ajax({url: url, type: 'GET'});
              };
    }
    
    exports.ItemSearch       = get_aws_cs_function('ItemSearch');
    exports.BrowseNodeLookup = get_aws_cs_function('BrowseNodeLookup');
    exports.ItemLookup       = get_aws_cs_function('ItemLookup');
    exports.SimilarityLookup = get_aws_cs_function('SimilarityLookup');
  
    /*
  exports.ItemSearch = function(params) {
      
    var url = 'http://webservices.amazon.com/onca/xml';
    params = jsonCleaner(params);
    
    params.Service = 'AWSECommerceService';
    params.Operation = 'ItemSearch';
    params.AWSAccessKeyId = credentials.apiKey;
    var now = new Date();
    params.Timestamp = timestamp(now); //now.toISOString();
      
    params = sort_params(params);

    var paramString = $.param(params);
    var signingKey = "GET\n" + "webservices.amazon.com\n" + "/onca/xml\n" + paramString;
    var signature = sha256(signingKey, credentials.apiSecret);
    params.Signature = signature;
    
    url = url + '?' +  $.param(params);
    return $.ajax({url: url, type: 'GET'});
  };
  */
    
    function getAmazonItemInfo(barcode) {
    var PrivateKey = "";
    var PublicKey = "";
    var AssociateTag = "";

    var parameters = [];
    parameters.push("AWSAccessKeyId=" + PublicKey);
    parameters.push("ItemId=" + barcode);
    parameters.push("Operation=ItemLookup");
    parameters.push("Service=AWSECommerceService");
    parameters.push("Timestamp=" + encodeURIComponent(timestamp()));
    parameters.push("Version=2011-08-01");
parameters.push("AssociateTag=" + AssociateTag);

    parameters.sort();
    var paramString = parameters.join('&');

    var signingKey = "GET\n" + "webservices.amazon.com\n" + "/onca/xml\n" + paramString

    var signature = sha256(signingKey,PrivateKey);
        signature = encodeURIComponent(signature);

    var amazonUrl =  "http://webservices.amazon.com/onca/xml?" + paramString + "&Signature=" + signature;
    console.log(amazonUrl);
}
  
  
  return exports;
}))(intel.xdk.services.credentials.amazon_product_search,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.bing_search = ((function (credentials, helpers) {
  var exports = {};

 function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
  exports.search = function(params) {
      //http://api.bing.net/json.aspx?Appid=<Your App ID HERE!>&query=sushi&sources=web.
    params = JSON.parse(JSON.stringify(params));//make a copy of params. Can't delete from original object.
    params = jsonCleaner(params);
    var url = 'https://api.datamarket.azure.com/Bing/Search/';
    var searchSpace = params.SearchSpace;
    delete params.SearchSpace;
    params.Query = "'" + params.Query + "'"; 
    url = url + searchSpace +  '?' + $.param(params) + "&$format=JSON";
    var username = "";
    var password = credentials.apiKey;
      
    return $.ajax({url: url, 
                   type: 'GET',
                   headers: {"Authorization":"Basic " + btoa(username + ":" + password)}
                  });
                  
  };
  
  
  
  return exports;
}))(intel.xdk.services.credentials.bing_search,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.BaiduMap = ((function (credentials, helpers) {
    var exports = {};
    exports.getIPLocation = function (params) {
        var url = 'http://api.map.baidu.com/location/ip?ak=' + credentials.apiKey + '&coor=bd09ll';
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                ip: params.ip_address
            }
        });
    };

    exports.enGeoCode = function (params) {
        var url = 'http://api.map.baidu.com/geocoder/v2/?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                address: params.address
            }
        });
    };

    exports.deGeoCode = function (params) {
        var url = 'http://api.map.baidu.com/geocoder/v2/?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                location: params.latitude + ',' + params.longitude
            }
        });
    };

    exports.roundNearBy = function (params) {
        var url = 'http://api.map.baidu.com/place/v2/search?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                location: params.location,
                query: params.query,
                radius: params.radius
            }
        });
    };

    exports.getNearByGrouponInfo = function (params) {
        var url = 'http://api.map.baidu.com/place/v2/eventsearch?event=groupon&output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                location: params.location,
                query: params.query,
                region: params.region,
                radius: params.radius,
                page_size: params.page_size
            }
        });
    };

    exports.getPlaceByCity = function (params) {
        var url = 'http://api.map.baidu.com/place/v2/search?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                query: params.query,
                scope: params.scope,
                region: params.region,
                page_num: params.page_num,
                page_size: params.page_size
            }
        });
    };

    exports.getPlacesByRectangleArea = function (params) {
        var url = 'http://api.map.baidu.com/place/v2/search?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                query: params.query,
                scope: params.scope,
                bounds: params.bounds,
                page_num: params.page_num,
                page_size: params.page_size
            }
        });
    };

    exports.getPlacesByRoundArea = function (params) {
        var url = 'http://api.map.baidu.com/place/v2/search?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                query: params.query,
                scope: params.scope,
                location: params.location,
                radius: params.radius,
                page_num: params.page_num,
                page_size: params.page_size
            }
        });
    };

    exports.getDirection = function (params) {
        var url = 'http://api.map.baidu.com/direction/v1?output=json&ak=' + credentials.apiKey;
        return $.ajax({
            url : url,
            type: 'GET',
            dataType: 'json',
            data: {
                mode: params.mode,
                origin: params.origin,
                destination: params.destination,
                region: params.region,
                origin_region: params.origin_region,
                destination_region: params.destination_region,
                tactics: params.tactics
            }
        });
    };

    return exports;
}))(intel.xdk.services.credentials.BaiduMap,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.youtube = ((function (credentials, helpers) {
  var exports = {};
  var aToken;

  var baseURL = 'https://www.googleapis.com/youtube/v3';
  function getList(path, params){
    params = params || {};
    var paramsExpanded = jsonCleaner(params);
    url = baseURL + '/' + path + '?' + $.param(paramsExpanded) + '&key=' + credentials.apiKey;
    return $.ajax({url: url});
  };
    /* authentication */
  function authenticate(params) {
    if (aToken) {
      var d = $.Deferred();
      d.resolve('Already authenticated');
      return d.promise();
    }
    var url = {codeUrl: 'https://accounts.google.com/o/oauth2/auth?',
               tokenUrl: 'https://accounts.google.com/o/oauth2/token?'};
    var urlParams = {code: {
                        client_id: params.client_id,
                        redirect_uri: params.redirect_uri,
                        response_type: params.response_type,
                        scope: params.scope_list,
                        access_type : 'offline'
                     },
                     token: {
                        client_secret: credentials.apiSecret,
                        grant_type: 'authorization_code'
                     }
                    };
    return helpers.oauth2AuthCode(url, urlParams)
    .then(function(response){
      var token = response.access_token;
      aToken = token;
      return response;
    })
    .fail(function(err){
      console.log(err.responseText);
    });
  };
  function auth_post(func, params) {
    var authParams = {} //TODO
    return exports.authenticate(authParams)
    .then(function (youtube) {
      var paramIn = 'id=' + params.id + ',rating=' + params.rating;
      return youtube.videos().rate(paramIn);
    })
    .fail(function(err){
      console.log(err.responseText);
    });

  }

  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
  exports.authenticate = authenticate.bind(null);
  exports.rateVideos = auth_post.bind(null,'rateVideos');
  exports.listActivities = getList.bind(null,'activities');
  exports.listGuideCategories = getList.bind(null,'guideCategories');
  exports.listPlaylistItems = getList.bind(null,'playlistItems');
  exports.listPlaylists = getList.bind(null,'playlists');
  exports.listSearch = getList.bind(null,'search');
  exports.listVideos = getList.bind(null,'videos');
  return exports;
}))(intel.xdk.services.credentials.youtube,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.Etsy = ((function (credentials) {
  var exports = {};
  
  function jsonCleaner(x) {
    var type = typeof x;
    if (x instanceof Array) {
      type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
      for (k in x) {
        var v = x[k];
        if ((v === '') && (type == 'object')) {
          delete x[k];
        } else {
          jsonCleaner(v);
        }
      }
      return x;
    }
  }
  
  var baseUrl = 'https://openapi.etsy.com/v2/';
  
  function getEtsyData(path, params){
    params = jsonCleaner(params);
    var url = baseUrl + path + '?api_key=' + credentials.apiKey + "&" + $.param(params);
    return $.ajax({url: url});
  }

  exports.listingSearch = getEtsyData.bind('null', 'listings/active');
  exports.listingTrending = getEtsyData.bind('null', 'listings/trending');
  exports.shopSearch = getEtsyData.bind('null', 'shops');
  exports.treasurySearch = getEtsyData.bind('null', 'treasuries');
  exports.userSearch = getEtsyData.bind('null', 'users');
  
  return exports;
}))(intel.xdk.services.credentials.Etsy,intel.xdk.services.iodocs_.helpers);
intel.xdk.services.iodocs_.edmunds = ((function (credentials, helpers) {
  var exports = {};
    
    function make_request(params, url)
    {
        params.api_key = credentials.apiKey;
        params.fmt     = 'json';

        url = url + '?' +  $.param(params);
        return $.ajax({url: url, type: 'GET'});
    }
    
    function by_id_function(url_str, post_url)
    {
        return function(params)
        {
            var id = params.id;
            delete params.id;
            var url = url_str + id + (post_url || '');
            return make_request(params, url);
        }
    }
    
    function by_style_zip_function(url_str)
    {
         return function (params)
         {
             var styleid = params.styleid;
             var zip     = params.zip;
             delete params.styleid;
             delete params.zip
             var url = url_str + styleid + '/' + zip;
             return make_request(params, url);
         };
    }
    function by_args_function(url_str, args, post_url)
    {
         return function (params)
         {
             var url = url_str;
             for(var i=0; i< args.length; i++)
             {
                 var val = params[args[i]];
                 delete params[args[i]];
                 url += '/' + val;
             }
             url += (post_url || '');
             
             return make_request(params, url);
         };
    }
    
    function by_url_function(url)
    {
        return function(params)
        {
            return make_request(params, url);
        }
    }
  
  // VEHICLE MAKE
  exports.GetAllMakes = by_url_function('https://api.edmunds.com/api/vehicle/v2/makes');
    
  exports.CarDetailsByName = function (params) {
    var make = params.make;
    delete params.make;
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make ;
      
    return make_request(params, url);
  };
  
  exports.GetMakesCount = by_url_function('https://api.edmunds.com/api/vehicle/v2/makes/count');
    
  //VEHICLE MODEL
  exports.DetailsByMakeAndModel = function (params) {
    var make   = params.make;
    var model  = params.model;
      
    delete params.make;
    delete params.model;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model ;
      
    return make_request(params, url);
  };  
    
  
  exports.GetAllCarModelsByCarMake = function (params) {
    var make   = params.make;
    delete params.make;
    
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/models' ;
      
    return make_request(params, url);
  };  
    
  exports.GetCarModelsCount = function (params) {
    var make   = params.make;
    delete params.make;
    
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/models/count' ;
      
    return make_request(params, url);
  }; 
    
  //VEHICLE MODEL YEAR
  exports.GetCarModelYearByCarMakeAndModel = function (params) {
    var make   = params.make;
    var model  = params.model;
      
    delete params.make;
    delete params.model;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model + '/years';
      
    return make_request(params, url);
  };  
    
  exports.GetInfoByCarMakeAndModelAndCarYear = function (params) {
    var make   = params.make;
    var model  = params.model;
    var year   = params.year;
      
    delete params.make;
    delete params.model;
    delete params.year;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model + '/' + year;
      
    return make_request(params, url);
  };  
    
  exports.GetCarModelYearsCountByMakeAndModel = function (params) {
    var make   = params.make;
    var model  = params.model;
      
    delete params.make;
    delete params.model;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model + '/years/count';
      
    return make_request(params, url);
  };  
    
  //VEHICLE STYLE
  exports.GetStyleDetails = by_id_function('https://api.edmunds.com/api/vehicle/v2/styles/');  
    
  exports.GetStyleDetailsByMakeModelYear = function (params) {
    var make   = params.make;
    var model  = params.model;
    var year   = params.year;
      
    delete params.make;
    delete params.model;
    delete params.year;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model + '/' + year + '/styles';
      
    return make_request(params, url);
  }; 
    
  exports.GetStylesCountByMakeModelYear = function (params) {
    var make   = params.make;
    var model  = params.model;
    var year   = params.year;
      
    delete params.make;
    delete params.model;
    delete params.year;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model + '/' + year + '/styles/count';
      
    return make_request(params, url);
  }; 
    
  exports.GetStylesCountByMakeModel = function (params) {
    var make   = params.make;
    var model  = params.model;
      
    delete params.make;
    delete params.model;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make + '/' + model + '/' + '/styles/count';
      
    return make_request(params, url);
  }; 
    
   exports.GetStylesCountByMake = function (params) {
    var make   = params.make;
      
    delete params.make;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/' + make +  '/styles/count';
      
    return make_request(params, url);
  }; 
    
  exports.GetStylesCount = by_url_function('https://api.edmunds.com/api/vehicle/v2/styles/count');
  
    
  exports.GetStylesDetailsByVehicleChromeID = function (params) {
    var chromeid   = params.chromeid;
      
    delete params.chromeid;
      
    var url = 'https://api.edmunds.com/api/vehicle/v2/partners/chrome/styles/' + chromeid;
      
    return make_request(params, url);
  }; 
    
  exports.GetListOfOptionsByStyleID    = by_id_function('https://api.edmunds.com/api/vehicle/v2/styles/', '/options');    
  exports.GetOptionsDetailsByID        = by_id_function('https://api.edmunds.com/api/vehicle/v2/options/');
  exports.GetListOfColorsByStyleID     = by_id_function('https://api.edmunds.com/api/vehicle/v2/styles/', '/colors');
  exports.GetColorDetailsByID          = by_id_function('https://api.edmunds.com/api/vehicle/v2/colors/');
  exports.GetEnginesByStyleID          = by_id_function('https://api.edmunds.com/api/vehicle/v2/styles/', '/engines');
  exports.GetEnginesDetailsByID        = by_id_function('https://api.edmunds.com/api/vehicle/v2/engines/');  
  exports.GetTransmissionsByStyleID    = by_id_function('https://api.edmunds.com/api/vehicle/v2/styles/', '/transmissions' );
  exports.GetTransmissionDetailsByID   = by_id_function('https://api.edmunds.com/api/vehicle/v2/transmissions/');
  exports.GetEquipmentDetailsByStyleID = by_id_function('https://api.edmunds.com/api/vehicle/v2/styles/', '/equipment');
  exports.GetEquipmentDetailsByID      = by_id_function('https://api.edmunds.com/api/vehicle/v2/equipment/');
  exports.GetVehicleDetailsBySquishVIN = by_id_function('https://api.edmunds.com/api/vehicle/v2/squishvins/');
    
  exports.GetConfiguredVehicleByZipAndStyle = by_url_function('https://api.edmunds.com/v1/api/configurator/default');
  exports.GetConfiguredVehicleWithOptions   = by_url_function('https://api.edmunds.com/v1/api/configurator/withOptions');      
    
  exports.GetPhotoByStyleID = function (params) {
      
    var url = 'https://api.edmunds.com/v1/api/vehiclephoto/service/findphotosbystyleid';
    //the final request has URL partials in it. I'd love to reconstruct a full image URL from them,
    //but can't find the docs for how to do so.
    return make_request(params, url);
  };
    
 exports.NewTCObyStyleAndZip             = by_style_zip_function('https://api.edmunds.com/v1/api/tco/newtruecosttoownbystyleidandzip/');
 exports.UsedTCObyStyleAndZip            = by_style_zip_function('https://api.edmunds.com/v1/api/tco/usedtruecosttoownbystyleidandzip/');
 exports.NewTotalCashPriceByStyleAndZip  = by_style_zip_function('https://api.edmunds.com/v1/api/tco/newtotalcashpricebystyleidandzip/');
 exports.UsedTotalCashPriceByStyleAndZip = by_style_zip_function('https://api.edmunds.com/v1/api/tco/usedtotalcashpricebystyleidandzip/');
 exports.GetVehicleMakesWithTCOdata      = by_url_function('https://api.edmunds.com/v1/api/tco/getmakeswithtcodata'); 
 exports.GetVehicleModelsWithTCOdata     = by_url_function('https://api.edmunds.com/v1/api/tco/getmodelswithtcodata');
 exports.GetVehicleStylesWithTCOdata     = by_url_function('https://api.edmunds.com/v1/api/tco/getstyleswithtcodatabysubmodel');    
 exports.AllNewTCObyStyleAndZipAndState  = by_args_function('https://api.edmunds.com/api/tco/v1/details/allnewtcobystyleidzipandstate', ['styleid', 'zip', 'state']);   
 exports.AllUsedTCObyStyleAndZipAndState = by_args_function('https://api.edmunds.com/api/tco/v1/details/allusedtcobystyleidzipandstate', ['styleid', 'zip', 'state']);       
 exports.TMVforNameYearMSRPandZip = by_args_function('https://api.edmunds.com/api/v1/vehicle', ['make', 'year'], '/price');
    
 exports.TMVforVINandMSRPandZip   = by_args_function('https://api.edmunds.com/api/v1/vehicle/vin', ['vin'], '/price');
 exports.TMVforStyleAndZip        = by_url_function('https://api.edmunds.com/v1/api/tmv/tmvservice/calculatenewtmv');
 exports.TMVforUsed               = by_url_function('https://api.edmunds.com/v1/api/tmv/tmvservice/calculateusedtmv');
 exports.TMVforTypical            = by_url_function('https://api.edmunds.com/v1/api/tmv/tmvservice/calculatetypicallyequippedusedtmv');
 exports.TMV_Certified            = by_url_function('https://api.edmunds.com/v1/api/tmv/tmvservice/findcertifiedpriceforstyle');
 exports.GetRatingByMakeModelYear = by_args_function('https://api.edmunds.com/api/vehicle/v2/grade', ['make', 'model', 'year']);
 exports.GetRatingByStyle         = by_args_function('https://api.edmunds.com/api/vehicle/v2/grade', ['styleid']);
    
 exports.GetReviewByMakeModelYear = by_args_function('https://api.edmunds.com/api/vehiclereviews/v2/', ['make', 'model', 'year']);
 exports.GetReviewByStyle         = by_args_function('https://api.edmunds.com/api/vehiclereviews/v2/styles', ['styleid']);
    
  return exports;
}))(intel.xdk.services.credentials.edmunds,intel.xdk.services.iodocs_.helpers);
/*xdk-auto-gen:service-methods:common:end*/
/*xdk-auto-gen:service-methods:uarss:start:a397d92f65c754eee581ca5c619e6a34*/
intel.xdk.services.uarss=intel.xdk.services.iodocs_.bindCommon.bind(null,"intel.xdk.services.uarss",intel.xdk.services.iodocs_.RSS.Request,{url:"https://www.youtube.com/feeds/videos.xml?channel_id=UCHqvw9v2Fp6o006lUskoigg",__proto__:{}});
/*xdk-auto-gen:service-methods:uarss:end*/
