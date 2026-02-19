// Update utility functions
// Handles downloading, extracting, and installing updates

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import AdmZip from "adm-zip";
import { promisify } from "util";
import { exec } from "child_process";
import { logInfo, logError, logWarn } from "./logger.js";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Downloads a file from URL to destination
 * @param {string} url - URL to download from
 * @param {string} destPath - Destination file path
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function downloadFile(url, destPath, timeout = 5 * 60 * 1000) {
  try {
    logInfo(`Downloading update from: ${url}`);
    
    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(destPath));
    
    // Download file with progress tracking
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: timeout,
    });
    
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      let downloadedBytes = 0;
      const totalBytes = parseInt(response.headers["content-length"] || "0", 10);
      
      response.data.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\rDownload progress: ${progress}%`);
        }
      });
      
      writer.on("finish", () => {
        console.log(); // New line after progress
        logInfo(`Download completed: ${destPath}`);
        resolve();
      });
      
      writer.on("error", (error) => {
        fs.remove(destPath).catch(() => {}); // Clean up on error
        reject(error);
      });
      
      response.data.on("error", (error) => {
        fs.remove(destPath).catch(() => {}); // Clean up on error
        reject(error);
      });
    });
  } catch (error) {
    logError(`Failed to download file from ${url}`, error);
    throw error;
  }
}

/**
 * Validates a ZIP file
 * @param {string} zipPath - Path to ZIP file
 * @returns {Promise<boolean>}
 */
export async function validateZipFile(zipPath) {
  try {
    if (!(await fs.pathExists(zipPath))) {
      logError(`ZIP file not found: ${zipPath}`);
      return false;
    }
    
    const stats = await fs.stat(zipPath);
    if (stats.size === 0) {
      logError(`ZIP file is empty: ${zipPath}`);
      return false;
    }
    
    // Try to open and validate ZIP structure
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    if (entries.length === 0) {
      logError(`ZIP file contains no entries: ${zipPath}`);
      return false;
    }
    
    // Check if package.json exists in ZIP
    const hasPackageJson = entries.some((entry) => 
      entry.entryName === "package.json" || entry.entryName.endsWith("/package.json")
    );
    
    if (!hasPackageJson) {
      logWarn("ZIP file does not contain package.json - may not be a valid update package");
    }
    
    logInfo(`ZIP file validated successfully: ${zipPath} (${entries.length} entries)`);
    return true;
  } catch (error) {
    logError(`Failed to validate ZIP file: ${zipPath}`, error);
    return false;
  }
}

/**
 * Extracts a ZIP file to destination directory
 * @param {string} zipPath - Path to ZIP file
 * @param {string} destDir - Destination directory
 * @returns {Promise<void>}
 */
export async function extractZip(zipPath, destDir) {
  try {
    logInfo(`Extracting ZIP to: ${destDir}`);
    
    // Create destination directory
    await fs.ensureDir(destDir);
    
    // Extract ZIP
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true); // overwrite = true
    
    logInfo(`ZIP extracted successfully to: ${destDir}`);
  } catch (error) {
    logError(`Failed to extract ZIP file: ${zipPath}`, error);
    throw error;
  }
}

/**
 * Creates a backup of the current version
 * @param {string} backupDir - Backup directory
 * @param {string} version - Version to backup
 * @returns {Promise<string>} Path to backup directory
 */
export async function createBackup(backupDir, version) {
  try {
    const backupPath = path.join(backupDir, `v${version}`);
    logInfo(`Creating backup to: ${backupPath}`);
    
    // Create backup directory
    await fs.ensureDir(backupPath);
    
    // List of files/directories to backup (exclude protected folders)
    const itemsToBackup = [
      "app.js",
      "index.js",
      "package.json",
      "package-lock.json",
      "script.js",
      "index.html",
      "components",
      "config",
      "controllers",
      "routes",
      "services",
      "styles",
      "utils",
      "assets",
    ];
    
    // Copy each item
    for (const item of itemsToBackup) {
      const sourcePath = path.join(PROJECT_ROOT, item);
      const destPath = path.join(backupPath, item);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath, {
          overwrite: true,
          filter: (src) => {
            // Exclude node_modules and other unnecessary files
            if (src.includes("node_modules")) return false;
            if (src.includes(".git")) return false;
            if (src.includes("updates")) return false;
            if (src.endsWith(".log")) return false;
            return true;
          },
        });
        logInfo(`Backed up: ${item}`);
      }
    }
    
    logInfo(`Backup created successfully: ${backupPath}`);
    return backupPath;
  } catch (error) {
    logError(`Failed to create backup`, error);
    throw error;
  }
}

/**
 * Restores from a backup
 * @param {string} backupPath - Path to backup directory
 * @returns {Promise<void>}
 */
export async function restoreFromBackup(backupPath) {
  try {
    logInfo(`Restoring from backup: ${backupPath}`);
    
    if (!(await fs.pathExists(backupPath))) {
      throw new Error(`Backup path does not exist: ${backupPath}`);
    }
    
    // List all items in backup
    const items = await fs.readdir(backupPath);
    
    // Restore each item
    for (const item of items) {
      const sourcePath = path.join(backupPath, item);
      const destPath = path.join(PROJECT_ROOT, item);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath, {
          overwrite: true,
        });
        logInfo(`Restored: ${item}`);
      }
    }
    
    logInfo(`Restore completed successfully`);
  } catch (error) {
    logError(`Failed to restore from backup: ${backupPath}`, error);
    throw error;
  }
}

/**
 * Prepares update files in pending directory
 */
export async function prepareUpdateFiles(extractedDir, version) {
  try {
    const pendingDir = path.join(PROJECT_ROOT, "updates", "pending");
    logInfo(`Preparing update files in: ${pendingDir}`);
    
    await fs.remove(pendingDir);
    await fs.ensureDir(pendingDir);
    
    const itemsToInstall = [
      "app.js", "index.js", "package.json", "package-lock.json",
      "script.js", "index.html", "components", "config",
      "controllers", "routes", "services", "styles", "utils", "assets",
    ];
    
    for (const item of itemsToInstall) {
      const sourcePath = path.join(extractedDir, item);
      const destPath = path.join(pendingDir, item);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath, {
          overwrite: true,
          filter: (src) => !src.includes("node_modules") && !src.includes(".git"),
        });
        logInfo(`Prepared: ${item}`);
      }
    }
    
    await fs.writeJson(path.join(pendingDir, "update-info.json"), {
      version, timestamp: Date.now(), preparedAt: new Date().toISOString(),
    }, { spaces: 2 });
    
    logInfo(`Update files prepared for version ${version}`);
  } catch (error) {
    logError(`Failed to prepare update files`, error);
    throw error;
  }
}

/**
 * @deprecated - causes EBUSY errors, use prepareUpdateFiles instead
 */
export async function installUpdate(extractedDir) {
  try {
    logInfo(`Installing update from: ${extractedDir}`);
    
    // List of files/directories to install (excluding protected folders)
    const itemsToInstall = [
      "app.js",
      "index.js",
      "package.json",
      "package-lock.json",
      "script.js",
      "index.html",
      "components",
      "config",
      "controllers",
      "routes",
      "services",
      "styles",
      "utils",
      "assets",
    ];
    
    // Protected folders that should NOT be overwritten
    const protectedFolders = ["data", ".wwebjs_auth", "node_modules"];
    
    // Install each item
    for (const item of itemsToInstall) {
      // Skip protected folders
      if (protectedFolders.includes(item)) {
        logWarn(`Skipping protected folder: ${item}`);
        continue;
      }
      
      const sourcePath = path.join(extractedDir, item);
      const destPath = path.join(PROJECT_ROOT, item);
      
      if (await fs.pathExists(sourcePath)) {
        // Remove destination if exists
        if (await fs.pathExists(destPath)) {
          await fs.remove(destPath);
        }
        
        // Copy new files
        await fs.copy(sourcePath, destPath, {
          overwrite: true,
          filter: (src) => {
            // Additional safety checks
            if (src.includes("node_modules")) return false;
            if (src.includes(".git")) return false;
            if (src.includes("data/")) return false;
            if (src.includes(".wwebjs_auth/")) return false;
            return true;
          },
        });
        
        logInfo(`Installed: ${item}`);
      }
    }
    
    logInfo(`Update installation completed`);
  } catch (error) {
    logError(`Failed to install update`, error);
    throw error;
  }
}

/**
 * Runs npm install
 * @returns {Promise<void>}
 */
export async function runNpmInstall() {
  try {
    logInfo("Running npm install...");
    
    const { stdout, stderr } = await execAsync("npm install", {
      cwd: PROJECT_ROOT,
      timeout: 10 * 60 * 1000, // 10 minutes timeout
    });
    
    if (stderr && !stderr.includes("npm WARN")) {
      logWarn(`npm install warnings: ${stderr}`);
    }
    
    logInfo("npm install completed successfully");
  } catch (error) {
    logError("Failed to run npm install", error);
    throw error;
  }
}

/**
 * Cleans up old backups, keeping only the most recent N backups
 * @param {string} backupDir - Backup directory
 * @param {number} maxBackups - Maximum number of backups to keep
 * @returns {Promise<void>}
 */
export async function cleanupOldBackups(backupDir, maxBackups = 3) {
  try {
    if (!(await fs.pathExists(backupDir))) {
      return;
    }
    
    const backups = await fs.readdir(backupDir);
    const backupPathsWithStats = await Promise.all(
      backups.map(async (name) => {
        const backupPath = path.join(backupDir, name);
        try {
          const stat = await fs.stat(backupPath);
          return {
            name,
            path: backupPath,
            isDirectory: stat.isDirectory(),
          };
        } catch {
          return null;
        }
      })
    );
    
    const backupPaths = backupPathsWithStats.filter((item) => item && item.isDirectory);
    
    // Get modification time for all backups (for sorting by date)
    const backupsWithStats = await Promise.all(
      backupPaths.map(async (item) => {
        try {
          const stat = await fs.stat(item.path);
          return {
            ...item,
            mtime: stat.mtime,
          };
        } catch {
          return null;
        }
      })
    );
    
    const validBackups = backupsWithStats.filter((item) => item !== null);
    
    // Sort by modification time (newest first)
    validBackups.sort((a, b) => b.mtime - a.mtime);
    
    // Remove old backups
    if (validBackups.length > maxBackups) {
      const toRemove = validBackups.slice(maxBackups);
      for (const backup of toRemove) {
        logInfo(`Removing old backup: ${backup.name}`);
        await fs.remove(backup.path);
      }
    }
  } catch (error) {
    logWarn(`Failed to cleanup old backups`, error);
    // Don't throw - this is not critical
  }
}

