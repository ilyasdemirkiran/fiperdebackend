import { isProduction } from "@/config/env";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogData {
    level: LogLevel;
    message: string;
    timestamp: string;
    [key: string]: any;
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, any>): LogData {
    return {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
    };
}

export const logger = {
    info: (message: string, meta?: Record<string, any>) => {
        const log = formatLog("info", message, meta);
        console.log(isProduction ? JSON.stringify(log) : `ℹ️  ${message}`, meta || "");
    },

    warn: (message: string, meta?: Record<string, any>) => {
        const log = formatLog("warn", message, meta);
        console.warn(isProduction ? JSON.stringify(log) : `⚠️  ${message}`, meta || "");
    },

    error: (message: string, error?: Error | any, meta?: Record<string, any>) => {
        const log = formatLog("error", message, {
            ...meta,
            error: error?.message || error,
            stack: error?.stack,
        });
        console.error(isProduction ? JSON.stringify(log) : `❌ ${message}`, error);
    },

    debug: (message: string, meta?: Record<string, any>) => {
        if (!isProduction) {
            const log = formatLog("debug", message, meta);
            console.debug(`🐛 ${message}`, meta || "");
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
