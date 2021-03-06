/*
  Copyright (C) 2018  Miniverse authors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, version 3 of the License.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { parse } from 'cookie';
import { randomBytes } from 'crypto';
import sapper from 'sapper';
import { promisify } from 'util';
import Challenge from '../../lib/challenge';
import Cookie from '../../lib/cookie';
import Store from '../../lib/store';
import App from '../app';
import { routes } from '../manifest/server';
const Arena = require('bull-arena');
const express = require('express');

const promisifiedRandomBytes = promisify(randomBytes);

export default (repository, port) => {
  const application = express();

  application.use(
    express.static('assets'),
    (request, response, next) => {
      request.repository = repository;
      next();
    },
    (request, response, next) => {
      const cookie = request.headers.cookie && parse(request.headers.cookie);
      let asyncAccount;

      if (cookie && cookie.miniverse) {
        const digest = Cookie.digest(Cookie.parseToken(cookie.miniverse));
        asyncAccount = repository.selectLocalAccountByDigestOfCookie(digest);
      } else {
        asyncAccount = Promise.resolve();
      }

      if (process.env.NODE_ENV != 'development') {
        response.set({
          'Content-Security-Policy': 'default-src \'none\'; connect-src \'self\' data:; script-src \'self\' \'unsafe-inline\'',
          'Referrer-Policy': 'no-referrer'
        });
      }

      asyncAccount.then(async account => {
        if (/^\/bull/i.test(request.path)) {
          if (!account || !account.admin) {
            response.sendStatus(401);
            return;
          }

          next();
        } else if (account) {
          const person = await account.selectPerson();
          const activityStreams = await person.toActivityStreams();

          request.nonce = null;
          request.user = account;
          request.userActivityStreams = activityStreams;
          next();
        } else {
          const bytes = await promisifiedRandomBytes(64);

          request.nonce = Challenge.getToken(bytes);
          request.user = null;
          request.userActivityStreams = null;

          await Challenge.create(repository, bytes);
          next();
        }
      }).catch(next);
    },
    Arena({
      queues: [
        {
          hostId: repository.host,
          name: 'HTTP',
          prefix: repository.redis.prefix + 'bull',
          url: repository.redis.url
        }
      ]
    }, { basePath: '/bull', disableListen: true }),
    sapper({
      App,
      routes,
      store({ nonce, userActivityStreams }) {
        return new Store({ nonce, user: userActivityStreams, events: null });
      }
    }));

  application.listen(port).on('error', repository.console.error);

  return application;
};
