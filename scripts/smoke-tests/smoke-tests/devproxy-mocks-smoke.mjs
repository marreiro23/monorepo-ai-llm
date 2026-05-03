import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadMock } from '../mocks/devproxy-mock-utils.mjs';

const domains = ['graph', 'sharepoint'];
const expected = {
  graph: [
    'get-sites-list-200.json',
    'get-sites-service-unavailable-503.json',
    'get-sites-list-500.json',
    'get-sites-timeout-504.json',
    'get-users-list-200.json',
    'get-groups-list-200.json',
    'get-drives-root-permissions-429.json'
  ],
  sharepoint: [
    'get-drive-items-200.json',
    'get-drive-items-service-unavailable-503.json',
    'get-drive-items-500.json',
    'get-drive-items-timeout-504.json',
    'get-list-items-200.json',
    'get-library-not-found-404.json'
  ]
};

for (const domain of domains) {
  const dir = resolve(process.cwd(), '.devproxy', 'mocks', domain);
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));

  for (const required of expected[domain]) {
    assert.ok(files.includes(required), `${domain}: mock obrigatorio ausente -> ${required}`);
  }

  for (const file of files) {
    if (file === '.gitkeep') continue;
    const mock = loadMock(domain, file);

    assert.ok(mock.statusCode >= 200 && mock.statusCode <= 599, `${domain}/${file}: status invalido`);

    if (mock.statusCode === 429) {
      assert.ok(mock.headers['retry-after'], `${domain}/${file}: retry-after obrigatorio para 429`);
    }

    if (mock.statusCode === 404) {
      assert.ok(mock.body?.error?.code, `${domain}/${file}: 404 deve expor codigo de erro`);
    }

    if (mock.statusCode >= 500) {
      assert.ok(mock.body?.error?.code, `${domain}/${file}: 5xx deve expor error.code`);
      assert.ok(mock.body?.error?.message, `${domain}/${file}: 5xx deve expor error.message`);
    }

    if (mock.statusCode === 503) {
      assert.ok(mock.headers['retry-after'], `${domain}/${file}: 503 deve expor retry-after`);
      assert.ok(/unavailable/i.test(mock.body?.error?.message || ''), `${domain}/${file}: 503 deve indicar indisponibilidade`);
    }

    if (mock.statusCode === 504) {
      assert.ok(mock.headers['retry-after'], `${domain}/${file}: 504 deve expor retry-after`);
      assert.ok(/timeout/i.test(mock.body?.error?.message || ''), `${domain}/${file}: 504 deve indicar timeout`);
    }
  }
}

console.log('✅ devproxy-mocks-smoke: mocks essenciais validados e prontos para pipeline.');
