// Auto-update service
// Checks for updates, downloads and installs them automatically

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import semver from "semver";
import { UPDATE_CONFIG } from "../config/updateConfig.js";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { downloadFile, validateZipFile, extractZip, createBackup, restoreFromBackup, installUpdate, runNpmInstall, cleanupOldBackups, prepareUpdateFiles, launchExternalInstaller } from "../utils/updateUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

let updateCheckInterval = null;
let isUpdating = false;
let currentVersion = null;

/**
 * Gets the current version from package.json
 * @returns {Promise<string>}
 */
async function getCurrentVersion() {
  try {
    const packageJsonPath = path.join(PROJECT_ROOT, "package.json");
    const packageJson = await fs.readJson(packageJsonPath);
    return packageJson.version || "0.0.0";
  } catch (error) {
    logError("Failed to get current version", error);
    return "0.0.0";
  }
}

/**
 * Fetches version information from the update server
 * @returns {Promise<Object|null>}
 */
async function fetchVersionInfo() {
  try {
    // Add timestamp to URL to bypass cache
    const urlWithCacheBust = `${UPDATE_CONFIG.UPDATE_CHECK_URL}?t=${Date.now()}`;
    logInfo(`Checking for updates from: ${UPDATE_CONFIG.UPDATE_CHECK_URL}`);

    const response = await axios.get(urlWithCacheBust, {
      timeout: 10000, // 10 seconds timeout
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    return response.data;
  } catch (error) {
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      logWarn(`Could not connect to update server: ${UPDATE_CONFIG.UPDATE_CHECK_URL}`);
    } else {
      logError("Failed to fetch version info", error);
    }
    return null;
  }
}

/**
 * Checks if an update is available
 * @returns {Promise<Object|null>} Update info if available, null otherwise
 */
async function checkForUpdate() {
  try {
    if (isUpdating) {
      logWarn("Update already in progress, skipping check");
      return null;
    }

    currentVersion = await getCurrentVersion();
    logInfo(`Current version: ${currentVersion}`);

    const versionInfo = await fetchVersionInfo();
    if (!versionInfo || !versionInfo.version) {
      return null;
    }

    const remoteVersion = versionInfo.version;
    logInfo(`Remote version: ${remoteVersion}`);

    // Compare versions using semver
    if (semver.gt(remoteVersion, currentVersion)) {
      logInfo(`Update available: ${currentVersion} → ${remoteVersion}`);
      return {
        ...versionInfo,
        currentVersion,
        remoteVersion,
      };
    } else {
      logInfo("No update available - already on latest version");
      return null;
    }
  } catch (error) {
    logError("Error checking for update", error);
    return null;
  }
}

/**
 * Downloads and installs an update
 * @param {Object} updateInfo - Update information
 * @returns {Promise<boolean>} Success status
 */
async function downloadAndInstallUpdate(updateInfo) {
  if (isUpdating) {
    logWarn("Update already in progress");
    return false;
  }

  isUpdating = true;

  try {
    logInfo(`Starting update process: ${updateInfo.currentVersion} → ${updateInfo.remoteVersion}`);

    // Stop update checking during update process
    stopUpdateChecker();

    // Create temporary directories
    const tempDir = path.join(PROJECT_ROOT, UPDATE_CONFIG.UPDATE_TEMP_DIR);
    const backupDir = path.join(PROJECT_ROOT, UPDATE_CONFIG.UPDATE_BACKUP_DIR);
    await fs.ensureDir(tempDir);
    await fs.ensureDir(backupDir);

    // Step 1: Create backup
    logInfo("Step 1: Creating backup...");
    await createBackup(backupDir, currentVersion);

    // Step 2: Download update
    logInfo("Step 2: Downloading update...");
    const zipFileName = `wotti-${updateInfo.remoteVersion}.zip`;
    const zipPath = path.join(tempDir, zipFileName);

    let downloadSuccess = false;
    for (let attempt = 1; attempt <= UPDATE_CONFIG.MAX_DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        await downloadFile(updateInfo.downloadUrl, zipPath, UPDATE_CONFIG.DOWNLOAD_TIMEOUT);
        downloadSuccess = true;
        break;
      } catch (error) {
        logError(`Download attempt ${attempt} failed`, error);
        if (attempt < UPDATE_CONFIG.MAX_DOWNLOAD_ATTEMPTS) {
          logInfo(`Retrying download (attempt ${attempt + 1}/${UPDATE_CONFIG.MAX_DOWNLOAD_ATTEMPTS})...`);
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }
    }

    if (!downloadSuccess) {
      throw new Error("Failed to download update after multiple attempts");
    }

    // Step 3: Validate ZIP
    logInfo("Step 3: Validating update package...");
    const isValid = await validateZipFile(zipPath);
    if (!isValid) {
      throw new Error("Update package validation failed");
    }

    // Step 4: Extract ZIP
    logInfo("Step 4: Extracting update package...");
    const extractedDir = path.join(tempDir, "extracted");
    await extractZip(zipPath, extractedDir);

    // Step 5: Prepare update files in pending folder (VBS will do actual replacement)
    logInfo("Step 5: Preparing update files...");
    await prepareUpdateFiles(extractedDir, updateInfo.remoteVersion);

    // Step 6: Cleanup old backups
    logInfo("Step 6: Cleaning up old backups...");
    await cleanupOldBackups(backupDir, UPDATE_CONFIG.MAX_BACKUPS);

    // Step 7: Cleanup temp files (keep pending folder!)
    logInfo("Step 7: Cleaning up temp files...");
    await fs.remove(path.join(tempDir, "extracted")).catch(() => {});
    await fs.remove(path.join(tempDir, zipFileName)).catch(() => {});

    logInfo(`Update prepared: ${updateInfo.currentVersion} → ${updateInfo.remoteVersion}`);

    // Step 8: Launch external VBS installer and exit
    logInfo("Step 8: Launching external installer...");
    await new Promise((resolve) => setTimeout(resolve, UPDATE_CONFIG.RESTART_DELAY));
    await launchExternalInstaller();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    logInfo("Exiting for update...");
    process.exit(0);

    return true;
  } catch (error) {
    logError("Update failed, attempting rollback...", error);

    try {
      const backupDir = path.join(PROJECT_ROOT, UPDATE_CONFIG.UPDATE_BACKUP_DIR);
      const backupPath = path.join(backupDir, `v${currentVersion}`);

      if (await fs.pathExists(backupPath)) {
        logInfo("Restoring from backup...");
        await restoreFromBackup(backupPath);
        logInfo("Rollback completed successfully");
      } else {
        logError("Backup not found - cannot rollback");
      }
    } catch (rollbackError) {
      logError("Rollback failed", rollbackError);
    }

    try {
      const tempDir = path.join(PROJECT_ROOT, UPDATE_CONFIG.UPDATE_TEMP_DIR);
      await fs.remove(tempDir).catch(() => {});
      await fs.remove(path.join(PROJECT_ROOT, "updates", "pending")).catch(() => {});
    } catch (cleanupError) {}

    startUpdateChecker();
    isUpdating = false;
    return false;
  }
}

/**
 * Restarts the application
 */
async function restartApplication() {
  logInfo("Restarting application...");

  try {
    // On Windows, use restart-after-wake.vbs for silent restart
    if (process.platform === "win32") {
      const { spawn } = await import("child_process");
      const restartVbsPath = path.join(PROJECT_ROOT, "restart-after-wake.vbs");

      const exists = await fs.pathExists(restartVbsPath);
      if (exists) {
        logInfo(`Running restart script: ${restartVbsPath}`);

        // Use wscript to run VBS silently (no CMD window)
        // wscript runs VBS scripts without showing any window
        spawn("wscript.exe", [restartVbsPath], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        }).unref();

        // Give it a moment to start, then exit
        setTimeout(() => {
          process.exit(0);
        }, 1000);
        return;
      } else {
        logWarn("restart-after-wake.vbs not found, trying fallback...");
      }
    }

    // Fallback for Linux/Mac or if VBS not found - spawn node directly
    const { spawn } = await import("child_process");
    const indexPath = path.join(PROJECT_ROOT, "index.js");

    spawn("node", [indexPath], {
      detached: true,
      stdio: "ignore",
      cwd: PROJECT_ROOT,
    }).unref();

    logInfo("Spawned new process, exiting current...");
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    logError("Error during restart", error);
    // Exit anyway
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

/**
 * Starts the periodic update checker
 */
export function startUpdateChecker() {
  if (!UPDATE_CONFIG.AUTO_UPDATE_ENABLED) {
    logInfo("Auto-update is disabled");
    return;
  }

  if (updateCheckInterval) {
    logWarn("Update checker already running");
    return;
  }

  logInfo(`Starting update checker (interval: ${UPDATE_CONFIG.UPDATE_CHECK_INTERVAL} minutes)`);

  // Check immediately on startup
  checkForUpdateAndInstall().catch((error) => {
    logError("Error in initial update check", error);
  });

  // Then check periodically
  const intervalMs = UPDATE_CONFIG.UPDATE_CHECK_INTERVAL * 60 * 1000;
  updateCheckInterval = setInterval(() => {
    checkForUpdateAndInstall().catch((error) => {
      logError("Error in periodic update check", error);
    });
  }, intervalMs);
}

/**
 * Stops the periodic update checker
 */
export function stopUpdateChecker() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
    logInfo("Update checker stopped");
  }
}

/**
 * Checks for update and installs if available
 * @param {boolean} forceCheck - Force check even if update is in progress
 * @returns {Promise<boolean>} True if update was installed
 */
async function checkForUpdateAndInstall(forceCheck = false) {
  if (isUpdating && !forceCheck) {
    return false;
  }

  const updateInfo = await checkForUpdate();
  if (!updateInfo) {
    return false;
  }

  // Check if update is required
  if (updateInfo.required) {
    logInfo("Required update detected - installing immediately");
    return await downloadAndInstallUpdate(updateInfo);
  } else {
    // Optional update - could show notification to user
    if (UPDATE_CONFIG.SHOW_UPDATE_NOTIFICATION) {
      logInfo(`Optional update available: ${updateInfo.changelog || "No changelog"}`);
    }

    // For now, install optional updates automatically
    // In the future, you could add a user prompt here
    logInfo("Installing optional update...");
    return await downloadAndInstallUpdate(updateInfo);
  }
}

/**
 * Manually check for updates
 * @returns {Promise<Object|null>} Update info if available
 */
export async function manualUpdateCheck() {
  logInfo("Manual update check requested");
  return await checkForUpdate();
}

/**
 * Manually trigger update installation
 * @param {Object} updateInfo - Update information (optional, will check if not provided)
 * @returns {Promise<boolean>} Success status
 */
export async function manualUpdateInstall(updateInfo = null) {
  logInfo("Manual update install requested");

  if (!updateInfo) {
    updateInfo = await checkForUpdate();
    if (!updateInfo) {
      logWarn("No update available for manual installation");
      return false;
    }
  }

  return await downloadAndInstallUpdate(updateInfo);
}

/**
 * Gets update status
 * @returns {Promise<Object>}
 */
export async function getUpdateStatus() {
  const current = await getCurrentVersion();
  const updateInfo = await fetchVersionInfo();

  return {
    currentVersion: current,
    remoteVersion: updateInfo?.version || null,
    updateAvailable: updateInfo ? semver.gt(updateInfo.version, current) : false,
    isUpdating: isUpdating,
    updateInfo: updateInfo || null,
  };
}
