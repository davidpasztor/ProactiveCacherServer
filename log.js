const winston = require('winston');

const logger = winston.createLogger({
	level: 'debug', // Levels: error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 
  	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json()
	),
  	transports: [
    	new winston.transports.File({ filename: 'server_error.log', level: 'error'}),
    	new winston.transports.File({ filename: 'server_all.log'})
  	]
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

exports.logger = logger;
