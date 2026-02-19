import { loadBusinessHours, saveBusinessHours } from "../services/businessHoursService.js";
import { logError } from "../utils/logger.js";

/**
 * GET /api/business-hours
 */
export async function getBusinessHours(req, res) {
  try {
    const data = await loadBusinessHours();
    res.json(data);
  } catch (error) {
    logError("getBusinessHours", error);
    res.status(500).json({ error: "Failed to load business hours" });
  }
}

/**
 * POST /api/business-hours
 * Body: { sunday: [], monday: [{ start, end }], ... }
 */
export async function postBusinessHours(req, res) {
  try {
    const data = await saveBusinessHours(req.body || {});
    res.json(data);
  } catch (error) {
    logError("postBusinessHours", error);
    res.status(500).json({ error: "Failed to save business hours" });
  }
}
