/**
 * Installer Diagnostics for BookIt
 * Logs Squirrel/Windows installer events
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class InstallerDiagnostics {
  constructor() {
    this.logsDir = this.getInstallerLogsDirectory();
    this.ensureDirectory(this.logsDir);
    this.logFile = path.join(this.logsDir, `installer-${Date.now()}.log`);
  }

  getInstallerLogsDirectory() {
    return path.join(os.homedir(), 'AppData', 'Local', 'bookit', 'installer-logs');
  }

  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? ` | ${JSON.stringify(data)}` : ''}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (err) {
      console.error('Failed to write installer log:', err);
    }
  }

  logSquirrelEvent(event) {
    this.log(`Squirrel Event: ${event}`);
    
    const eventHandlers = {
      'install': () => this.logInstall(),
      'updated': () => this.logUpdate(),
      'uninstall': () => this.logUninstall(),
      'obsolete': () => this.log('App is obsolete'),
    };
    
    if (eventHandlers[event]) {
      eventHandlers[event]();
    }
  }

  logInstall() {
    this.log('=== INSTALLATION ===');
    this.log(`Install Path: ${process.execPath}`);
    this.log(`User Data Path: ${path.join(os.homedir(), 'AppData', 'Local', 'bookit')}`);
    this.log('Creating shortcuts and registry entries');
    this.logSystemInfo();
  }

  logUpdate() {
    this.log('=== UPDATE ===');
    this.log(`Version: ${process.env.npm_package_version || 'unknown'}`);
    this.logSystemInfo();
  }

  logUninstall() {
    this.log('=== UNINSTALL ===');
    this.log('Application is being uninstalled');
  }

  logSystemInfo() {
    this.log(`OS: ${process.platform} ${os.release()}`);
    this.log(`Architecture: ${os.arch()}`);
    this.log(`Node Version: ${process.version}`);
    this.log(`Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)}MB`);
  }

  logDependencyInstallCheck() {
    this.log('Checking dependency installation...');
    
    const requiredModules = [
      'electron',
      'react',
      'react-dom',
      'sqlite3'
    ];
    
    let missingCount = 0;
    requiredModules.forEach(mod => {
      try {
        require.resolve(mod);
        this.log(`✓ Found: ${mod}`);
      } catch (e) {
        this.log(`✗ MISSING: ${mod}`);
        missingCount++;
      }
    });
    
    if (missingCount > 0) {
      this.log(`⚠ CRITICAL: ${missingCount} dependencies are missing. Attempting to install...`);
      return false;
    } else {
      this.log('✓ All dependencies installed');
      return true;
    }
  }

  logErrorEvent(error, context = 'installation') {
    this.log(`ERROR during ${context}: ${error.message}`, {
      stack: error.stack,
      code: error.code,
    });
  }

  getLogPath() {
    return this.logFile;
  }

  getLogContent() {
    try {
      return fs.readFileSync(this.logFile, 'utf-8');
    } catch (err) {
      return `Unable to read log: ${err.message}`;
    }
  }
}

module.exports = InstallerDiagnostics;
