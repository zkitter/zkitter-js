import chalk from 'chalk';
import winston from 'winston';

const format = winston.format;
const { combine, timestamp } = format;

const logger = winston.createLogger({
  format: combine(timestamp(), format.colorize(), format.json()),
  level: 'info',
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'combined.log',
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
      level: 'error',
    })
  );
}

export function error(msg: string) {
  console.log(chalk.red(msg));
}

export function warning(msg: string) {
  console.log(chalk.yellowBright(msg));
}

export function success(msg: string) {
  console.log(chalk.green(msg));
}

export function debug(msg: string) {
  console.log(chalk.gray(msg));
}

export default logger;
