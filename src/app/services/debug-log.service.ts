import { Injectable } from '@angular/core';
import { isDebugEnabled } from '../debug/debug-controller';
import { SearchEntity } from '../types/searchEntity.types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

@Injectable({
  providedIn: 'root',
})
export class DebugLogService {
  debug(event: string, data?: unknown) {
    this.log('debug', event, data);
  }

  info(event: string, data?: unknown) {
    this.log('info', event, data);
  }

  warn(event: string, data?: unknown) {
    this.log('warn', event, data);
  }

  error(event: string, data?: unknown) {
    this.log('error', event, data);
  }

  /**
   * Strict redaction helpers (safe-by-default).
   */
  redactUrlTokens(value: string): string {
    // Redact query tokens like access_token=... and apiKey=...
    return value
      .replace(/access_token=[^&\s]+/g, 'access_token=[REDACTED]')
      .replace(/apiKey=[^&\s]+/g, 'apiKey=[REDACTED]');
  }

  safeError(err: any): Record<string, unknown> {
    return {
      name: err?.name,
      message: typeof err?.message === 'string' ? this.redactUrlTokens(err.message) : err?.message,
      status: err?.status,
    };
  }

  safeSearchEntityMeta(entity: SearchEntity | null | undefined): Record<string, unknown> {
    const doi = entity?.pnx?.addata?.doi?.[0] ?? null;
    const issn = entity?.pnx?.addata?.issn?.[0] ?? null;
    const eissn = entity?.pnx?.addata?.eissn?.[0] ?? null;
    return {
      recordId: entity?.pnx?.control?.recordid?.[0] ?? null,
      doi,
      issn,
      eissn,
      hasDoi: !!doi,
      hasIssn: !!(issn || eissn),
    };
  }

  private log(level: LogLevel, event: string, data?: unknown) {
    if (!isDebugEnabled()) return;

    const payload =
      data === undefined
        ? undefined
        : {
            // Always wrap in an object so we can expand/collapse in console.
            data,
          };

    // NOTE: Chrome often hides console.debug unless “Verbose” is enabled.
    // Use console.info for debug-level so it shows up by default.
    // eslint-disable-next-line no-console
    const fn =
      level === 'debug'
        ? console.info.bind(console)
        : console[level]
          ? (console as any)[level].bind(console)
          : console.log.bind(console);
    fn(`[TI-NDE] ${event}`, payload);
  }
}
