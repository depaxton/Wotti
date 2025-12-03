// Script to upload release ZIP to GitHub Releases
// Requires GitHub Personal Access Token with repo permissions

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { logInfo, logError, logWarn } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Loads .env file if it exists
 */
function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, ...valueParts] = trimmedLine.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
          process.env[key.trim()] = value;
        }
      }
    }
  }
}

/**
 * Gets current version from package.json
 */
function getCurrentVersion() {
  const packageJsonPath = path.join(PROJECT_ROOT, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version || "1.0.0";
}

/**
 * Creates a GitHub release and uploads the ZIP file
 */
async function uploadRelease() {
  // Load .env file if it exists
  loadEnvFile();

  const version = getCurrentVersion();
  const tagName = `v${version}`;
  const zipFileName = `wotti-${version}.zip`;
  const zipPath = path.join(PROJECT_ROOT, zipFileName);

  // Check if ZIP exists
  if (!(await fs.pathExists(zipPath))) {
    logError(`ZIP file not found: ${zipPath}`);
    logInfo("Please run 'npm run create-release' first to create the ZIP file");
    process.exit(1);
  }

  // Get GitHub token from environment or .env file
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logError("GitHub token not found!");
    logInfo("Please set GITHUB_TOKEN environment variable:");
    logInfo("  set GITHUB_TOKEN=your_token_here");
    logInfo("Or create a .env file with: GITHUB_TOKEN=your_token_here");
    logInfo("\nTo create a token:");
    logInfo("1. Go to: https://github.com/settings/tokens");
    logInfo("2. Generate new token (classic)");
    logInfo("3. Select 'repo' scope");
    process.exit(1);
  }

  const repo = "depaxton/Wotti";
  const apiBase = "https://api.github.com";

  try {
    logInfo(`Uploading release ${tagName}...`);

    // Step 1: Check if release already exists
    let releaseId = null;
    let uploadUrl = null;
    try {
      const existingRelease = await axios.get(
        `${apiBase}/repos/${repo}/releases/tags/${tagName}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      releaseId = existingRelease.data.id;
      logInfo(`Release ${tagName} already exists, updating...`);
    } catch (error) {
      if (error.response?.status === 404) {
        logInfo(`Creating new release ${tagName}...`);
      } else {
        throw error;
      }
    }

    // Step 2: Create or get release
    if (!releaseId) {
      const releaseData = {
        tag_name: tagName,
        name: `Wotti ${tagName}`,
        body: `## Changes in ${tagName}\n\nSee version.json for full changelog.`,
        draft: false,
        prerelease: false,
      };

      const createResponse = await axios.post(
        `${apiBase}/repos/${repo}/releases`,
        releaseData,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      releaseId = createResponse.data.id;
      uploadUrl = createResponse.data.upload_url;
      logInfo(`Release created: ${createResponse.data.html_url}`);
    } else {
      // Get existing release to get upload_url
      const existingRelease = await axios.get(
        `${apiBase}/repos/${repo}/releases/${releaseId}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      uploadUrl = existingRelease.data.upload_url;
    }

    // Step 3: Upload ZIP file
    logInfo(`Uploading ${zipFileName}...`);
    const zipBuffer = await fs.readFile(zipPath);

    // Check if asset already exists and delete it
    try {
      const assets = await axios.get(
        `${apiBase}/repos/${repo}/releases/${releaseId}/assets`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      const existingAsset = assets.data.find((a) => a.name === zipFileName);
      if (existingAsset) {
        logInfo(`Deleting existing asset ${zipFileName}...`);
        await axios.delete(
          `${apiBase}/repos/${repo}/releases/assets/${existingAsset.id}`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
      }
    } catch (error) {
      logWarn("Could not check for existing assets:", error.message);
    }

    // Upload the file using upload_url from release
    // upload_url format: https://uploads.github.com/repos/{owner}/{repo}/releases/{id}/assets{?name,label}
    const uploadUrlWithParams = uploadUrl.replace("{?name,label}", `?name=${encodeURIComponent(zipFileName)}`);
    const uploadResponse = await axios.post(
      uploadUrlWithParams,
      zipBuffer,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/zip",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    logInfo(`✅ Upload successful!`);
    logInfo(`Release URL: ${uploadResponse.data.browser_download_url}`);
    logInfo(`Download URL: https://github.com/${repo}/releases/download/${tagName}/${zipFileName}`);

    return uploadResponse.data.browser_download_url;
  } catch (error) {
    if (error.response) {
      logError(`GitHub API Error: ${error.response.status}`);
      logError(error.response.data?.message || error.response.statusText);
      if (error.response.data?.errors) {
        error.response.data.errors.forEach((err) => {
          logError(`  - ${err.message || JSON.stringify(err)}`);
        });
      }
    } else {
      logError("Upload failed:", error.message);
    }
    process.exit(1);
  }
}

// Run
uploadRelease().catch((error) => {
  logError("Unexpected error:", error);
  process.exit(1);
});

