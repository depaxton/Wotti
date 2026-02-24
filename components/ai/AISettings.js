/**
 * AI Settings Component
 * 
 * רכיב הגדרות AI - מאפשר ניהול כל ההגדרות הקשורות ל-Gemini AI
 */

import { toast } from '../toast/Toast.js';

const API_URL = window.location.hostname === "localhost" 
  ? "http://localhost:5000" 
  : `${window.location.protocol}//${window.location.hostname}:5000`;

/**
 * Creates the AI settings interface (sliding panel)
 */
export async function createAISettingsPanel() {
  // Get chat area
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) {
    console.error("Chat area not found");
    return;
  }

  // Clear chat area
  chatArea.innerHTML = "";

  // Panel
  const panel = document.createElement("div");
  panel.className = "ai-settings-panel ai-settings-panel-center";
  
  // Handle mobile navigation
  const { isMobile, showChatArea } = await import("../../utils/mobileNavigation.js");
  const isMobileDevice = isMobile();
  
  if (isMobileDevice) {
    panel.classList.add("active");
  }

  // State
  const state = {
    status: { configured: false, initialized: false },
    instructions: '',
    mode: 'manual',
    settings: null,
    activeUsers: []
  };

  // Header
  const header = document.createElement("div");
  header.className = "ai-settings-header";
  
  header.innerHTML = `
    ${isMobileDevice ? `
      <button type="button" class="panel-back-button" aria-label="חזור לאנשי קשר" title="חזור לאנשי קשר">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>חזרה</span>
      </button>
    ` : ''}
    <div class="panel-header-content">
      <h2>הגדרות AI</h2>
    </div>
    <button type="button" class="close-ai-settings-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  // Add back button handler for mobile
  if (isMobileDevice) {
    const backButton = header.querySelector('.panel-back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        closePanel();
      });
    }
  }

  // Content Container
  const content = document.createElement("div");
  content.className = "ai-settings-content";

  // Status Section - compact at top
  const statusSection = createStatusSection(state);
  content.appendChild(statusSection);

  // API Key Section (enter and save key)
  const apiKeySection = createApiKeySection(state);
  content.appendChild(apiKeySection);

  // Instructions Section
  const instructionsSection = createInstructionsSection(state);
  content.appendChild(instructionsSection);

  // Start conversation with contact (search + pick)
  const startConvSection = createStartConversationSection(state);
  content.appendChild(startConvSection);

  // Mode Section
  const modeSection = createModeSection(state);
  content.appendChild(modeSection);

  // Active Conversations Section
  const activeSection = createActiveConversationsSection(state);
  content.appendChild(activeSection);
  if (startConvSection._setActiveSectionRef) startConvSection._setActiveSectionRef(activeSection);

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(content);
  
  // On mobile, append to body for fixed positioning
  // On desktop, append to chat area
  if (isMobileDevice) {
    document.body.appendChild(panel);
    // Hide contacts sidebar
    showChatArea();
  } else {
    chatArea.appendChild(panel);
  }

  // Close button handler
  const closeBtn = header.querySelector(".close-ai-settings-btn");
  closeBtn.addEventListener("click", () => {
    closePanel();
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closePanel();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);

  // Load initial data
  loadData(state, apiKeySection, statusSection, instructionsSection, modeSection, startConvSection, activeSection);

  let refreshListsIntervalId = setInterval(async () => {
    try {
      const activeRes = await fetch(`${API_URL}/api/gemini/active-conversations`);
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        state.activeUsers = activeData.activeUsers || [];
        updateActiveUsersDisplay(activeSection, state.activeUsers, { state, startConvSection });
        if (startConvSection && startConvSection._renderFiltered) startConvSection._renderFiltered();
      }
    } catch (_) {}
  }, 4000);

  function closePanel() {
    if (refreshListsIntervalId) {
      clearInterval(refreshListsIntervalId);
      refreshListsIntervalId = null;
    }
    // On mobile, remove panel from body
    // On desktop, remove from chat area
    import("../../utils/mobileNavigation.js").then(({ isMobile, showContactsSidebar }) => {
      if (isMobile()) {
        // Remove panel from body
        if (panel && panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
        // Show contacts sidebar
        showContactsSidebar();
      } else {
        // Show placeholder instead
        const chatArea = document.querySelector(".chat-area");
        if (chatArea) {
          const chatPlaceholder = document.createElement("div");
          chatPlaceholder.className = "chat-placeholder";
          chatPlaceholder.id = "chatPlaceholder";
          chatPlaceholder.innerHTML = `
            <div class="placeholder-content">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h2>בחר איש קשר כדי להכניס תזכורות</h2>
              <p>התזכורות שלך יופיעו כאן</p>
            </div>
          `;
          chatArea.innerHTML = "";
          chatArea.appendChild(chatPlaceholder);
        }
        
        // Remove panel
        if (panel && panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
      }
    });
  }
}

/**
 * Create API key section - compact display with "Add Key" button that opens dialog
 * המפתח נשמר מקומית (config/gemini-config.json) ונטען בהפעלה הבאה.
 */
function createApiKeySection(state) {
  const section = document.createElement("div");
  section.className = "ai-settings-section ai-api-key-section-compact";
  section.innerHTML = `
    <div class="api-key-header-row">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
        </svg>
        מפתח API
      </div>
      <div class="api-key-actions-row">
        <span id="apiKeyStatusLabel" class="api-key-status-label">לא מוגדר</span>
        <button type="button" id="addApiKeyBtn" class="btn btn-primary btn-small">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          הוספת מפתח
        </button>
        <button type="button" id="deleteApiKeyBtn" class="btn btn-danger btn-small" style="display: none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          מחק
        </button>
      </div>
    </div>
    <!-- Hidden dialog for adding API key -->
    <div id="apiKeyDialog" class="api-key-dialog" style="display: none;">
      <div class="api-key-dialog-content">
        <div class="api-key-dialog-header">
          <span>הוספת מפתח API</span>
          <button type="button" id="closeApiKeyDialogBtn" class="api-key-dialog-close">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="aiApiKeyInput">מפתח API</label>
          <input 
            type="password" 
            id="aiApiKeyInput" 
            class="form-input api-key-input" 
            placeholder="הזן את מפתח ה-API שלך מ-Google AI Studio"
            autocomplete="off"
          />
          <div class="form-hint">
            💡 ניתן להשיג מפתח בחינם ב-<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>
          </div>
        </div>
        <button type="button" id="saveApiKeyBtn" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          שמור מפתח
        </button>
      </div>
    </div>
  `;

  const statusLabel = section.querySelector("#apiKeyStatusLabel");
  const addBtn = section.querySelector("#addApiKeyBtn");
  const deleteBtn = section.querySelector("#deleteApiKeyBtn");
  const dialog = section.querySelector("#apiKeyDialog");
  const closeDialogBtn = section.querySelector("#closeApiKeyDialogBtn");
  const input = section.querySelector("#aiApiKeyInput");
  const saveBtn = section.querySelector("#saveApiKeyBtn");

  function updateApiKeyUI(apiKey) {
    const hasKey = !!(apiKey && apiKey.trim());
    if (statusLabel) {
      statusLabel.textContent = hasKey ? 'מוגדר ✓' : 'לא מוגדר';
      statusLabel.className = `api-key-status-label ${hasKey ? 'api-key-configured' : ''}`;
    }
    if (deleteBtn) deleteBtn.style.display = hasKey ? 'inline-flex' : 'none';
    if (addBtn) addBtn.style.display = hasKey ? 'none' : 'inline-flex';
  }

  // Open dialog
  addBtn.addEventListener("click", () => {
    dialog.style.display = 'block';
    if (input) input.focus();
  });

  // Close dialog
  closeDialogBtn.addEventListener("click", () => {
    dialog.style.display = 'none';
    if (input) input.value = '';
  });

  saveBtn.addEventListener("click", async () => {
    const apiKey = (input && input.value) ? input.value.trim() : '';
    if (!apiKey) {
      toast.error('הזן מפתח API');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> שומר...`;

    try {
      const response = await fetch(`${API_URL}/api/gemini/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('מפתח ה-API נשמר בהצלחה');
        if (input) input.value = '';
        dialog.style.display = 'none';
        updateApiKeyUI(apiKey);
        const statusSectionEl = document.getElementById('aiStatusContainer')?.closest('.ai-settings-section');
        if (statusSectionEl) {
          const statusRes = await fetch(`${API_URL}/api/gemini/status`);
          if (statusRes.ok) updateStatusDisplay(statusSectionEl, await statusRes.json());
        }
      } else {
        toast.error(result.error || 'שגיאה בשמירה');
      }
    } catch (error) {
      toast.error(`שגיאה: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> שמור מפתח`;
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את מפתח ה-API?')) return;
    deleteBtn.disabled = true;
    try {
      const response = await fetch(`${API_URL}/api/gemini/api-key`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast.success('מפתח ה-API נמחק');
        updateApiKeyUI('');
        const statusSectionEl = document.getElementById('aiStatusContainer')?.closest('.ai-settings-section');
        if (statusSectionEl) {
          const statusRes = await fetch(`${API_URL}/api/gemini/status`);
          if (statusRes.ok) updateStatusDisplay(statusSectionEl, await statusRes.json());
        }
      } else {
        toast.error(result.error || 'שגיאה במחיקה');
      }
    } catch (error) {
      toast.error(`שגיאה: ${error.message}`);
    } finally {
      deleteBtn.disabled = false;
    }
  });

  section._updateApiKeyDisplay = updateApiKeyUI;
  return section;
}

/**
 * Create status section - compact inline version
 */
function createStatusSection(state) {
  const section = document.createElement("div");
  section.className = "ai-settings-section ai-status-section-compact";
  section.innerHTML = `
    <div id="aiStatusContainer" class="status-container-compact">
      <div class="status-item-compact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span class="status-label-compact">מצב:</span>
        <span id="aiStatusText" class="status-value status-value-compact">טוען...</span>
      </div>
      <div class="status-item-compact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
        </svg>
        <span class="status-label-compact">API:</span>
        <span id="aiApiKeyStatus" class="status-value status-value-compact">טוען...</span>
      </div>
    </div>
  `;
  return section;
}

/**
 * Create instructions section - collapsible with toggle button
 */
function createInstructionsSection(state) {
  const section = document.createElement("div");
  section.className = "ai-settings-section ai-collapsible-section";
  section.innerHTML = `
    <div class="collapsible-header">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        הוראות מערכת
      </div>
      <button type="button" id="toggleInstructionsBtn" class="btn btn-secondary btn-small collapsible-toggle">
        <svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        ערוך הוראות AI
      </button>
    </div>
    <div id="instructionsContent" class="collapsible-content" style="display: none;">
      <div class="form-group">
        <label class="form-label">הנחיות התנהגות ל-Gemini</label>
        <textarea 
          id="aiInstructionsEditor" 
          class="instructions-editor" 
          rows="10"
          placeholder="הזן כאן את ההוראות ל-Gemini..."
        ></textarea>
        <div class="form-hint">
          💡 ההוראות האלה יישלחו ל-Gemini בכל שיחה. השתמש בהן כדי להגדיר את אופן התנהגות ה-AI.
        </div>
      </div>
      <button type="button" id="saveInstructionsBtn" class="btn btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        שמור הוראות
      </button>
    </div>
  `;

  const toggleBtn = section.querySelector("#toggleInstructionsBtn");
  const contentDiv = section.querySelector("#instructionsContent");
  const saveBtn = section.querySelector("#saveInstructionsBtn");
  const editor = section.querySelector("#aiInstructionsEditor");

  let isOpen = false;

  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    contentDiv.style.display = isOpen ? 'block' : 'none';
    toggleBtn.innerHTML = isOpen 
      ? `<svg class="toggle-icon rotated" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> סגור הוראות AI`
      : `<svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> ערוך הוראות AI`;
  });

  saveBtn.addEventListener("click", async () => {
    const instructions = editor.value;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> שומר...`;

    try {
      const response = await fetch(`${API_URL}/api/gemini/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('ההוראות נשמרו בהצלחה');
        state.instructions = instructions;
      } else {
        toast.error(`שגיאה בשמירה: ${result.error}`);
      }
    } catch (error) {
      toast.error(`שגיאה בשמירה: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> שמור הוראות`;
    }
  });

  return section;
}

/**
 * Create mode section – with "עריכת מצב פעולה" toggle to show/hide content
 */
function createModeSection(state) {
  const section = document.createElement("div");
  section.className = "ai-settings-section ai-collapsible-section";
  section.innerHTML = `
    <div class="collapsible-header">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
        </svg>
        מצב פעולה
      </div>
      <button type="button" id="toggleModeEditBtn" class="btn btn-secondary btn-small collapsible-toggle">
        <svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        עריכת מצב פעולה
      </button>
    </div>
    <div id="modeSectionContent" class="collapsible-content" style="display: none;">
      <div class="mode-container">
        <div class="mode-option">
          <input type="radio" id="modeManual" name="aiMode" value="manual">
          <label for="modeManual">
            <strong>ידני</strong>
            <span class="mode-description">שיחות AI יופעלו רק ידנית</span>
          </label>
        </div>
        <div class="mode-option">
          <input type="radio" id="modeAuto" name="aiMode" value="auto">
          <label for="modeAuto">
            <strong>אוטומטי</strong>
            <span class="mode-description">המערכת תבחר אוטומטית צ'אטים ותתחיל שיחות</span>
          </label>
        </div>
      </div>
      <div id="modeStatus" class="mode-status"></div>
      <button type="button" id="saveModeBtn" class="btn btn-primary" style="margin-top: 15px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        שמור מצב
      </button>
      <div class="trigger-words-section">
        <div class="trigger-words-section-title">מילות טריגר (מצב אוטומטי בלבד)</div>
        <p class="trigger-words-hint">מילים מופרדות בפסיקים. במצב אוטומטי: מילות הפעלה מכניסות שיחה לפעילות, מילות יציאה מוציאות את ה-AI.</p>
        <div class="form-group">
          <label class="form-label" for="activationWordsInput">מילות הפעלה</label>
          <input type="text" id="activationWordsInput" class="form-input trigger-words-input" placeholder="למשל: תור, קביעה, רוצה לקבוע" autocomplete="off">
          <p class="form-hint">אם המשתמש שולח הודעה שמכילה אחת מהמילים, השיחה תכנס לשיחות פעילות</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="exitWordsFromUserInput">מילות יציאה (מהמשתמש)</label>
          <input type="text" id="exitWordsFromUserInput" class="form-input trigger-words-input" placeholder="למשל: מספיק, תפסיק, אדם" autocomplete="off">
          <p class="form-hint">אם המשתמש שולח אחת מהמילים ל-AI, ה-AI ייצא מהשיחה</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="exitWordsFromOperatorInput">מילות יציאה (מהמפעיל)</label>
          <input type="text" id="exitWordsFromOperatorInput" class="form-input trigger-words-input" placeholder="למשל: אני מטפל, העברה אלי" autocomplete="off">
          <p class="form-hint">אם אתה שולח הודעה ללקוח שמכילה אחת מהמילים, ה-AI ייצא מהשיחה</p>
        </div>
        <button type="button" id="saveTriggerWordsBtn" class="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          שמור מילות טריגר
        </button>
      </div>
    </div>
  `;

  const manualRadio = section.querySelector("#modeManual");
  const autoRadio = section.querySelector("#modeAuto");
  const saveBtn = section.querySelector("#saveModeBtn");
  const statusDiv = section.querySelector("#modeStatus");
  const toggleBtn = section.querySelector("#toggleModeEditBtn");
  const modeContent = section.querySelector("#modeSectionContent");

  let modeSectionOpen = false;
  toggleBtn.addEventListener("click", () => {
    modeSectionOpen = !modeSectionOpen;
    modeContent.style.display = modeSectionOpen ? "block" : "none";
    toggleBtn.innerHTML = modeSectionOpen
      ? `<svg class="toggle-icon rotated" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> סגור`
      : `<svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> עריכת מצב פעולה`;
  });

  saveBtn.addEventListener("click", async () => {
    const selectedMode = manualRadio.checked ? 'manual' : 'auto';
    if (selectedMode === state.mode) {
      toast.info('המצב כבר מוגדר כך');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> שומר...`;

    try {
      const endpoint = selectedMode === 'manual' ? '/api/gemini/mode/manual' : '/api/gemini/mode/auto';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      if (result.success) {
        state.mode = selectedMode;
        toast.success(`המצב שונה ל-${selectedMode === 'manual' ? 'ידני' : 'אוטומטי'}`);
        updateModeStatus(statusDiv, selectedMode, result);
      } else {
        toast.error(`שגיאה: ${result.error}`);
      }
    } catch (error) {
      toast.error(`שגיאה: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> שמור מצב`;
    }
  });

  const activationWordsInput = section.querySelector("#activationWordsInput");
  const exitWordsFromUserInput = section.querySelector("#exitWordsFromUserInput");
  const exitWordsFromOperatorInput = section.querySelector("#exitWordsFromOperatorInput");
  const saveTriggerWordsBtn = section.querySelector("#saveTriggerWordsBtn");

  if (saveTriggerWordsBtn) {
    saveTriggerWordsBtn.addEventListener("click", async () => {
      saveTriggerWordsBtn.disabled = true;
      try {
        const response = await fetch(`${API_URL}/api/gemini/settings/auto-mode-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activationWords: (activationWordsInput?.value ?? "").trim(),
            exitWordsFromUser: (exitWordsFromUserInput?.value ?? "").trim(),
            exitWordsFromOperator: (exitWordsFromOperatorInput?.value ?? "").trim(),
          }),
        });
        const result = await response.json();
        if (result.success) {
          toast.success("מילות הטריגר נשמרו");
          if (state.settings?.autoModeConfig) {
            state.settings.autoModeConfig.activationWords = activationWordsInput?.value ?? "";
            state.settings.autoModeConfig.exitWordsFromUser = exitWordsFromUserInput?.value ?? "";
            state.settings.autoModeConfig.exitWordsFromOperator = exitWordsFromOperatorInput?.value ?? "";
          }
        } else {
          toast.error(result.error || "שגיאה בשמירה");
        }
      } catch (err) {
        toast.error(err.message || "שגיאה בשמירה");
      } finally {
        saveTriggerWordsBtn.disabled = false;
      }
    });
  }

  section._fillTriggerWords = (settings) => {
    const cfg = settings?.autoModeConfig;
    const a = cfg?.activationWords;
    const u = cfg?.exitWordsFromUser;
    const o = cfg?.exitWordsFromOperator;
    if (activationWordsInput) activationWordsInput.value = typeof a === "string" ? a : (Array.isArray(a) ? a.join(", ") : "");
    if (exitWordsFromUserInput) exitWordsFromUserInput.value = typeof u === "string" ? u : (Array.isArray(u) ? u.join(", ") : "");
    if (exitWordsFromOperatorInput) exitWordsFromOperatorInput.value = typeof o === "string" ? o : (Array.isArray(o) ? o.join(", ") : "");
  };

  return section;
}

/**
 * Normalize contact to userId for WhatsApp (JID). Uses id if already JID, else builds from phone.
 */
function contactToUserId(contact) {
  const id = contact.id || '';
  if (id.includes('@')) return id; // already JID
  if (id.startsWith('json_') && contact.phone) {
    const digits = (contact.phone + '').replace(/\D/g, '');
    return digits ? digits + '@s.whatsapp.net' : id;
  }
  return id;
}

/**
 * Create "Start conversation with contact" section - collapsible with toggle button
 */
function createStartConversationSection(state) {
  const section = document.createElement("div");
  section.className = "ai-settings-section ai-collapsible-section";
  section.innerHTML = `
    <div class="collapsible-header">
      <div class="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          <path d="M17 2l4 4-4 4"></path>
          <path d="M3 11v2a4 4 0 0 0 4 4h12"></path>
        </svg>
        התחלת שיחה עם איש קשר
      </div>
      <button type="button" id="toggleStartConvBtn" class="btn btn-secondary btn-small collapsible-toggle">
        <svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        התחלת שיחה
      </button>
    </div>
    <div id="startConvContent" class="collapsible-content" style="display: none;">
      <div class="form-group">
        <input 
          type="text" 
          id="aiContactSearchInput" 
          class="form-input api-key-input" 
          placeholder="חפש לפי שם או מספר..."
          autocomplete="off"
        />
      </div>
      <div id="aiContactsListContainer" class="ai-contacts-list-container">
        <div class="loading-text">טוען אנשי קשר...</div>
      </div>
    </div>
  `;

  const toggleBtn = section.querySelector("#toggleStartConvBtn");
  const contentDiv = section.querySelector("#startConvContent");

  let isOpen = false;

  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    contentDiv.style.display = isOpen ? 'block' : 'none';
    toggleBtn.innerHTML = isOpen 
      ? `<svg class="toggle-icon rotated" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> סגור`
      : `<svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> התחלת שיחה`;
  });

  const searchInput = section.querySelector("#aiContactSearchInput");
  const listContainer = section.querySelector("#aiContactsListContainer");
  let contactsList = [];

  const renderFilteredContacts = () => {
    const rawKeyword = (searchInput && searchInput.value || '').trim();
    const keyword = rawKeyword.toLowerCase();
    const activeIds = (state.activeUsers || []).map(u => u.userId);
    const filtered = rawKeyword
      ? contactsList.filter(c => {
          const name = (c.name || '').toLowerCase();
          const phone = (c.phone || '').toString().replace(/\D/g, '');
          const phoneSearch = rawKeyword.replace(/\D/g, '');
          const words = keyword.split(/\s+/).filter(Boolean);
          const nameMatch = words.length
            ? words.every(w => name.includes(w))
            : true;
          const phoneMatch = phoneSearch && phone.includes(phoneSearch);
          return nameMatch || phoneMatch;
        })
      : contactsList;

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">לא נמצאו אנשי קשר</div>';
      return;
    }

    listContainer.innerHTML = filtered.map(contact => {
      const userId = contactToUserId(contact);
      const name = contact.name || contact.phone || userId;
      const phone = contact.phone || '';
      const isActive = activeIds.includes(userId);
      return `
        <div class="ai-contact-item ${isActive ? 'ai-contact-item-active' : ''}" data-user-id="${userId.replace(/"/g, '&quot;')}" data-name="${(name || '').replace(/"/g, '&quot;')}" data-phone="${(phone || '').replace(/"/g, '&quot;')}">
          <div class="ai-contact-item-info">
            <strong>${escapeHtml(name)}</strong>
            ${phone ? `<span class="ai-contact-item-phone">${escapeHtml(phone)}</span>` : ''}
          </div>
          <button type="button" class="btn btn-small btn-primary ai-start-conv-btn" ${isActive ? 'disabled' : ''}>
            ${isActive ? 'פעיל' : 'התחל שיחה'}
          </button>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.ai-contact-item').forEach(el => {
      if (el.classList.contains('ai-contact-item-active')) return;
      const btn = el.querySelector('.ai-start-conv-btn');
      const userId = el.dataset.userId;
      const userName = el.dataset.name || '';
      const userNumber = el.dataset.phone || '';
      const activeSectionRef = section._activeSectionRef;
      (btn || el).addEventListener('click', () => startConversationWithContact(state, userId, userName, userNumber, section, listContainer, activeSectionRef));
    });
  };

  section._activeSectionRef = null;
  section._setActiveSectionRef = (ref) => { section._activeSectionRef = ref; };
  section._contactsList = [];
  section._renderFiltered = renderFilteredContacts;
  section._setContacts = (list) => {
    contactsList = list;
    section._contactsList = list;
  };

  if (searchInput) {
    const onSearch = () => renderFilteredContacts();
    searchInput.addEventListener('input', onSearch);
    searchInput.addEventListener('keyup', onSearch);
  }

  return section;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadContactsForStartConversation(startConvSection, state) {
  const listContainer = startConvSection.querySelector("#aiContactsListContainer");
  if (!listContainer) return;

  let contacts = [];
  try {
    const res = await fetch(`${API_URL}/api/contacts`);
    if (res.ok) {
      const data = await res.json();
      contacts = data.contacts || [];
    }
  } catch (_) {}
  if (contacts.length === 0) {
    try {
      const resJson = await fetch(`${API_URL}/api/contacts/json`);
      if (resJson.ok) {
        const data = await resJson.json();
        contacts = (data.contacts || []).map(c => ({
          ...c,
          id: c.id || ('json_' + (c.phone || ''))
        }));
      }
    } catch (_) {}
  }

  startConvSection._setContacts(contacts);
  if (startConvSection._renderFiltered) startConvSection._renderFiltered();
}

async function startConversationWithContact(state, userId, userName, userNumber, startConvSection, listContainer, activeSection) {
  try {
    const response = await fetch(`${API_URL}/api/gemini/start-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName: userName || undefined, userNumber: userNumber || undefined })
    });
    const result = await response.json();
    if (result.success) {
      toast.success('השיחה התחילה. האיש קשר יופיע בשיחות פעילות.');
      const activeRes = await fetch(`${API_URL}/api/gemini/active-conversations`);
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        state.activeUsers = activeData.activeUsers || [];
        if (activeSection) updateActiveUsersDisplay(activeSection, state.activeUsers, { state, startConvSection });
      }
      if (startConvSection && startConvSection._renderFiltered) startConvSection._renderFiltered();
    } else {
      toast.error(result.error || 'לא ניתן להתחיל שיחה');
    }
  } catch (error) {
    toast.error('שגיאה: ' + error.message);
  }
}

/**
 * Create active conversations section
 */
function createActiveConversationsSection(state) {
  const section = document.createElement("div");
  section.className = "ai-settings-section";
  section.innerHTML = `
    <div class="section-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      שיחות פעילות
    </div>
    <div id="activeUsersContainer" class="users-container">
      <div class="loading-text">טוען...</div>
    </div>
  `;
  return section;
}

/**
 * Load all data
 */
async function loadData(state, apiKeySection, statusSection, instructionsSection, modeSection, startConvSection, activeSection) {
  try {
    // Load API key (exposed for display)
    try {
      const apiKeyRes = await fetch(`${API_URL}/api/gemini/api-key`);
      if (apiKeyRes.ok) {
        const apiKeyData = await apiKeyRes.json();
        const apiKey = apiKeyData.apiKey || '';
        if (apiKeySection && apiKeySection._updateApiKeyDisplay) {
          apiKeySection._updateApiKeyDisplay(apiKey);
        }
      }
    } catch (_) {}

    // Load status
    const statusRes = await fetch(`${API_URL}/api/gemini/status`);
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      state.status = statusData;
      updateStatusDisplay(statusSection, statusData);
    }

    // Load instructions
    const instructionsRes = await fetch(`${API_URL}/api/gemini/instructions`);
    if (instructionsRes.ok) {
      const instructionsData = await instructionsRes.json();
      state.instructions = instructionsData.instructions || '';
      const editor = instructionsSection.querySelector("#aiInstructionsEditor");
      if (editor) editor.value = state.instructions;
    }

    // Load mode and trigger words
    const modeRes = await fetch(`${API_URL}/api/gemini/mode`);
    if (modeRes.ok) {
      const modeData = await modeRes.json();
      state.mode = modeData.mode || 'manual';
      state.settings = modeData.settings;
      updateModeDisplay(modeSection, state.mode);
      if (modeSection._fillTriggerWords) modeSection._fillTriggerWords(state.settings);
    }

    // Load active users first (so contact list can show who is already active)
    const activeRes = await fetch(`${API_URL}/api/gemini/active-conversations`);
    if (activeRes.ok) {
      const activeData = await activeRes.json();
      state.activeUsers = activeData.activeUsers || [];
      updateActiveUsersDisplay(activeSection, state.activeUsers, { state, startConvSection });
    }

    // Load contacts for start-conversation
    if (startConvSection) {
      await loadContactsForStartConversation(startConvSection, state);
    }
  } catch (error) {
    console.error('Error loading AI data:', error);
    toast.error('שגיאה בטעינת נתונים');
  }
}

/**
 * Update status display
 */
function updateStatusDisplay(section, status) {
  const statusText = section.querySelector("#aiStatusText");
  const apiKeyStatus = section.querySelector("#aiApiKeyStatus");

  if (statusText) {
    statusText.textContent = status.configured && status.initialized ? 'מוכן' : 'לא מוכן';
    statusText.className = `status-value ${status.configured && status.initialized ? 'status-ok' : 'status-error'}`;
  }

  if (apiKeyStatus) {
    apiKeyStatus.textContent = status.configured ? 'מוגדר' : 'לא מוגדר';
    apiKeyStatus.className = `status-value ${status.configured ? 'status-ok' : 'status-error'}`;
  }
}

/**
 * Update mode display
 */
function updateModeDisplay(section, mode) {
  const manualRadio = section.querySelector("#modeManual");
  const autoRadio = section.querySelector("#modeAuto");
  const statusDiv = section.querySelector("#modeStatus");

  if (manualRadio) manualRadio.checked = mode === 'manual';
  if (autoRadio) autoRadio.checked = mode === 'auto';
  if (statusDiv) updateModeStatus(statusDiv, mode);
}

/**
 * Update mode status
 */
function updateModeStatus(statusDiv, mode, result = null) {
  if (!statusDiv) return;
  
  if (mode === 'auto') {
    statusDiv.innerHTML = `
      <div class="mode-status-info">
        ✅ מצב אוטומטי פעיל – כניסה ויציאה משיחות לפי מילות טריגר בלבד
      </div>
    `;
  } else if (mode === 'manual') {
    statusDiv.innerHTML = `
      <div class="mode-status-info">
        ℹ️ מצב ידני – שיחות יופעלו רק ידנית
      </div>
    `;
  } else {
    statusDiv.innerHTML = '';
  }
}

/**
 * Update active users display (with optional "הסר" to stop conversation)
 * options: { state, startConvSection } for refresh after remove
 */
function updateActiveUsersDisplay(section, activeUsers, options = {}) {
  const container = section.querySelector("#activeUsersContainer");
  if (!container) return;

  if (activeUsers.length === 0) {
    container.innerHTML = '<div class="empty-state">אין שיחות פעילות</div>';
    return;
  }

  const { state, startConvSection } = options;

  container.innerHTML = activeUsers.map(user => `
    <div class="user-item user-item-active">
      <div class="user-info">
        <strong>${escapeHtml(user.userName || user.userNumber || user.userId)}</strong>
        <span class="user-meta">${new Date(user.startedAt).toLocaleString('he-IL')}</span>
      </div>
      <button type="button" class="btn btn-small btn-danger ai-stop-conv-btn" data-user-id="${escapeHtml(user.userId)}">
        הסר
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.ai-stop-conv-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      if (!userId) return;
      btn.disabled = true;
      try {
        const response = await fetch(`${API_URL}/api/gemini/stop-conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const result = await response.json();
        if (result.success) {
          toast.success('השיחה הופסקה וה-AI לא יקרא עוד את הצ\'אט עם משתמש זה.');
          const activeRes = await fetch(`${API_URL}/api/gemini/active-conversations`);
          if (activeRes.ok) {
            const activeData = await activeRes.json();
            if (state) state.activeUsers = activeData.activeUsers || [];
            updateActiveUsersDisplay(section, state ? state.activeUsers : [], options);
          }
          if (startConvSection && startConvSection._renderFiltered) startConvSection._renderFiltered();
        } else {
          toast.error(result.error || 'שגיאה בהסרה');
          btn.disabled = false;
        }
      } catch (error) {
        toast.error('שגיאה: ' + error.message);
        btn.disabled = false;
      }
    });
  });
}

