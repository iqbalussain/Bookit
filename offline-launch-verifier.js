/**
 * Offline Launch Verification Module
 * 
 * Ensures BookIt can launch and function offline without missing dependencies
 * Runs before the app fully initializes
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class OfflineLaunchVerifier {
  constructor(diagnostics) {
    this.diagnostics = diagnostics;
    this.checks = [];
  }

  /**
   * Run all offline verification checks
   */
  async verify() {
    this.diagnostics.log('info', '--- Offline Launch Verification Started ---');

    const allChecks = [
      this.checkDatabase(),
      this.checkApplicationFiles(),
      this.checkDependencies(),
      this.checkDataDirectory(),
      this.checkMemory(),
    ];

    const results = await Promise.all(allChecks);
    const allPassed = results.every(r => r.success);

    if (allPassed) {
      this.diagnostics.log('info', '✓ ALL OFFLINE CHECKS PASSED - Ready to launch');
    } else {
      const failures = results
        .filter(r => !r.success)
        .map(r => r.name)
        .join(', ');
      this.diagnostics.log('error', `✗ OFFLINE CHECKS FAILED: ${failures}`);
    }

    return {
      success: allPassed,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check: Database accessibility
   */
  checkDatabase() {
    return new Promise(resolve => {
      const dbPath = path.join(app.getPath('userData'), 'invoiceflow.db');
      const name = 'Database';

      this.diagnostics.log('info', `Checking: ${name}`);

      try {
        // Check if database file exists and is readable
        if (fs.existsSync(dbPath)) {
          const stats = fs.statSync(dbPath);
          if (!fs.accessSync(dbPath, fs.constants.R_OK)) {
            // If we get here without throwing, file is readable
            const sizeKB = Math.round(stats.size / 1024);
            this.diagnostics.log('info', `✓ Database accessible (${sizeKB}KB)`);
            resolve({ name, success: true });
          }
        } else {
          // Database doesn't exist yet - will be created
          this.diagnostics.log('info', `✓ Database location writable (will be created)`);
          resolve({ name, success: true });
        }
      } catch (err) {
        this.diagnostics.log('error', `✗ Database check failed: ${err.message}`);
        resolve({
          name,
          success: false,
          error: `Database not accessible: ${err.message}`,
        });
      }
    });
  }

  /**
   * Check: Application files exist
   */
  checkApplicationFiles() {
    return new Promise(resolve => {
      const name = 'Application Files';
      this.diagnostics.log('info', `Checking: ${name}`);

      const requiredDirs = [
        { name: 'dist', optional: process.env.NODE_ENV === 'development' },
        { name: 'package.json', optional: false },
      ];

      let missing = [];

      for (const dir of requiredDirs) {
        const fullPath = path.join(__dirname, '..', dir.name);
        if (!fs.existsSync(fullPath)) {
          if (!dir.optional) {
            missing.push(dir.name);
          }
        }
      }

      if (missing.length === 0) {
        this.diagnostics.log('info', `✓ All required application files present`);
        resolve({ name, success: true });
      } else {
        this.diagnostics.log('error', `✗ Missing files: ${missing.join(', ')}`);
        resolve({
          name,
          success: false,
          error: `Missing: ${missing.join(', ')}`,
        });
      }
    });
  }

  /**
   * Check: Critical dependencies
   */
  checkDependencies() {
    return new Promise(resolve => {
      const name = 'Dependencies';
      this.diagnostics.log('info', `Checking: ${name}`);

      const critical = ['electron', 'sqlite3'];
      let missing = [];

      for (const dep of critical) {
        try {
          require.resolve(dep);
        } catch (err) {
          missing.push(dep);
        }
      }

      if (missing.length === 0) {
        this.diagnostics.log('info', `✓ All critical dependencies present`);
        resolve({ name, success: true });
      } else {
        this.diagnostics.log('error', `✗ Missing dependencies: ${missing.join(', ')}`);
        resolve({
          name,
          success: false,
          error: `Missing: ${missing.join(', ')}. Run: npm install`,
        });
      }
    });
  }

  /**
   * Check: Data directory writable
   */
  checkDataDirectory() {
    return new Promise(resolve => {
      const name = 'Data Directory';
      const dataDir = app.getPath('userData');

      this.diagnostics.log('info', `Checking: ${name} (${dataDir})`);

      try {
        // Create directory if not exists
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Test write access
        const testFile = path.join(dataDir, `.verify-${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        this.diagnostics.log('info', `✓ Data directory is writable`);
        resolve({ name, success: true });
      } catch (err) {
        this.diagnostics.log('error', `✗ Data directory not writable: ${err.message}`);
        resolve({
          name,
          success: false,
          error: `Cannot write to ${dataDir}: ${err.message}`,
        });
      }
    });
  }

  /**
   * Check: System memory available
   */
  checkMemory() {
    return new Promise(resolve => {
      const name = 'System Memory';
      const os = require('os');
      const minMemory = 256; // MB

      this.diagnostics.log('info', `Checking: ${name}`);

      try {
        const freeMem = Math.round(os.freemem() / 1024 / 1024);
        const totalMem = Math.round(os.totalmem() / 1024 / 1024);

        if (freeMem < minMemory) {
          this.diagnostics.log('warn', `⚠ Low memory: ${freeMem}MB free (minimum: ${minMemory}MB)`);
          resolve({
            name,
            success: true, // Warning, not critical
            warning: `Low memory: ${freeMem}MB available`,
          });
        } else {
          this.diagnostics.log('info', `✓ Memory available: ${freeMem}MB free`);
          resolve({ name, success: true });
        }
      } catch (err) {
        this.diagnostics.log('error', `✗ Memory check failed: ${err.message}`);
        resolve({ name, success: false, error: err.message });
      }
    });
  }

  /**
   * Get human-readable status for UI
   */
  getStatusMessage(verifyResult) {
    if (verifyResult.success) {
      return 'Ready for offline use ✓';
    }

    const failures = verifyResult.results
      .filter(r => !r.success)
      .map(r => `${r.name}: ${r.error || 'failed'}`)
      .join('\n');

    return `Offline launch issues:\n${failures}`;
  }

  /**
   * Get detailed report for export
   */
  getDetailedReport(verifyResult) {
    const lines = [
      '='.repeat(80),
      'OFFLINE LAUNCH VERIFICATION REPORT',
      '='.repeat(80),
      '',
      `Timestamp: ${verifyResult.timestamp}`,
      `Overall Status: ${verifyResult.success ? 'PASS' : 'FAIL'}`,
      '',
      'Individual Checks:',
      '-'.repeat(80),
    ];

    for (const result of verifyResult.results) {
      const status = result.success ? '✓ PASS' : '✗ FAIL';
      lines.push(`${status} - ${result.name}`);
      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }
      if (result.warning) {
        lines.push(`  Warning: ${result.warning}`);
      }
    }

    lines.push('-'.repeat(80));
    lines.push('');

    if (!verifyResult.success) {
      lines.push('TROUBLESHOOTING:');
      lines.push('');

      for (const result of verifyResult.results) {
        if (!result.success) {
          lines.push(`${result.name}:`);
          lines.push(this.getTroubleshootingSteps(result));
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Get troubleshooting steps for specific failures
   */
  getTroubleshootingSteps(result) {
    const steps = {
      'Database': [
        '1. Check that Windows User Account has write permission to:',
        `   ${app.getPath('userData')}`,
        '2. Disable antivirus temporarily and try again',
        '3. Ensure at least 500MB free disk space',
        '4. Restart Windows and retry',
      ],
      'Application Files': [
        '1. Run: npm install',
        '2. Run: npm run build',
        '3. Reinstall the application',
      ],
      'Dependencies': [
        '1. Run: npm install',
        '2. Run: npm ci (to install exact versions)',
        '3. Reinstall the application',
      ],
      'Data Directory': [
        '1. Check Windows User Account permissions',
        '2. Run installer as Administrator',
        '3. Change installation path to different drive',
      ],
      'System Memory': [
        '1. Close other applications',
        '2. Restart Windows',
        '3. Add more RAM to system (if possible)',
      ],
    };

    return (steps[result.name] || ['See installation logs for details']).join('\n  ');
  }
}

module.exports = OfflineLaunchVerifier;
