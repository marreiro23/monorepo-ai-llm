import assert from 'node:assert/strict';

function computeRetryDelay(attempt, options = {}) {
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const jitterFactor = options.jitterFactor ?? 0.35;
  const randomFn = options.randomFn ?? Math.random;

  const exponent = Math.max(0, attempt - 1);
  const progressive = Math.min(maxDelayMs, baseDelayMs * (2 ** exponent));
  const jitterWindow = progressive * jitterFactor;
  const jitter = (randomFn() * 2 - 1) * jitterWindow;
  const delay = Math.round(progressive + jitter);

  return {
    attempt,
    progressive,
    jitter,
    delay: Math.max(baseDelayMs, Math.min(maxDelayMs, delay))
  };
}

function resolveRetryDelay(attempt, responseHeaders = {}, options = {}) {
  const retryAfterRaw = responseHeaders['retry-after'] ?? responseHeaders['Retry-After'];
  if (retryAfterRaw !== undefined && retryAfterRaw !== null && String(retryAfterRaw).trim() !== '') {
    const raw = String(retryAfterRaw).trim();
    const parsedSeconds = Number.parseFloat(raw);
    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return {
        source: 'retry-after',
        delay: Math.round(parsedSeconds * 1000)
      };
    }

    const httpDateMs = Date.parse(raw);
    if (Number.isFinite(httpDateMs)) {
      const delta = Math.max(0, httpDateMs - Date.now());
      if (delta > 0) {
        return {
          source: 'retry-after',
          delay: delta
        };
      }
    }
  }

  const local = computeRetryDelay(attempt, options);
  return {
    source: 'local-backoff',
    delay: local.delay,
    details: local
  };
}

const deterministicRandom = [0.12, 0.62, 0.21, 0.88, 0.41];
let pointer = 0;
const randomFn = () => deterministicRandom[pointer++ % deterministicRandom.length];

const attempts = [1, 2, 3, 4, 5].map((attempt) =>
  computeRetryDelay(attempt, {
    baseDelayMs: 300,
    maxDelayMs: 6000,
    jitterFactor: 0.4,
    randomFn
  })
);

for (let index = 1; index < attempts.length; index += 1) {
  assert.ok(
    attempts[index].progressive >= attempts[index - 1].progressive,
    `Delay progressivo deve crescer: tentativa ${index} -> ${index + 1}`
  );
}

for (const step of attempts) {
  const minBound = Math.round(step.progressive * (1 - 0.4));
  const maxBound = Math.round(step.progressive * (1 + 0.4));

  assert.ok(step.delay >= 300, `Delay mínimo violado na tentativa ${step.attempt}`);
  assert.ok(step.delay <= 6000, `Delay máximo violado na tentativa ${step.attempt}`);
  assert.ok(step.delay >= minBound || step.delay === 300, `Delay abaixo da janela de jitter na tentativa ${step.attempt}`);
  assert.ok(step.delay <= maxBound || step.delay === 6000, `Delay acima da janela de jitter na tentativa ${step.attempt}`);
}

const delays = attempts.map((step) => step.delay);
assert.ok(new Set(delays).size > 2, 'Jitter deve produzir delays variados entre tentativas.');

const retryAfterPreferred = resolveRetryDelay(
  3,
  { 'retry-after': '7' },
  {
    baseDelayMs: 300,
    maxDelayMs: 6000,
    jitterFactor: 0.4,
    randomFn: () => 0.5
  }
);

assert.equal(retryAfterPreferred.source, 'retry-after', 'Retry-After deve ter prioridade sobre backoff local.');
assert.equal(retryAfterPreferred.delay, 7000, 'Retry-After em segundos deve ser convertido para ms.');

const futureDate = new Date(Date.now() + 5000).toUTCString();
const retryAfterHttpDatePreferred = resolveRetryDelay(
  3,
  { 'Retry-After': futureDate },
  {
    baseDelayMs: 300,
    maxDelayMs: 6000,
    jitterFactor: 0.4,
    randomFn: () => 0.5
  }
);

assert.equal(retryAfterHttpDatePreferred.source, 'retry-after', 'Retry-After HTTP-date deve ter prioridade sobre backoff local.');
assert.ok(retryAfterHttpDatePreferred.delay >= 4000, 'Retry-After HTTP-date deve gerar delay futuro aproximado.');
assert.ok(retryAfterHttpDatePreferred.delay <= 6000, 'Retry-After HTTP-date deve permanecer dentro da janela esperada no teste.');

const retryAfterInvalidFallback = resolveRetryDelay(
  3,
  { 'retry-after': 'invalid-value' },
  {
    baseDelayMs: 300,
    maxDelayMs: 6000,
    jitterFactor: 0.4,
    randomFn: () => 0.5
  }
);

assert.equal(retryAfterInvalidFallback.source, 'local-backoff', 'Retry-After inválido deve cair no backoff local.');
assert.ok(retryAfterInvalidFallback.delay >= 300, 'Fallback local deve respeitar delay mínimo.');

console.log('✅ retry-jitter-smoke: backoff progressivo com jitter validado.');
