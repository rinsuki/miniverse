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

import Challenge from './challenge';
import repository from './test_repository';

const secret = Buffer.from('secret');
const digest = Buffer.from([
  229, 233, 250, 27, 163, 30, 205, 26, 232, 79, 117, 202, 170, 71, 79, 58,
  102, 63, 5, 244
]);
const token = 'c2VjcmV0';

describe('create', () => test('creates challenge', async () => {
  const challenge = await Challenge.create(repository, secret);

  expect(digest.equals(challenge.digest)).toBe(true);

  expect(repository.selectChallengeByDigest(digest))
    .resolves
    .toBeInstanceOf(Challenge);
}));

describe('digest', () => test('digests secret', () =>
  expect(digest.equals(Challenge.digest(secret))).toBe(true)));

describe('getToken', () => test('gets token from secret', () =>
  expect(Challenge.getToken(secret)).toBe(token)));
