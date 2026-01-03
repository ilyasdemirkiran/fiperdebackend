import { isProduction } from "@/config/env";
import { AsyncLocalStorage } from "node:async_hooks";

// Context Store
export const logContext = new AsyncLocalStorage<Map<string, any>>();

export function runWithContext<T>(callback: () => T) {
    return logContext.run(new Map(), callback);
}

export function setLogContext(key: string, value: any) {
    const store = logContext.getStore();
    if (store) {
        store.set(key, value);
    }
}

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogData {
    level: LogLevel;
    message: string;
    timestamp: string;
    [key: string]: any;
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, any>): LogData {
    const store = logContext.getStore();
    let prefix = "";

    if (store) {
        const companyId = store.get("companyId");
        const userId = store.get("userId");
        if (companyId && userId) {
            prefix = `[companyId: ${companyId}, userId: ${userId}] `;
        }
    }

    return {
        level,
        message: `${prefix}${message}`,
        timestamp: new Date().toISOString(),
        ...meta,
    };
}

export const logger = {
    info: (message: string, meta?: Record<string, any>) => {
        const log = formatLog("info", message, meta);
        console.log(isProduction ? JSON.stringify(log) : `ℹ️  ${log.message}`, meta || "");
    },

    warn: (message: string, meta?: Record<string, any>) => {
        const log = formatLog("warn", message, meta);
        console.warn(isProduction ? JSON.stringify(log) : `⚠️  ${log.message}`, meta || "");
    },

    error: (message: string, error?: Error | any, meta?: Record<string, any>) => {
        const log = formatLog("error", message, {
            ...meta,
            error: error?.message || error,
            stack: error?.stack,
        });
        console.error(isProduction ? JSON.stringify(log) : `❌ ${log.message}`, error);
    },

    debug: (message: string, meta?: Record<string, any>) => {
        if (!isProduction) {
            const log = formatLog("debug", message, meta);
            console.debug(`🐛 ${log.message}`, meta || "");
        }
    },

    request: (method: string, path: string, meta?: Record<string, any>) => {
        logger.info(`${method} ${path}`, meta);
    },

    response: (method: string, path: string, statusCode: number, duration: number) => {
        const emoji = statusCode >= 500 ? "❌" : statusCode >= 400 ? "⚠️" : "✅";
        logger.info(`${emoji} ${method} ${path} - ${statusCode} (${duration}ms)`);
    },
};
