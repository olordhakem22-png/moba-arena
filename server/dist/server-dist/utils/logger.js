"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
const currentLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
function log(level, message, ...args) {
    if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel])
        return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const formatted = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
    switch (level) {
        case 'error':
            console.error(prefix, formatted);
            break;
        case 'warn':
            console.warn(prefix, formatted);
            break;
        case 'debug':
            console.debug(prefix, formatted);
            break;
        default: console.log(prefix, formatted);
    }
}
exports.logger = {
    error: (msg, ...args) => log('error', msg, ...args),
    warn: (msg, ...args) => log('warn', msg, ...args),
    info: (msg, ...args) => log('info', msg, ...args),
    debug: (msg, ...args) => log('debug', msg, ...args),
};
//# sourceMappingURL=logger.js.map