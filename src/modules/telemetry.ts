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

export interface ModuleHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  lastHeartbeat: string | null;
  lastError: string | null;
}

export interface HealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptimeSeconds: number;
  startTime: string;
  modules: Record<string, ModuleHealth>;
  errorMetrics: ErrorMetric[];
}

class TelemetryTracker {
  private metrics = new Map<ErrorCode, ErrorMetric>();
  private startTime = new Date();
  
  // Track health statuses of individual system components
  private moduleHealths = new Map<string, {
    status: 'UP' | 'DOWN' | 'DEGRADED';
    lastHeartbeat: Date | null;
    lastError: string | null;
  }>();

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

    // Initialize default modules
    const modules = ['episode-poller', 'boost-poller', 'podping-consumer', 'dashboard-server'];
    modules.forEach(mod => {
      this.moduleHealths.set(mod, {
        status: 'UP',
        lastHeartbeat: new Date(),
        lastError: null,
      });
    });
  }

  /** Record poller/module heartbeat activity */
  public recordHeartbeat(moduleName: string): void {
    const health = this.moduleHealths.get(moduleName) || {
      status: 'UP',
      lastHeartbeat: null,
      lastError: null
    };
    health.status = 'UP';
    health.lastHeartbeat = new Date();
    this.moduleHealths.set(moduleName, health);
  }

  /** Record module-specific operational failures */
  public recordModuleFailure(moduleName: string, error: unknown, setStatus: 'DEGRADED' | 'DOWN' = 'DEGRADED'): void {
    const health = this.moduleHealths.get(moduleName) || {
      status: 'UP',
      lastHeartbeat: null,
      lastError: null
    };
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    health.status = setStatus;
    health.lastError = errorMsg;
    this.moduleHealths.set(moduleName, health);

    console.error(`[Telemetry] [Health Alert] Module "${moduleName}" failed: ${errorMsg}`);
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

  /** Generate the overall system health report */
  public getHealthReport(): HealthReport {
    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';
    const modules: Record<string, ModuleHealth> = {};

    let downCount = 0;
    let degradedCount = 0;

    this.moduleHealths.forEach((val, key) => {
      modules[key] = {
        status: val.status,
        lastHeartbeat: val.lastHeartbeat ? val.lastHeartbeat.toISOString() : null,
        lastError: val.lastError,
      };

      if (val.status === 'DOWN') downCount++;
      if (val.status === 'DEGRADED') degradedCount++;
    });

    if (downCount > 0) {
      overallStatus = 'DOWN';
    } else if (degradedCount > 0) {
      overallStatus = 'DEGRADED';
    }

    return {
      status: overallStatus,
      uptimeSeconds: this.getUptimeSeconds(),
      startTime: this.startTime.toISOString(),
      modules,
      errorMetrics: this.getMetrics(),
    };
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
export type { TelemetryTracker as TelemetryTrackerClass };
