const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

class Logger {
  constructor(verbose = false, config = {}) {
    this.verbose = verbose;
    this.config = {
      level: verbose ? 'debug' : 'info',
      file: './logs/diagnostic.log',
      console: true,
      ...config
    };
    
    this.logger = this.createLogger();
  }

  createLogger() {
    const transports = [];

    // Console transport
    if (this.config.console) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let log = `${timestamp} ${level}: ${message}`;
            if (Object.keys(meta).length > 0) {
              log += ` ${JSON.stringify(meta)}`;
            }
            return log;
          })
        )
      }));
    }

    // File transport
    if (this.config.file) {
      // Ensure log directory exists
      const logDir = path.dirname(this.config.file);
      fs.ensureDirSync(logDir);

      transports.push(new winston.transports.File({
        filename: this.config.file,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      }));
    }

    return winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false
    });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, error = null) {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: error.message,
        stack: error.stack
      });
    } else if (typeof error === 'object') {
      this.logger.error(message, error);
    } else {
      this.logger.error(message, { error });
    }
  }

  setLevel(level) {
    this.logger.level = level;
  }
}

module.exports = Logger;
