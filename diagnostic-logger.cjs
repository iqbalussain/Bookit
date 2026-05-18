/**
 * Diagnostic Logger for BookIt
 * 
 * Logs startup issues, dependency problems, and system configuration
 * Stores logs in %APPDATA%\bookit\logs for troubleshooting
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class DiagnosticLogger {
  constructor() {
    this.logsDir = this.getLogsDirectory();
    this.ensureLogsDirectory();
    this.sessionLogFile = this.createSessionLogFile();
    this.startTime = new Date();
    this.logs = [];
    
    this.log('debug', '='.repeat(80));
    this.log('info', `BookIt Diagnostic Session Started - ${new Date().toISOString()}`);
    this.log('debug', '='.repeat(80));
    this.logSystemInfo();
  }

  getLogsDirectory() {
    if (typeof window !== 'undefined' && window.electron) {
      // Running in Electron
      const app = require('electron').app;
      return path.join(app.getPath('userData'), 'logs');
    }
    // Fallback for CLI
    return path.join(os.homedir(), 'AppData', 'Local', 'bookit', 'logs');
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  createSessionLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.logsDir, `bookit-${timestamp}.log`);
  }

  logSystemInfo() {
    this.log('info', `OS Platform: ${process.platform} ${os.release()}`);
    this.log('info', `Node Version: ${process.version}`);
    this.log('info', `App Version: ${process.env.BOOKIT_VERSION || 'unknown'}`);
    this.log('info', `User: ${os.userInfo().username}`);
    this.log('info', `Logs Directory: ${this.logsDir}`);
    this.log('info', `Working Directory: ${process.cwd()}`);
    this.log('info', `Environment: ${process.env.NODE_ENV || 'production'}`);
    
    // System memory and storage
    const totalMem = Math.round(os.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    this.log('info', `System Memory: ${freeMem}MB free / ${totalMem}MB total`);
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const logEntry = `${prefix} ${message}${data ? ` | ${JSON.stringify(data)}` : ''}`;
    
    this.logs.push(logEntry);
    
    // Write to file immediately
    try {
      fs.appendFileSync(this.sessionLogFile, logEntry + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
    
    // Also output to console
    if (level === 'error') {
      console.error(logEntry, data || '');
    } else if (level === 'warn') {
      console.warn(logEntry, data || '');
    } else {
      console.log(logEntry, data || '');
    }
  }

  logDependencyCheck(deps) {
    this.log('info', 'Checking dependencies...');
    let allGood = true;
    
    for (const [name, version] of Object.entries(deps)) {
      try {
        require.resolve(name);
        this.log('info', `✓ Dependency found: ${name}@${version}`);
      } catch (err) {
        this.log('error', `✗ Missing dependency: ${name}@${version}`);
        allGood = false;
      }
    }
    
    if (allGood) {
      this.log('info', 'All dependencies satisfied');
    } else {
      this.log('error', 'Some dependencies are missing - app may fail to start');
    }
    
    return allGood;
  }

  logDatabaseCheck(dbPath) {
    this.log('info', `Checking database at: ${dbPath}`);
    
    try {
      const stats = fs.statSync(dbPath);
      const sizeKB = Math.round(stats.size / 1024);
      this.log('info', `✓ Database file exists (${sizeKB}KB)`);
      
      // Check if writable
      try {
        fs.accessSync(dbPath, fs.constants.W_OK);
        this.log('info', '✓ Database is writable');
        return true;
      } catch (err) {
        this.log('error', `✗ Database is not writable: ${err.message}`);
        return false;
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.log('warn', 'Database file not found - will be created on first run');
        return true;
      } else {
        this.log('error', `✗ Database check failed: ${err.message}`);
        return false;
      }
    }
  }

  logDirectoryCheck(dirPath, dirName) {
    this.log('info', `Checking ${dirName} directory: ${dirPath}`);
    
    try {
      if (!fs.existsSync(dirPath)) {
        this.log('warn', `Directory does not exist, will be created: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
        this.log('info', `✓ Directory created successfully`);
        return true;
      } else {
        const files = fs.readdirSync(dirPath);
        this.log('info', `✓ Directory exists with ${files.length} items`);
        
        // Check if writable
        try {
          const testFile = path.join(dirPath, `.bookit-write-test-${Date.now()}`);
          fs.writeFileSync(testFile, 'test', { flag: 'w' });
          fs.unlinkSync(testFile);
          this.log('info', '✓ Directory is writable');
          return true;
        } catch (err) {
          this.log('error', `✗ Directory is not writable: ${err.message}`);
          return false;
        }
      }
    } catch (err) {
      this.log('error', `✗ Directory check failed: ${err.message}`);
      return false;
    }
  }

  logAppStart() {
    this.log('info', '--- Application Starting ---');
  }

  logAppInitialization(success, message = '') {
    if (success) {
      this.log('info', `✓ Application initialized successfully${message ? ': ' + message : ''}`);
    } else {
      this.log('error', `✗ Application initialization failed${message ? ': ' + message : ''}`);
    }
  }

  logError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    };
    
    this.log('error', `Uncaught error${context ? ` in ${context}` : ''}: ${error.message}`, errorInfo);
  }

  logWindowCreation(success, message = '') {
    if (success) {
      this.log('info', `✓ Application window created${message ? ': ' + message : ''}`);
    } else {
      this.log('error', `✗ Failed to create window: ${message}`);
    }
  }

  logDatabaseOperation(operation, success, details = '') {
    const status = success ? '✓' : '✗';
    this.log(success ? 'info' : 'error', `${status} Database ${operation}${details ? ': ' + details : ''}`);
  }

  logPreloadSuccess() {
    this.log('info', '✓ Preload script loaded successfully');
  }

  logRendererReady() {
    this.log('info', '✓ Renderer process ready');
  }

  getSummary() {
    const uptime = Math.round((new Date() - this.startTime) / 1000);
    const warnings = this.logs.filter(l => l.includes('WARN')).length;
    const errors = this.logs.filter(l => l.includes('ERROR')).length;
    
    return {
      sessionFile: this.sessionLogFile,
      uptime: `${uptime}s`,
      totalLogs: this.logs.length,
      errors,
      warnings,
      url: `file://${this.sessionLogFile}` // For showing in UI
    };
  }

  logSessionEnd() {
    const summary = this.getSummary();
    this.log('info', '-'.repeat(80));
    this.log('info', `Session Summary - Uptime: ${summary.uptime}, Errors: ${summary.errors}, Warnings: ${summary.warnings}`);
    this.log('info', `Log file: ${summary.sessionFile}`);
    this.log('info', '='.repeat(80));
  }

  // Offline launch verification
  logOfflineCheck(dbPath) {
    this.log('info', '--- Offline Launch Check ---');
    const checks = {
      database: this.logDatabaseCheck(dbPath),
      userData: this.logDirectoryCheck(path.dirname(dbPath), 'userData'),
    };
    
    const allPass = Object.values(checks).every(v => v);
    this.logAppInitialization(allPass, 'All offline checks passed');
    return allPass;
  }

  // Export logs for debugging
  exportLogs(exportPath) {
    try {
      fs.copyFileSync(this.sessionLogFile, exportPath);
      this.log('info', `✓ Logs exported to: ${exportPath}`);
      return exportPath;
    } catch (err) {
      this.log('error', `Failed to export logs: ${err.message}`);
      return null;
    }
  }
}

module.exports = DiagnosticLogger;
