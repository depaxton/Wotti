/**
 * Service Categories Controller
 * API endpoints for managing service categories (קטגוריות שירות)
 */

import {
  loadCategories,
  saveCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  addTreatment,
  updateTreatment,
  deleteTreatment,
} from '../services/serviceCategoriesService.js';
import { logError } from '../utils/logger.js';

/**
 * GET /api/service-categories
 */
export async function getCategories(req, res) {
  try {
    const categories = await loadCategories();
    res.json({ categories });
  } catch (error) {
    logError('getCategories', error);
    res.status(500).json({ error: 'Failed to load service categories' });
  }
}

/**
 * POST /api/service-categories
 * Body: { name, durationMinutes, bufferMinutes, maxPerHour }
 */
export async function postCategory(req, res) {
  try {
    const body = req.body || {};
    const category = await addCategory(body);
    res.status(201).json(category);
  } catch (error) {
    logError('postCategory', error);
    res.status(500).json({ error: 'Failed to add service category' });
  }
}

/**
 * PUT /api/service-categories/:id
 * Body: { name?, durationMinutes?, bufferMinutes?, maxPerHour? }
 */
export async function putCategory(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const category = await updateCategory(id, updates);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    logError('putCategory', error);
    res.status(500).json({ error: 'Failed to update service category' });
  }
}

/**
 * DELETE /api/service-categories/:id
 */
export async function deleteCategoryController(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteCategory(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logError('deleteCategory', error);
    res.status(500).json({ error: 'Failed to delete service category' });
  }
}

/**
 * POST /api/service-categories/:id/treatments
 * Body: { name, durationMinutes, bufferMinutes? }
 */
export async function postTreatment(req, res) {
  try {
    const { id: categoryId } = req.params;
    const body = req.body || {};
    const treatment = await addTreatment(categoryId, body);
    if (!treatment) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(201).json(treatment);
  } catch (error) {
    logError('postTreatment', error);
    res.status(500).json({ error: 'Failed to add treatment' });
  }
}

/**
 * PUT /api/service-categories/:id/treatments/:tid
 * Body: { name?, durationMinutes?, bufferMinutes? }
 */
export async function putTreatment(req, res) {
  try {
    const { id: categoryId, tid: treatmentId } = req.params;
    const updates = req.body || {};
    const treatment = await updateTreatment(categoryId, treatmentId, updates);
    if (!treatment) {
      return res.status(404).json({ error: 'Treatment or category not found' });
    }
    res.json(treatment);
  } catch (error) {
    logError('putTreatment', error);
    res.status(500).json({ error: 'Failed to update treatment' });
  }
}

/**
 * DELETE /api/service-categories/:id/treatments/:tid
 */
export async function deleteTreatmentController(req, res) {
  try {
    const { id: categoryId, tid: treatmentId } = req.params;
    const deleted = await deleteTreatment(categoryId, treatmentId);
    if (!deleted) {
      return res.status(404).json({ error: 'Treatment or category not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logError('deleteTreatment', error);
    res.status(500).json({ error: 'Failed to delete treatment' });
  }
}
