// Script to create a release package for GitHub Releases
// This script creates a ZIP file and prepares everything for uploading

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import { logInfo, logError } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Gets current version from package.json
 */
function getCurrentVersion() {
  const packageJsonPath = path.join(PROJECT_ROOT, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version || "1.0.0";
}

/**
 * Creates a ZIP file excluding unnecessary files
 */
async function createReleaseZip(version) {
  const zip = new AdmZip();
  const zipFileName = `wotti-${version}.zip`;
  const zipPath = path.join(PROJECT_ROOT, zipFileName);

  logInfo(`Creating release ZIP: ${zipFileName}`);

  // List of files/directories to include
  const itemsToInclude = [
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
    ".gitignore",
    "README.md",
    "START.md",
    "LAUNCHER-README.md",
    "UPDATE-PROCESS.md",
    "launch-wotti.bat",
    "launch-wotti.ps1",
    "create-desktop-shortcut.ps1",
  ];

  // Protected folders to exclude
  const excludeFolders = ["node_modules", ".wwebjs_auth", "data", "updates", ".git"];

  let fileCount = 0;

  for (const item of itemsToInclude) {
    const itemPath = path.join(PROJECT_ROOT, item);

    if (!(await fs.pathExists(itemPath))) {
      logInfo(`Skipping (not found): ${item}`);
      continue;
    }

    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      // Add directory recursively
      const files = await getAllFiles(itemPath);
      for (const file of files) {
        // Skip files in excluded folders
        if (excludeFolders.some((folder) => file.includes(path.join(PROJECT_ROOT, folder)))) {
          continue;
        }

        const relativePath = path.relative(PROJECT_ROOT, file);
        zip.addLocalFile(file, path.dirname(relativePath));
        fileCount++;
      }
    } else {
      // Add single file
      zip.addLocalFile(itemPath);
      fileCount++;
    }
  }

  // Save ZIP
  zip.writeZip(zipPath);

  logInfo(`ZIP created successfully: ${zipFileName} (${fileCount} files)`);
  logInfo(`ZIP location: ${zipPath}`);

  return zipPath;
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = await fs.readdir(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      arrayOfFiles = await getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  }

  return arrayOfFiles;
}

/**
 * Main function
 */
async function main() {
  try {
    logInfo("=== Creating Release Package ===");

    // Get version
    const version = getCurrentVersion();
    logInfo(`Current version: ${version}`);

    // Create ZIP
    const zipPath = await createReleaseZip(version);

    // Get current date
    const today = new Date().toISOString().split("T")[0];

    // Create release info
    const releaseInfo = {
      version: version,
      zipFileName: path.basename(zipPath),
      zipPath: zipPath,
      releaseUrl: `https://github.com/depaxton/Wotti/releases/new`,
      downloadUrl: `https://github.com/depaxton/Wotti/releases/download/v${version}/${path.basename(zipPath)}`,
      releaseDate: today,
      tagName: `v${version}`,
    };

    logInfo("\n=== Release Package Created Successfully ===");
    logInfo(`Version: ${releaseInfo.version}`);
    logInfo(`ZIP File: ${releaseInfo.zipFileName}`);
    logInfo(`ZIP Location: ${releaseInfo.zipPath}`);
    logInfo(`\n=== Next Steps ===`);
    logInfo(`1. Go to: ${releaseInfo.releaseUrl}`);
    logInfo(`2. Create a new release:`);
    logInfo(`   - Tag: ${releaseInfo.tagName}`);
    logInfo(`   - Title: Wotti ${releaseInfo.tagName}`);
    logInfo(`3. Upload the ZIP file: ${releaseInfo.zipFileName}`);
    logInfo(`4. After publishing, the download URL will be:`);
    logInfo(`   ${releaseInfo.downloadUrl}`);
    logInfo(`5. Update version.json with the downloadUrl`);
    logInfo(`\n=== ZIP File Ready for Upload ===`);
  } catch (error) {
    logError("Failed to create release package", error);
    process.exit(1);
  }
}

main();

