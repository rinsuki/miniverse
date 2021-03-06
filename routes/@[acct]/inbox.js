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

import { text } from 'body-parser';
import { parseRequest } from 'http-signature';
import { HttpSignatureError } from 'http-signature/lib/utils';
import OrderedCollectionPage from '../../lib/ordered_collection_page';

const middleware = text({
  type: ['application/activity+json', 'application/ld+json']
});

export function get(request, response, next) {
  const { params, repository, user } = request;

  if (!user) {
    response.sendStatus(401);
    return;
  }

  response.setHeader('Content-Type', 'text/event-stream');

  Promise.all([
    user.selectPerson(),
    repository.selectRecentNotesFromInbox(user)
  ]).then(async ([person, notes]) => {
    if (!person || person.username != params.acct) {
      response.sendStatus(401);
      return;
    }

    const firstPage = new OrderedCollectionPage({
      orderedItems: notes.reverse()
    });

    const resolved = await firstPage.toActivityStreams();
    const subscribedChannel = repository.getInboxChannel(user);

    function listen(publishedChannel, message) {
      return response.write(`data:{"@context":"https://www.w3.org/ns/activitystreams","type":"OrderedCollectionPage","orderedItems":[${message}]}\n\n`);
    }

    resolved['@context'] = 'https://www.w3.org/ns/activitystreams';
    response.write(`data:${JSON.stringify(resolved)}\n\n`);

    await repository.subscribe(subscribedChannel, listen);
    const heartbeat = setInterval(() => response.write(':\n'), 16384);

    request.on('close', () => {
      clearInterval(heartbeat);
      repository.unsubscribe(subscribedChannel, listen);
    });
  }, next);
}

/*
  ActivityPub
  5.2 Inbox
  https://www.w3.org/TR/activitypub/#inbox
  > The inboxes of actors on federated servers accepts HTTP POST requests, with
  > behaviour described in Delivery.
*/
export function post(request, response, next) {
  let signature;

  request.headers.authorization = 'Signature ' + request.headers.signature;

  try {
    signature = parseRequest(request);
  } catch (error) {
    if (error instanceof HttpSignatureError) {
      response.sendStatus(401);
      return;
    }

    throw error;
  }

  middleware(request, response,
    () => request.repository
                 .queue
                 .add({ type: 'processInbox', signature, body: request.body })
                 .then(() => response.sendStatus(202), next));
}
