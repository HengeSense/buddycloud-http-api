/*
 * Copyright 2012 buddycloud
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// sync.js:
// Handles requests to synchronize unread counters and posts (/sync).

var config = require('./util/config')
  , session = require('./util/session')
  , api = require('./util/api')
  , recent = require('./util/recent')
  , pubsub = require('./util/pubsub')
  , url = require('url')
  , crypto = require('crypto')
  , ltx = require('ltx')

/**
 * Registers resource URL handlers.
 */
exports.setup = function(app) {
  app.get('/sync',
           session.provider,
           getRecentItems);
};

//// GET /sync /////////////////////////////////////////////////////////////

function getRecentItems(req, res) {
  var user = req.user;
  if (!user) {
    api.sendUnauthorized(res);
    return;
  }

  var params = url.parse(req.url, true).query;
  var since = params.since;
  var max = params.max;
  var summary = params.summary && params.summary == 'true';

  var jsonResponse = {};
  var rsmLast;

  var callback = function(reply) {
    var rsm = recent.rsmToJSON(reply);
    recent.toJSON(reply, jsonResponse, user, summary);
    if (rsm.last) {
      if (rsm.last === rsmLast) {
        res.send(500);
      }

      rsmLast = rsm.last;
      requestRecentItems(req, res, since, max, callback, rsm.last);
    } else {
      res.contentType('json');
      res.send(jsonResponse);
    }
  };

  requestRecentItems(req, res, since, max, callback);
}

function iq(attrs, ns) {
  return new ltx.Element('iq', attrs).c('pubsub', {xmlns: ns});
}

function createRecentItemsIQ(since, max, after) {
  var pubsubNode = iq({type: 'get'}, pubsub.ns);
  pubsubNode.c('recent-items', {xmlns: 'http://buddycloud.org/v1', since: since, max: max});
  if (after) {
    var rsm = pubsubNode.c('set', {xmlns: 'http://jabber.org/protocol/rsm'});
    rsm.c('after').t(after);
  }
  return pubsubNode.root();
}

function requestRecentItems(req, res, since, max, callback, after) {
  var searchIq = createRecentItemsIQ(since, max, after);
  api.sendQuery(req, res, searchIq, callback);
}