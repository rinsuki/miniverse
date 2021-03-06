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

import { postOutbox } from './fetch';

export default {
  async fetchOutbox(fetch, person) {
    const fetched = await fetch(person.outbox.id || person.outbox, {
      headers: { Accept: 'application/activity+json;q=0.9,application/ld+json;q=0.8' }
    });

    const outbox = await fetched.json();

    outbox.id = person.outbox.id;
    person.outbox = outbox;

    return fetched;
  },

  async fetchPerson(fetch, acct) {
    return fetch('/@' + acct, {
      headers: { Accept: 'application/activity+json;q=0.9,application/ld+json;q=0.8' }
    });
  },

  follow(fetch, { id }) {
    return postOutbox.call(this, fetch, {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      object: id,
    });
  }
}
