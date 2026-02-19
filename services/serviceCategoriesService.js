/**
 * Service Categories - ניהול קטגוריות שירות לקביעת תורים
 * כל קטגוריה מגדירה: שם, משך טיפול, מרווח בין פגישות, מקסימום פגישות בשעה
 */

import fs from 'fs/promises';
import path from 'path';
import { logError, logInfo } from '../utils/logger.js';

const DATA_DIR = 'data';
const FILE_NAME = 'service_categories.json';
const FILE_PATH = path.join(process.cwd(), DATA_DIR, FILE_NAME);

const SLOT_GRANULARITY_MINUTES = 15; // שעות עגולות: 10:00, 10:15, 10:30, 10:45

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
  } catch (error) {
    logError(`Failed to create data directory: ${error.message}`);
    throw error;
  }
}

/**
 * Generate unique category ID
 * @returns {string}
 */
function generateCategoryId() {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalize category data
 * @param {object} raw
 * @returns {object}
 */
function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: String(raw.id || generateCategoryId()),
    name: String(raw.name || '').trim() || 'שירות',
    durationMinutes: Math.max(5, Math.min(480, parseInt(raw.durationMinutes, 10) || 30)),
    bufferMinutes: Math.max(0, Math.min(60, parseInt(raw.bufferMinutes, 10) || 0)),
    maxPerHour: Math.max(1, Math.min(10, parseInt(raw.maxPerHour, 10) || 1)),
  };
}

/**
 * Load service categories from file
 * @returns {Promise<Array<object>>}
 */
export async function loadCategories() {
  await ensureDataDir();
  try {
    const content = await fs.readFile(FILE_PATH, 'utf8');
    const data = JSON.parse(content);
    const list = Array.isArray(data?.categories) ? data.categories : [];
    return list.map(normalizeCategory).filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaultData = { categories: [] };
      await fs.writeFile(FILE_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
      return [];
    }
    logError(`Failed to load service categories: ${error.message}`);
    return [];
  }
}

/**
 * Save service categories to file
 * @param {Array<object>} categories
 * @returns {Promise<Array<object>>}
 */
export async function saveCategories(categories) {
  await ensureDataDir();
  const list = Array.isArray(categories) ? categories : [];
  const normalized = list.map(normalizeCategory).filter(Boolean);
  try {
    await fs.writeFile(FILE_PATH, JSON.stringify({ categories: normalized }, null, 2), 'utf8');
    logInfo(`Saved ${normalized.length} service categories`);
    return normalized;
  } catch (error) {
    logError(`Failed to save service categories: ${error.message}`);
    throw error;
  }
}

/**
 * Get category by ID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getCategoryById(id) {
  const categories = await loadCategories();
  return categories.find((c) => c.id === id) || null;
}

/**
 * Add a new category
 * @param {object} category
 * @returns {Promise<object>}
 */
export async function addCategory(category) {
  const categories = await loadCategories();
  const normalized = normalizeCategory({ ...category, id: undefined });
  normalized.id = generateCategoryId();
  categories.push(normalized);
  await saveCategories(categories);
  return normalized;
}

/**
 * Update an existing category
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
export async function updateCategory(id, updates) {
  const categories = await loadCategories();
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const merged = { ...categories[index], ...updates, id };
  categories[index] = normalizeCategory(merged);
  await saveCategories(categories);
  return categories[index];
}

/**
 * Delete a category (existing appointments keep their categoryId for display)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteCategory(id) {
  const categories = await loadCategories();
  const filtered = categories.filter((c) => c.id !== id);
  if (filtered.length === categories.length) return false;
  await saveCategories(filtered);
  logInfo(`Deleted service category ${id}`);
  return true;
}

/**
 * Slot granularity for round hours (15 min)
 */
export const SLOT_GRANULARITY = SLOT_GRANULARITY_MINUTES;
