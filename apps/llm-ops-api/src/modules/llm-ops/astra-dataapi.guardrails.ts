export const ASTRA_DATA_API_LIMITS = {
  maxIndexedStringBytes: 8_000,
  maxPathLength: 1_000,
  maxArrayElements: 1_000,
  maxObjectProperties: 1_000,
  maxDocumentProperties: 5_000,
  maxObjectDepth: 16,
  maxInsertionsPerTransaction: 100,
  maxInsertBatchCharacters: 20_000_000,
} as const;

type JsonInspection = {
  maxArrayLength: number;
  maxDepth: number;
  maxObjectProperties: number;
  maxPathLength: number;
  totalProperties: number;
};

export function getUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0 || getUtf8ByteLength(value) <= maxBytes) {
    return value;
  }

  let low = 0;
  let high = value.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = value.slice(0, mid);

    if (getUtf8ByteLength(candidate) <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return value.slice(0, low).trimEnd();
}

export function normalizeIndexedString(
  value: string,
  maxBytes = ASTRA_DATA_API_LIMITS.maxIndexedStringBytes,
): string {
  return truncateUtf8(value.replace(/\s+/g, ' ').trim(), maxBytes);
}

export function buildLexicalField(
  ...parts: Array<string | null | undefined>
): string {
  return normalizeIndexedString(
    parts.filter((item): item is string => Boolean(item)).join(' '),
  );
}

export function buildLexicalQuery(message: string): string {
  return buildLexicalCandidates(message)[0] ?? '';
}

export function buildLexicalCandidates(message: string): string[] {
  const stopwords = new Set([
    'a',
    'o',
    'os',
    'as',
    'de',
    'da',
    'do',
    'das',
    'dos',
    'e',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'um',
    'uma',
    'que',
    'qual',
    'quais',
    'para',
    'com',
    'por',
    'pela',
    'pelo',
    'isso',
    'esta',
    'está',
    'sendo',
    'the',
    'and',
    'for',
    'with',
    'what',
    'which',
    'where',
    'when',
  ]);

  const tokens = Array.from(
    new Set(
      message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/i)
        .map((item) => item.trim())
        .filter((item) => item.length >= 4 && !stopwords.has(item)),
    ),
  ).slice(0, 8);

  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  add(tokens.join(' '));

  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index + size <= tokens.length; index += 1) {
      add(tokens.slice(index, index + size).join(' '));
    }
  }

  for (const token of tokens) {
    add(token);
  }

  return candidates;
}

export function assertIndexedStringLimit(value: string, label: string): void {
  const bytes = getUtf8ByteLength(value);
  if (bytes > ASTRA_DATA_API_LIMITS.maxIndexedStringBytes) {
    throw new Error(
      `${label} exceeds Astra indexed string limit (${bytes} bytes > ${ASTRA_DATA_API_LIMITS.maxIndexedStringBytes})`,
    );
  }
}

export function assertAstraDocumentShape(
  document: unknown,
  label: string,
): void {
  const inspection = inspectJson(document);

  if (inspection.maxArrayLength > ASTRA_DATA_API_LIMITS.maxArrayElements) {
    throw new Error(
      `${label} exceeds Astra array element limit (${inspection.maxArrayLength} > ${ASTRA_DATA_API_LIMITS.maxArrayElements})`,
    );
  }

  if (
    inspection.maxObjectProperties > ASTRA_DATA_API_LIMITS.maxObjectProperties
  ) {
    throw new Error(
      `${label} exceeds Astra object property limit (${inspection.maxObjectProperties} > ${ASTRA_DATA_API_LIMITS.maxObjectProperties})`,
    );
  }

  if (
    inspection.totalProperties > ASTRA_DATA_API_LIMITS.maxDocumentProperties
  ) {
    throw new Error(
      `${label} exceeds Astra document property limit (${inspection.totalProperties} > ${ASTRA_DATA_API_LIMITS.maxDocumentProperties})`,
    );
  }

  if (inspection.maxDepth > ASTRA_DATA_API_LIMITS.maxObjectDepth) {
    throw new Error(
      `${label} exceeds Astra document depth limit (${inspection.maxDepth} > ${ASTRA_DATA_API_LIMITS.maxObjectDepth})`,
    );
  }

  if (inspection.maxPathLength > ASTRA_DATA_API_LIMITS.maxPathLength) {
    throw new Error(
      `${label} exceeds Astra path length limit (${inspection.maxPathLength} > ${ASTRA_DATA_API_LIMITS.maxPathLength})`,
    );
  }
}

export function summarizeAstraError(error: unknown): string {
  if (error instanceof Error) {
    const rawResponse = (
      error as Error & {
        rawResponse?: { errors?: Array<{ message?: string; title?: string }> };
      }
    ).rawResponse;
    const apiErrors = rawResponse?.errors
      ?.map((item) => item.message || item.title)
      .filter(Boolean);
    if (apiErrors && apiErrors.length > 0) {
      return apiErrors.join(' | ');
    }

    return error.message;
  }

  return String(error);
}

function inspectJson(value: unknown): JsonInspection {
  const initial: JsonInspection = {
    maxArrayLength: 0,
    maxDepth: 1,
    maxObjectProperties: 0,
    maxPathLength: 0,
    totalProperties: 0,
  };

  const visit = (current: unknown, depth: number, path: string[]): void => {
    if (Array.isArray(current)) {
      initial.maxArrayLength = Math.max(initial.maxArrayLength, current.length);
      initial.maxDepth = Math.max(initial.maxDepth, depth);

      for (const item of current) {
        visit(item, depth + 1, path);
      }
      return;
    }

    if (!current || typeof current !== 'object') {
      initial.maxDepth = Math.max(initial.maxDepth, depth);
      return;
    }

    const entries = Object.entries(current as Record<string, unknown>);
    initial.maxObjectProperties = Math.max(
      initial.maxObjectProperties,
      entries.length,
    );
    initial.maxDepth = Math.max(initial.maxDepth, depth);

    for (const [key, nestedValue] of entries) {
      const nextPath = [...path, key];
      initial.totalProperties += 1;
      initial.maxPathLength = Math.max(
        initial.maxPathLength,
        nextPath.join('.').length,
      );
      visit(nestedValue, depth + 1, nextPath);
    }
  };

  visit(value, 1, []);
  return initial;
}
