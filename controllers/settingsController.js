import { loadSettings, saveSettings } from '../services/settingsService.js';
import { REMINDER_TEMPLATE } from '../config/reminderTemplates.js';

export async function getSettings(req, res) {
  try {
    const settings = await loadSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
}

export async function updateSettings(req, res) {
  try {
    const updates = req.body;
    const current = await loadSettings();
    const newSettings = { ...current, ...updates };
    await saveSettings(newSettings);
    res.json(newSettings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
}

export async function getReminderTemplate(req, res) {
  try {
    const settings = await loadSettings();
    // Return custom template if exists, otherwise return default
    const template = settings.reminderTemplate || REMINDER_TEMPLATE;
    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reminder template' });
  }
}

export async function updateReminderTemplate(req, res) {
  try {
    const { template } = req.body;
    
    if (typeof template !== 'string') {
      return res.status(400).json({ error: 'Template must be a string' });
    }
    
    const settings = await loadSettings();
    settings.reminderTemplate = template;
    await saveSettings(settings);
    
    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save reminder template' });
  }
}

