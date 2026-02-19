import fs from "fs/promises";
import path from "path";
import { logError, logInfo } from "../utils/logger.js";

const DATA_DIR = "data";
const FILE_NAME = "business_hours.json";
const FILE_PATH = path.join(process.cwd(), DATA_DIR, FILE_NAME);

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function createDefaultData() {
  const data = {};
  for (const day of DAY_KEYS) {
    data[day] = [];
  }
  return data;
}

/**
 * Normalize loaded data: ensure all day keys exist and values are arrays of { start, end } (may have multiple ranges per day)
 */
function normalizeData(raw) {
  const data = createDefaultData();
  if (!raw || typeof raw !== "object") return data;
  for (const day of DAY_KEYS) {
    const val = raw[day];
    if (Array.isArray(val) && val.length > 0) {
      data[day] = val
        .filter((r) => r && typeof r.start === "string" && typeof r.end === "string")
        .map((r) => ({ start: r.start, end: r.end }));
    }
  }
  return data;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
  } catch (error) {
    logError(`Failed to create data directory: ${error.message}`);
    throw error;
  }
}

/**
 * Load business hours from local file
 * @returns {Promise<Record<string, Array<{ start: string, end: string }>>>}
 */
export async function loadBusinessHours() {
  await ensureDataDir();
  try {
    const content = await fs.readFile(FILE_PATH, "utf8");
    const raw = JSON.parse(content);
    return normalizeData(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      const defaultData = createDefaultData();
      await saveBusinessHours(defaultData);
      return defaultData;
    }
    logError(`Failed to load business hours: ${error.message}`);
    return createDefaultData();
  }
}

/**
 * Save business hours to local file
 * @param {Record<string, Array<{ start: string, end: string }>>} data
 */
export async function saveBusinessHours(data) {
  await ensureDataDir();
  const normalized = normalizeData(data);
  try {
    await fs.writeFile(FILE_PATH, JSON.stringify(normalized, null, 2), "utf8");
    logInfo("Business hours saved locally");
    return normalized;
  } catch (error) {
    logError(`Failed to save business hours: ${error.message}`);
    throw error;
  }
}
