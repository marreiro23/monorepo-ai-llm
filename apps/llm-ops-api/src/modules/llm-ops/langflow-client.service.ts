import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LangflowProbeResult = {
  enabled: boolean;
  reachable: boolean;
  version: string | null;
  ragFlowId: string | null;
  error: string | null;
};

export type LangflowRunResult = LangflowProbeResult & {
  attempted: boolean;
  outputText: string | null;
};

@Injectable()
export class LangflowClientService {
  private readonly logger = new Logger(LangflowClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async probe(): Promise<LangflowProbeResult> {
    const enabled =
      this.configService.get<string>('LANGFLOW_ENABLED') === 'true';
    const url = this.configService.get<string>('LANGFLOW_URL')?.trim() ?? null;
    const ragFlowId =
      this.configService.get<string>('LANGFLOW_RAG_FLOW_ID')?.trim() || null;

    if (!enabled || !url) {
      return {
        enabled,
        reachable: false,
        version: null,
        ragFlowId,
        error: enabled ? 'LANGFLOW_URL is not configured' : null,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/api/v1/version`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          enabled,
          reachable: false,
          version: null,
          ragFlowId,
          error: `Langflow version probe returned HTTP ${response.status}`,
        };
      }

      const body = (await response.json()) as { version?: unknown };
      const version = typeof body.version === 'string' ? body.version : null;

      return {
        enabled,
        reachable: true,
        version,
        ragFlowId,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Langflow probe error';
      this.logger.warn(`Langflow probe failed: ${message}`);

      return {
        enabled,
        reachable: false,
        version: null,
        ragFlowId,
        error: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async runRagFlow(
    inputValue: string,
    sessionId: string,
    context: string[],
  ): Promise<LangflowRunResult> {
    const enabled =
      this.configService.get<string>('LANGFLOW_ENABLED') === 'true';
    const url = this.configService.get<string>('LANGFLOW_URL')?.trim() ?? null;
    const ragFlowId =
      this.configService.get<string>('LANGFLOW_RAG_FLOW_ID')?.trim() || null;

    if (!enabled || !url || !ragFlowId) {
      return {
        enabled,
        reachable: false,
        version: null,
        ragFlowId,
        attempted: false,
        outputText: null,
        error:
          enabled && url
            ? 'LANGFLOW_RAG_FLOW_ID is not configured'
            : enabled
              ? 'LANGFLOW_URL is not configured'
              : null,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.readTimeoutMs());

    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'Content-Type': 'application/json',
      };
      const apiKey = this.configService.get<string>('LANGFLOW_API_KEY')?.trim();
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(
        `${url.replace(/\/$/, '')}/api/v1/run/${encodeURIComponent(ragFlowId)}?stream=false`,
        {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            input_value: this.buildRagInput(inputValue, context),
            input_type: 'chat',
            output_type: 'chat',
            session_id: sessionId,
          }),
        },
      );

      const body = await this.readJsonOrText(response);
      if (!response.ok) {
        return {
          enabled,
          reachable: false,
          version: null,
          ragFlowId,
          attempted: true,
          outputText: null,
          error: `Langflow RAG run returned HTTP ${response.status}: ${this.summarizeBody(body)}`,
        };
      }

      return {
        enabled,
        reachable: true,
        version: null,
        ragFlowId,
        attempted: true,
        outputText: this.extractOutputText(body),
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Langflow RAG run error';
      this.logger.warn(`Langflow RAG run failed: ${message}`);

      return {
        enabled,
        reachable: false,
        version: null,
        ragFlowId,
        attempted: true,
        outputText: null,
        error: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildRagInput(inputValue: string, context: string[]): string {
    if (context.length === 0) {
      return inputValue;
    }

    return [
      inputValue,
      '',
      'Contexto RAG recuperado da base Astra:',
      ...context.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n');
  }

  private readTimeoutMs(): number {
    const configured = Number(
      this.configService.get<string>('LANGFLOW_RUN_TIMEOUT_MS') ?? 15000,
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 15000;
  }

  private async readJsonOrText(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private extractOutputText(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const root = payload as Record<string, unknown>;
    const directText =
      this.readStringPath(root, ['message']) ??
      this.readStringPath(root, ['text']);
    if (directText) {
      return directText;
    }

    const outputs = Array.isArray(root.outputs) ? root.outputs : [];
    for (const output of outputs) {
      const outputText = this.extractOutputTextFromOutput(output);
      if (outputText) {
        return outputText;
      }
    }

    return null;
  }

  private extractOutputTextFromOutput(output: unknown): string | null {
    if (!output || typeof output !== 'object') {
      return null;
    }

    const item = output as Record<string, unknown>;
    const candidates = [
      this.readStringPath(item, ['results', 'message', 'text']),
      this.readStringPath(item, ['results', 'text']),
      this.readStringPath(item, ['message', 'text']),
      this.readStringPath(item, ['text']),
    ];
    const direct = candidates.find((candidate) => candidate !== null);
    if (direct) {
      return direct;
    }

    const nestedOutputs = Array.isArray(item.outputs) ? item.outputs : [];
    for (const nestedOutput of nestedOutputs) {
      const nestedText = this.extractOutputTextFromOutput(nestedOutput);
      if (nestedText) {
        return nestedText;
      }
    }

    return null;
  }

  private readStringPath(
    payload: Record<string, unknown>,
    path: string[],
  ): string | null {
    let current: unknown = payload;
    for (const segment of path) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' && current.trim()
      ? current.trim()
      : null;
  }

  private summarizeBody(payload: unknown): string {
    if (typeof payload === 'string') {
      return payload.slice(0, 240);
    }

    if (!payload) {
      return 'empty response body';
    }

    return JSON.stringify(payload).slice(0, 240);
  }
}
