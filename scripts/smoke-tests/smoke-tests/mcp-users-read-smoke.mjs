#!/usr/bin/env node

const { UsersApiClient } = await import('../../apps/svcia/mcp-users/dist/users-api-client.js');

const users = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Maria Admin',
    email: 'maria.admin@example.test',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z'
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Joao Reader',
    email: 'joao.reader@example.test',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z'
  }
];

const calls = [];
const fetchMock = async (input, init = {}) => {
  calls.push({ input: String(input), method: init.method ?? 'GET' });

  if (init.method && init.method !== 'GET') {
    throw new Error(`Unexpected mutating method: ${init.method}`);
  }

  const url = String(input);
  if (url.endsWith('/users')) {
    return new Response(JSON.stringify({ success: true, data: users }), { status: 200 });
  }

  const id = url.split('/users/')[1];
  const user = users.find((item) => item.id === id);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: 'User not found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true, data: user }), { status: 200 });
};

const client = new UsersApiClient('http://users-api.test', fetchMock);

const listed = await client.listUsers();
if (listed.length !== 2) {
  throw new Error(`Expected 2 listed users, got ${listed.length}`);
}

const found = await client.getUser(users[0].id);
if (found.email !== users[0].email) {
  throw new Error('Expected users_get to return the requested user');
}

const searched = await client.searchUsers('reader');
if (searched.length !== 1 || searched[0].id !== users[1].id) {
  throw new Error('Expected users_search to filter by name/email');
}

const mutatingCall = calls.find((call) => call.method !== 'GET');
if (mutatingCall) {
  throw new Error(`Unexpected mutating call: ${JSON.stringify(mutatingCall)}`);
}

console.log(
  JSON.stringify(
    {
      success: true,
      toolsCovered: ['users_list', 'users_get', 'users_search'],
      callCount: calls.length,
      methods: [...new Set(calls.map((call) => call.method))]
    },
    null,
    2
  )
);
