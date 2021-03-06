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

import { domainToASCII } from 'url';
import Accept from './accept';
import RemoteAccount from './remote_account';

export class RemoteObjectError extends Error { }

export default class {
  constructor(properties) {
    Object.assign(this, properties);
  }

  async selectPersonByActor() {
    await this.repository.loadPerson(this.actor);
    return this.actor;
  }

  async selectPersonByObject() {
    await this.repository.loadPerson(this.object);
    return this.object;
  }

  async selectRemoteAccountByActor() {
    if (this.actor && this.actor.account) {
      return this.actor.account instanceof RemoteAccount ?
        this.actor.account : null;
    }

    return this.repository.selectRemoteAccountByPerson(this.actor);
  }

  async toActivityStreams() {
    const [actor, object] = await Promise.all([
      this.selectPersonByActor().then(person => person.getUri()),
      this.selectPersonByObject().then(person => person.getUri())
    ]);

    return { type: 'Follow', actor, object };
  }

  static async create(repository, actor, object) {
    const follow = new this({ actor, object, repository });

    await repository.insertFollow(follow);
    await Accept.create(repository, follow);

    return follow;
  }

  static async fromParsedActivityStreams(repository, actor, activity) {
    const localUserPrefix = `https://${domainToASCII(repository.host)}/@`;
    const object = await activity.getObject();
    const objectId = await object.getId();

    if (!objectId.startsWith(localUserPrefix)) {
      throw new RemoteObjectError;
    }

    const account = await repository.selectLocalAccountByUsername(
      decodeURIComponent(objectId.slice(localUserPrefix.length)));

    const person = await account.selectPerson();

    return this.create(repository, actor, person);
  }
}
