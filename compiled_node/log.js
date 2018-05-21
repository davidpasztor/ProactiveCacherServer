"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston = require("winston");
const logger = winston.createLogger({
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    level: "debug",
    transports: [
        new winston.transports.File({ filename: 'server_error.log', level: 'error' }),
        new winston.transports.File({ filename: 'server_all.log' })
    ],
});
exports.logger = logger;
if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
//# sourceMappingURL=log.js.map