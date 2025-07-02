const fs = require("fs");
const path = require("path");
const util = require("util");
const logDir = path.join(process.cwd(), "logs");
const logFilePath = path.join(logDir, "app.log");

// Ensure logs directory exists with better error handling
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Created logs directory at: ${logDir}`);
  }
} catch (err) {
  console.error(`Failed to create logs directory: ${err.message}`);
  // Continue execution as we might be able to use console logging even if file logging fails
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
function writeToLogFile(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args
    .map(arg =>
      typeof arg === "string"
        ? arg
        : util.inspect(arg, { depth: null, colors: false })
    )
    .join(" ");
  const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    originalConsoleError("Failed to write to log file:", err);
  }
}
console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  writeToLogFile("log", ...args);
};
console.error = (...args) => {
  originalConsoleError.apply(console, args);
  writeToLogFile("error", ...args);
};
console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
  writeToLogFile("warn", ...args);
};
console.info = (...args) => {
  originalConsoleInfo.apply(console, args);
  writeToLogFile("info", ...args);
};
console.debug = (...args) => {
  originalConsoleDebug.apply(console, args);
  writeToLogFile("debug", ...args);
};
console.log(
  "Logger initialized. Output will be written to console and logs/app.log"
);
