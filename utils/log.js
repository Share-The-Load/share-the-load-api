import winston from 'winston';

const statFormat = winston.format.printf(({ level, message, label, timestamp, stack }) => {
  if(stack) {
    return `${timestamp} [${label}] ${level}: ${message}\n ${stack}`;
  } else {
    return `${timestamp} [${label}] ${level}: ${message}`;
  }
});

function createLogger(label) {
    return winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.errors({stack: true}),
                winston.format.label({label: label}),
                winston.format.timestamp(),
                winston.format.colorize(),
                statFormat
            ),
            transports: [
                new winston.transports.Console()
            ]
    });
}

export default {
    createLogger: createLogger
};
