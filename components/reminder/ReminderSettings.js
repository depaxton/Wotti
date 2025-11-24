import { REMINDER_TEMPLATE } from '../../config/reminderTemplates.js';
import { toast } from '../toast/Toast.js';
import { clearTemplateCache } from '../../services/reminderTemplateService.js';

const API_URL = window.location.hostname === "localhost" 
  ? "http://localhost:5000" 
  : `${window.location.protocol}//${window.location.hostname}:5000`;

/**
 * Creates the reminder settings interface (sliding panel)
 */
export function createReminderSettingsPanel() {
  // Cleanup any existing panels
  const existingPanels = document.querySelectorAll(".reminder-settings-panel, .reminder-settings-overlay");
  existingPanels.forEach((p) => p.remove());

  // Overlay
  const overlay = document.createElement("div");
  overlay.className = "reminder-settings-overlay";

  // Panel
  const panel = document.createElement("div");
  panel.className = "reminder-settings-panel";

  // State
  let currentTemplate = REMINDER_TEMPLATE;

  // Header
  const header = document.createElement("div");
  header.className = "reminder-settings-header";
  header.innerHTML = `
    <h2>הגדרות תזכורת</h2>
    <button type="button" class="close-reminder-settings-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Template Editor Section
  const editorSection = document.createElement("div");
  editorSection.className = "reminder-settings-section";

  // Editor Content Container
  const editorContent = document.createElement("div");
  editorContent.className = "editor-content";
  editorContent.innerHTML = `
    <div class="section-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      עריכת תבנית התזכורת
    </div>
    
    <div class="template-buttons">
      <button type="button" class="template-var-btn" data-var="{day}">
        <span class="var-icon">📅</span>
        <span>יום</span>
      </button>
      <button type="button" class="template-var-btn" data-var="{time}">
        <span class="var-icon">🕐</span>
        <span>שעה</span>
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">תבנית התזכורת</label>
      <textarea 
        id="reminderTemplateEditor" 
        class="template-editor" 
        rows="12"
        placeholder="הזן כאן את תבנית התזכורת..."
      ></textarea>
      <div class="template-hint">
        💡 לחיצה על הכפתורים למעלה תכניס את המשתנה במקום הסמן
      </div>
    </div>
  `;

  // Preview Content Container
  const previewContent = document.createElement("div");
  previewContent.className = "preview-content";
  previewContent.style.display = "none";
  previewContent.innerHTML = `
    <div class="section-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      תצוגה מקדימה
    </div>
    <div id="reminderPreview" class="template-preview">
      ${generatePreview(currentTemplate)}
    </div>
  `;

  // Preview Button
  const previewButtonContainer = document.createElement("div");
  previewButtonContainer.className = "preview-button-container";
  
  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "btn btn-preview";
  previewBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
    תצוגה מקדימה
  `;

  // Assemble editor section
  editorSection.appendChild(editorContent);
  editorSection.appendChild(previewContent);
  previewButtonContainer.appendChild(previewBtn);
  editorSection.appendChild(previewButtonContainer);

  const templateEditor = editorContent.querySelector("#reminderTemplateEditor");
  const previewDiv = previewContent.querySelector("#reminderPreview");
  templateEditor.value = currentTemplate;

  // Variable buttons
  const varButtons = editorContent.querySelectorAll(".template-var-btn");
  varButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const variable = btn.dataset.var;
      insertVariableAtCursor(templateEditor, variable);
      templateEditor.focus();
    });
  });

  // Update current template on input
  templateEditor.addEventListener("input", () => {
    currentTemplate = templateEditor.value;
  });

  // Toggle between edit and preview mode
  let isPreviewMode = false;
  previewBtn.addEventListener("click", () => {
    isPreviewMode = !isPreviewMode;
    if (isPreviewMode) {
      // Show preview, hide editor
      editorContent.style.display = "none";
      previewContent.style.display = "block";
      previewBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        חזור לעריכה
      `;
      updatePreview();
    } else {
      // Show editor, hide preview
      editorContent.style.display = "block";
      previewContent.style.display = "none";
      previewBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        תצוגה מקדימה
      `;
    }
  });

  function updatePreview() {
    previewDiv.innerHTML = generatePreview(currentTemplate);
  }

  // Actions
  const actionsSection = document.createElement("div");
  actionsSection.className = "reminder-settings-actions";
  
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-save";
  saveBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
    שמור תבנית
  `;

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-reset";
  resetBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="1 4 1 10 7 10"></polyline>
      <polyline points="23 20 23 14 17 14"></polyline>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
    </svg>
    איפוס לברירת מחדל
  `;

  // Load template from server
  async function loadTemplate() {
    try {
      const response = await fetch(`${API_URL}/api/settings/reminder-template`);
      if (response.ok) {
        const data = await response.json();
        if (data.template) {
          currentTemplate = data.template;
          templateEditor.value = currentTemplate;
          updatePreview();
        }
      }
    } catch (error) {
      console.error("Failed to load template:", error);
      // Use default template if load fails
      templateEditor.value = REMINDER_TEMPLATE;
      currentTemplate = REMINDER_TEMPLATE;
      updatePreview();
    }
  }

  // Save template to server
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const originalHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
      שומר...
    `;

    try {
      const response = await fetch(`${API_URL}/api/settings/reminder-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ template: currentTemplate }),
        credentials: "omit",
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error("Failed to save template");
      }

      // Clear cache so template will be reloaded on next use
      clearTemplateCache();
      
      toast.success("התבנית נשמרה בהצלחה");
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("שגיאה בשמירת התבנית");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHTML;
    }
  });

  // Reset to default
  resetBtn.addEventListener("click", () => {
    if (confirm("האם אתה בטוח שברצונך לאפס את התבנית לברירת מחדל?")) {
      currentTemplate = REMINDER_TEMPLATE;
      templateEditor.value = currentTemplate;
      updatePreview();
    }
  });

  actionsSection.appendChild(saveBtn);
  actionsSection.appendChild(resetBtn);

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(editorSection);
  panel.appendChild(actionsSection);

  // Close handlers
  function closePanel() {
    panel.classList.remove("open");
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
    }, 300);
  }

  header.querySelector(".close-reminder-settings-btn").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  // Escape key to close
  const escapeHandler = (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      closePanel();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);

  // Append to body
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  // Load template on open
  loadTemplate();

  // Open panel
  setTimeout(() => {
    overlay.style.display = "block";
    overlay.offsetHeight; // Force reflow
    overlay.style.opacity = "1";
    panel.classList.add("open");
    templateEditor.focus();
  }, 10);

  return panel;
}

/**
 * Inserts a variable at the cursor position in a textarea
 */
function insertVariableAtCursor(textarea, variable) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const newText = text.substring(0, start) + variable + text.substring(end);
  textarea.value = newText;
  
  // Set cursor position after inserted text
  const newCursorPos = start + variable.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  
  // Trigger input event to update preview
  textarea.dispatchEvent(new Event("input"));
}

/**
 * Generates preview text with sample values
 */
function generatePreview(template) {
  if (!template || template.trim() === "") {
    return '<span style="color: #999;">הזן תבנית כדי לראות תצוגה מקדימה...</span>';
  }

  const sampleValues = {
    day: "ראשון",
    time: "14:30"
  };

  let preview = template;
  preview = preview.replace(/\{day\}/g, `<span class="highlight">${sampleValues.day}</span>`);
  preview = preview.replace(/\{time\}/g, `<span class="highlight">${sampleValues.time}</span>`);

  // Escape HTML for display but preserve line breaks
  preview = preview
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  // Re-insert highlighted variables after escaping
  preview = preview
    .replace(/&lt;span class="highlight"&gt;([^&]+)&lt;\/span&gt;/g, '<span class="highlight">$1</span>');

  return preview || '<span style="color: #999;">הזן תבנית כדי לראות תצוגה מקדימה...</span>';
}

