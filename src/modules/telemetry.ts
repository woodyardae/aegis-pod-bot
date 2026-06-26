/**
 * Aegis Telemetry & Error Taxonomy Tracking
 * 
 * Part of Milestone B (Phase 12).
 * Tracks in-memory operational metrics and maps errors to structured taxonomy codes.
 */

export enum ErrorCode {
  ERR_XML_PARSE = 'ERR_XML_PARSE',
  ERR_API_ALBY = 'ERR_API_ALBY',
  ERR_DISCORD_API = 'ERR_DISCORD_API',
  ERR_DB_ERROR = 'ERR_DB_ERROR',
  ERR_FEED_HTTP_FAIL = 'ERR_FEED_HTTP_FAIL',
  ERR_PODCAST_INDEX = 'ERR_PODCAST_INDEX',
  ERR_PODPING_WS = 'ERR_PODPING_WS',
  ERR_UNKNOWN = 'ERR_UNKNOWN'
}

export interface ErrorMetric {
  code: ErrorCode;
  count: number;
  lastOccurrence: string | null;
  lastMessage: string | null;
}

class TelemetryTracker {
  private metrics = new Map<ErrorCode, ErrorMetric>();
  private startTime = new Date();

  constructor() {
    // Initialize all error codes
    Object.values(ErrorCode).forEach((code) => {
      this.metrics.set(code, {
        code,
        count: 0,
        lastOccurrence: null,
        lastMessage: null,
      });
    });
  }

  /** Record an occurrence of a structured error */
  public recordError(code: ErrorCode, error: unknown): void {
    const metric = this.metrics.get(code);
    if (metric) {
      metric.count += 1;
      metric.lastOccurrence = new Date().toISOString();
      metric.lastMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`[Telemetry] [${code}] recorded: ${metric.lastMessage}`);
    }
  }

  /** Categorize and record a raw error */
  public categorizeAndRecord(error: unknown, context: string): ErrorCode {
    const msg = error instanceof Error ? error.message : String(error);
    let code = ErrorCode.ERR_UNKNOWN;

    if (context.includes('alby') || msg.toLowerCase().includes('alby')) {
      code = ErrorCode.ERR_API_ALBY;
    } else if (context.includes('xml') || msg.includes('xml') || msg.includes('parser')) {
      code = ErrorCode.ERR_XML_PARSE;
    } else if (msg.includes('discord') || msg.includes('rate limit') || msg.includes('guild') || msg.includes('channel')) {
      code = ErrorCode.ERR_DISCORD_API;
    } else if (msg.includes('sql') || msg.includes('sqlite') || msg.includes('database')) {
      code = ErrorCode.ERR_DB_ERROR;
    } else if (msg.includes('status code') || msg.includes('enotfound') || msg.includes('econnrefused') || context.includes('fetch') || context.includes('scan')) {
      code = ErrorCode.ERR_FEED_HTTP_FAIL;
    } else if (context.includes('podcastindex') || msg.toLowerCase().includes('podcastindex') || msg.includes('hmac')) {
      code = ErrorCode.ERR_PODCAST_INDEX;
    } else if (context.includes('podping') || msg.toLowerCase().includes('podping') || msg.includes('ws') || msg.includes('websocket')) {
      code = ErrorCode.ERR_PODPING_WS;
    }

    this.recordError(code, error);
    return code;
  }

  /** Get all error metrics */
  public getMetrics(): ErrorMetric[] {
    return Array.from(this.metrics.values());
  }

  /** Get system uptime in seconds */
  public getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}

export const telemetry = new TelemetryTracker();
