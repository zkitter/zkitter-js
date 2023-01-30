import winston from 'winston';
import chalk from "chalk";

const format = winston.format;
const { combine, timestamp } = format;

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp(), format.colorize(), format.json()),
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
      level: 'error',
      format: winston.format.simple(),
    })
  );
}

export default logger;

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
