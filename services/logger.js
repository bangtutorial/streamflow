const fs = require('fs');
const path = require('path');
const util = require('util');
const logDir = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDir, 'app.log');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
function writeToLogFile(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'string' ? arg : util.inspect(arg, { depth: null, colors: false })).join(' ');
  const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    originalConsoleError('Failed to write to log file:', err);
  }
}
console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  writeToLogFile('log', ...args);
};
console.error = (...args) => {
  originalConsoleError.apply(console, args);
  writeToLogFile('error', ...args);
};
console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
  writeToLogFile('warn', ...args);
};
console.info = (...args) => {
  originalConsoleInfo.apply(console, args);
  writeToLogFile('info', ...args);
};
console.debug = (...args) => {
  originalConsoleDebug.apply(console, args);
  writeToLogFile('debug', ...args);
};

console.streamStart = (message, data = {}) => {
  const logMessage = `[STREAM START] ${message}`;
  console.log(logMessage);
  if (Object.keys(data).length > 0) {
    console.log(`Stream data: ${JSON.stringify(data)}`);
  }
};

console.streamStop = (message, data = {}) => {
  const logMessage = `[STREAM STOP] ${message}`;
  console.log(logMessage);
  if (Object.keys(data).length > 0) {
    console.log(`Stream data: ${JSON.stringify(data)}`);
  }
};

console.streamError = (message, error = null) => {
  const logMessage = `[STREAM ERROR] ${message}`;
  console.error(logMessage);
  if (error) {
    console.error(`Error details: ${error.message || error}`);
  }
};

console.ffmpeg = (message) => {
  const logMessage = `[FFMPEG] ${message}`;
  console.log(logMessage);
};

console.upload = (message) => {
  const logMessage = `[UPLOAD] ${message}`;
  console.log(logMessage);
};

console.download = (message) => {
  const logMessage = `[DOWNLOAD] ${message}`;
  console.log(logMessage);
};

console.analytics = (message) => {
  const logMessage = `[ANALYTICS] ${message}`;
  console.log(logMessage);
};

console.auth = (message) => {
  const logMessage = `[AUTH] ${message}`;
  console.log(logMessage);
};

console.api = (message) => {
  const logMessage = `[API] ${message}`;
  console.log(logMessage);
};
console.log('Logger initialized. Output will be written to console and logs/app.log');