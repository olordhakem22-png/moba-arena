"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
function errorHandler(err, _req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';
    logger_1.logger.error(`${status} ${message}`, {
        stack: err.stack,
        path: _req.path,
        method: _req.method,
    });
    // Don't leak stack traces in production
    const response = { error: message };
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }
    res.status(status).json(response);
}
//# sourceMappingURL=errorHandler.js.map