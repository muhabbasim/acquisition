import  winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // can be warn, info, debug, error
  format: winston.format.combine((
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )),
  defaultMeta: { service: 'acquisitions-api' }, // server name
  transports: [
    // where logs are saved
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// if its not production then console.log the errors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }));
}

export default logger