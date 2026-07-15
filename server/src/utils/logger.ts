const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

const currentLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function log(level: keyof typeof LOG_LEVELS, message: string, ...args: any[]) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel as keyof typeof LOG_LEVELS]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const formatted = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;

  switch (level) {
    case 'error': console.error(prefix, formatted); break;
    case 'warn': console.warn(prefix, formatted); break;
    case 'debug': console.debug(prefix, formatted); break;
    default: console.log(prefix, formatted);
  }
}

export const logger = {
  error: (msg: string, ...args: any[]) => log('error', msg, ...args),
  warn: (msg: string, ...args: any[]) => log('warn', msg, ...args),
  info: (msg: string, ...args: any[]) => log('info', msg, ...args),
  debug: (msg: string, ...args: any[]) => log('debug', msg, ...args),
};
