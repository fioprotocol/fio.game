import fs from 'fs';
import path from 'path';
import config from './config';

const logDirectory = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const getTimestamp = (): string => {
    return new Date().toISOString();
};

const writeLog = (level: string, section: string, message: string) => {
    const timestamp = getTimestamp();
    const logMessage = `${timestamp} [${section}] ${level}: ${message}\n`;
    const logFilePath = path.join(logDirectory, `${section.toLowerCase()}.log`);

    if (config.LOGGING_METHOD === 'console' || config.LOGGING_METHOD === 'file') {
        if (config.LOGGING_METHOD === 'console') {
            process.stdout.write(logMessage);
        } else if (config.LOGGING_METHOD === 'file') {
            fs.appendFileSync(logFilePath, logMessage);
        }
    }
};

export const logger_info = (section: string, message: string) => {
    if (config.LOGGING_LEVEL === 'info') writeLog('INFO', section, message);
};

export const logger_error = (section: string, message: string, error: any) => {
    const errorMessage = error?.message || 'Unknown error occurred';
    writeLog('ERROR', section, `${message}: ${errorMessage}`);
};
