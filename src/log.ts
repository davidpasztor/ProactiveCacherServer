import * as winston from "winston";
import path = require('path');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  level: "debug",
  transports: [
    new winston.transports.File({ filename: path.join('..','server_error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join('..','server_all.log') })
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export { logger };
