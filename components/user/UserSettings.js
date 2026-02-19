import { DAYS_OF_WEEK } from "../../config/reminderTemplates.js";
import { toast } from "../toast/Toast.js";
import { formatIsraeliMobile } from "../../utils/phoneUtils.js";
import { formatDateHebrew, formatDateMonthDay, getNextDayOfWeekFromToday, getDayName, parseDateString, isPast, getNextDayOfWeek, getDayIndex, parseTime } from "../../utils/dateUtils.js";

export function createUserSettings(contact) {
  // Cleanup any existing panels from previous renders
  const existingPanels = document.querySelectorAll(".sliding-panel, .sliding-panel-overlay");
  existingPanels.forEach((p) => p.remove());

  const container = document.createElement("div");
  container.className = "user-settings-container";

  // API URL - same logic as in script.js
  const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;

  // --- State ---
  const state = {
    globalSettings: { defaultMeetingDuration: 45 },
    userReminders: [],
    newReminder: {
      day: "",
      date: null, // For specific date mode (YYYY-MM-DD format)
      dateMode: "day-of-week", // 'day-of-week' or 'specific-date'
      time: "",
      duration: 45, // will update when global settings load
      type: "one-time",
      preReminder: ["1h", "1d", "3d"], // Array of selected pre-reminders: 30m, 1h, 1d, 3d
    },
    allUsers: {}, // for schedule checking
  };

  // --- API Calls ---
  async function loadData() {
    try {
      // Validate contact phone
      if (!contact.phone) {
        console.error("Contact phone is missing");
        return;
      }

      // Load Global Settings to get default duration
      const settingsRes = await fetch(`${API_URL}/api/settings`);
      if (settingsRes.ok) {
        state.globalSettings = await settingsRes.json();
        state.newReminder.duration = state.globalSettings.defaultMeetingDuration || 45;
        updateDurationInput();
      }

      // Load User Reminders - encode phone number for URL
      const encodedPhone = encodeURIComponent(contact.phone);
      const remindersRes = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`);
      if (remindersRes.ok) {
        state.userReminders = await remindersRes.json();
        // Ensure all reminders have IDs (for backwards compatibility)
        state.userReminders.forEach((rem, index) => {
          if (!rem.id) {
            rem.id = `reminder-${Date.now()}-${index}`;
          }
        });
        renderRemindersList();
      } else {
        // If error, still set empty array to avoid UI issues
        state.userReminders = [];
        renderRemindersList();
      }

      // Load All Users for Schedule
      const usersRes = await fetch(`${API_URL}/api/users`);
      if (usersRes.ok) {
        state.allUsers = await usersRes.json();
      }
    } catch (error) {
      console.error("Failed to load data", error);
    }
  }

  // --- UI Components ---

  // Header
  const header = document.createElement("div");
  header.className = "user-header";
  header.innerHTML = `
    <div class="user-info" style="flex: 1;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <h2 id="userNameDisplay" style="margin: 0; flex: 1;">${contact.name}</h2>
        <button id="editNameBtn" type="button" style="background: transparent; border: none; cursor: pointer; padding: 5px; color: #128C7E; display: flex; align-items: center;" title="ערוך שם">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
      <div id="nameEditContainer" style="display: none; gap: 8px; align-items: center;">
        <input type="text" id="userNameInput" class="form-input" value="${contact.name}" style="flex: 1; margin: 0;">
        <button id="saveNameBtn" type="button" class="btn btn-primary" style="padding: 8px 16px; margin: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button id="cancelNameBtn" type="button" class="btn btn-secondary" style="padding: 8px 16px; margin: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <p style="margin: 5px 0 0;">${formatIsraeliMobile(contact.phone)}</p>
    </div>
  `;
  container.appendChild(header);

  // Name editing functionality
  const userNameDisplay = header.querySelector("#userNameDisplay");
  const editNameBtn = header.querySelector("#editNameBtn");
  const nameEditContainer = header.querySelector("#nameEditContainer");
  const userNameInput = header.querySelector("#userNameInput");
  const saveNameBtn = header.querySelector("#saveNameBtn");
  const cancelNameBtn = header.querySelector("#cancelNameBtn");

  editNameBtn.addEventListener("click", () => {
    userNameDisplay.style.display = "none";
    editNameBtn.style.display = "none";
    nameEditContainer.style.display = "flex";
    userNameInput.focus();
    userNameInput.select();
  });

  cancelNameBtn.addEventListener("click", () => {
    userNameInput.value = contact.name; // Reset to original
    nameEditContainer.style.display = "none";
    userNameDisplay.style.display = "block";
    editNameBtn.style.display = "flex";
  });

  saveNameBtn.addEventListener("click", async () => {
    const newName = userNameInput.value.trim();
    if (!newName) {
      toast.error("השם לא יכול להיות ריק");
      return;
    }

    if (newName === contact.name) {
      // No change, just cancel
      cancelNameBtn.click();
      return;
    }

    // Disable button during save
    saveNameBtn.disabled = true;
    const originalHTML = saveNameBtn.innerHTML;
    saveNameBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
    `;

    try {
      const encodedPhone = encodeURIComponent(contact.phone);
      const response = await fetch(`${API_URL}/api/users/${encodedPhone}/name`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name: newName }),
        credentials: "omit",
        cache: "no-cache",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const updatedUser = await response.json();
      
      // Update contact object
      contact.name = updatedUser.name;
      
      // Update display
      userNameDisplay.textContent = updatedUser.name;
      nameEditContainer.style.display = "none";
      userNameDisplay.style.display = "block";
      editNameBtn.style.display = "flex";

      // Dispatch event to notify other components
      window.dispatchEvent(
        new CustomEvent("userNameUpdated", {
          detail: { phone: contact.phone, name: updatedUser.name },
        })
      );

      toast.success("השם עודכן בהצלחה");
    } catch (error) {
      console.error("Failed to update user name", error);
      const errorMessage = error.message || "שגיאה לא ידועה";
      toast.error(`שגיאה בעדכון השם: ${errorMessage}`);
      saveNameBtn.innerHTML = originalHTML;
    } finally {
      saveNameBtn.disabled = false;
    }
  });

  // Allow Enter key to save
  userNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveNameBtn.click();
    } else if (e.key === "Escape") {
      cancelNameBtn.click();
    }
  });

  // Add Reminder Section
  const addReminderSection = document.createElement("div");
  addReminderSection.className = "settings-section";
  addReminderSection.innerHTML = `
    <div class="section-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      צור תזכורת חדשה
    </div>
    <div class="add-reminder-form">
      <div class="form-row">
        <div class="form-group" style="flex: 1;">
          <label class="form-label">יום</label>
          <input type="text" id="reminderDayInput" class="form-input day-selector-input" placeholder="לחץ לבחירת יום..." readonly>
        </div>
        <div class="form-group" style="flex: 1;">
          <label class="form-label">שעה</label>
          <input type="time" id="reminderTimeInput" class="form-input">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group" style="flex: 1;">
          <label class="form-label">משך (דקות)</label>
          <input type="number" id="reminderDurationInput" class="form-input" value="${state.newReminder.duration}" min="15" step="15">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">סוג תזכורת</label>
        <div class="type-selector" id="typeSelector">
          <div class="type-btn selected" data-value="one-time">חד פעמי</div>
          <div class="type-btn" data-value="recurring">קבוע</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">תזכורות מקדימות</label>
        <div class="checkbox-group">
          <label class="checkbox-option">
            <input type="checkbox" name="preReminder" value="30m"> חצי שעה לפני
          </label>
          <label class="checkbox-option">
            <input type="checkbox" name="preReminder" value="1h" checked> שעה לפני
          </label>
          <label class="checkbox-option">
            <input type="checkbox" name="preReminder" value="1d" checked> יום לפני
          </label>
          <label class="checkbox-option">
            <input type="checkbox" name="preReminder" value="3d" checked> 3 ימים לפני
          </label>
        </div>
      </div>

      <button id="saveReminderBtn" class="btn btn-primary" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        שמור תזכורת
      </button>
    </div>
  `;
  container.appendChild(addReminderSection);

  // Wire up Add Reminder Form
  const dayInput = addReminderSection.querySelector("#reminderDayInput");
  const timeInput = addReminderSection.querySelector("#reminderTimeInput");
  const durationInputRem = addReminderSection.querySelector("#reminderDurationInput");
  const typeBtns = addReminderSection.querySelectorAll(".type-btn");
  const preReminderCheckboxes = addReminderSection.querySelectorAll('input[name="preReminder"]');
  const saveBtn = addReminderSection.querySelector("#saveReminderBtn");

  // Set default time to current hour with 00 minutes
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:00`;
  timeInput.value = defaultTime;
  state.newReminder.time = defaultTime;

  // Update duration input value when loaded
  function updateDurationInput() {
    durationInputRem.value = state.newReminder.duration || 45;
  }

  // Update default duration when changed (save as new default)
  durationInputRem.addEventListener("change", async (e) => {
    const newVal = parseInt(e.target.value);
    if (newVal > 0) {
      state.newReminder.duration = newVal;
      // Save as new default
      try {
        await fetch(`${API_URL}/api/settings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ defaultMeetingDuration: newVal }),
          credentials: "omit",
          cache: "no-cache",
        });
        state.globalSettings.defaultMeetingDuration = newVal;
        console.log("Default duration updated to", newVal);
      } catch (error) {
        console.error("Failed to save default duration", error);
      }
    }
  });

  // Type Selector Logic
  typeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      typeBtns.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.newReminder.type = btn.dataset.value;
    });
  });

  // Pre-reminder Logic - Multiple checkboxes
  preReminderCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const checkedValues = Array.from(preReminderCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      state.newReminder.preReminder = checkedValues.length > 0 ? checkedValues : [];
    });
  });

  // Save Button Logic - Make sure to prevent any default behavior
  saveBtn.addEventListener("click", async (event) => {
    // CRITICAL: Prevent default button behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Return early if already processing
    if (saveBtn.disabled) {
      return;
    }

    // Disable button during save to prevent double-clicks
    saveBtn.disabled = true;

    // Validate contact phone
    if (!contact.phone) {
      toast.error("שגיאה: מספר טלפון חסר");
      console.error("Contact phone is missing when trying to save reminder");
      saveBtn.disabled = false;
      return;
    }

    // Get day or date based on mode
    if (state.newReminder.dateMode === "specific-date") {
      state.newReminder.date = specificDateInput.value;
      state.newReminder.day = undefined; // Don't include day when using specific date
    } else {
      state.newReminder.day = dayInput.value;
      state.newReminder.date = undefined; // Don't include date when using day of week
    }

    state.newReminder.time = timeInput.value;
    state.newReminder.duration = parseInt(durationInputRem.value);

    const hasValidDate = (state.newReminder.dateMode === "day-of-week" && state.newReminder.day) || (state.newReminder.dateMode === "specific-date" && state.newReminder.date);

    if (!hasValidDate || !state.newReminder.time) {
      toast.error("נא לבחור יום או תאריך ושעה");
      saveBtn.disabled = false;
      return;
    }

    // Validate that the reminder date/time is not in the past
    let reminderDateTime = null;

    if (state.newReminder.dateMode === "specific-date" && state.newReminder.date) {
      // For specific date: combine date + time
      const dateObj = parseDateString(state.newReminder.date);
      if (dateObj) {
        const timeParts = parseTime(state.newReminder.time);
        if (timeParts) {
          reminderDateTime = new Date(dateObj);
          reminderDateTime.setHours(timeParts[0], timeParts[1], 0, 0);
        }
      }
    } else if (state.newReminder.dateMode === "day-of-week" && state.newReminder.day) {
      // For day-of-week: get next occurrence and add time
      const dayIndex = getDayIndex(state.newReminder.day);
      if (dayIndex !== null) {
        const today = new Date();
        const nextDay = getNextDayOfWeek(today, dayIndex);
        const timeParts = parseTime(state.newReminder.time);
        if (timeParts) {
          reminderDateTime = new Date(nextDay);
          reminderDateTime.setHours(timeParts[0], timeParts[1], 0, 0);
        }
      }
    }

    // Check if the reminder date/time is in the past
    if (reminderDateTime && isPast(reminderDateTime, 0)) {
      toast.error("לא ניתן ליצור תזכורת על תאריך שעבר", 4000);
      saveBtn.disabled = false;
      return;
    }

    const editingId = saveBtn.dataset.editingId;
    let reminder;

    if (editingId) {
      // Update existing reminder
      const index = state.userReminders.findIndex((r) => r.id === editingId);
      if (index === -1) {
        toast.error("התזכורת לא נמצאה לעריכה");
        saveBtn.disabled = false;
        return;
      }

      reminder = {
        ...state.userReminders[index],
        ...state.newReminder,
      };
      state.userReminders[index] = reminder;
    } else {
      // Create new reminder – title as "פגישה - (contact name)" so calendar/display show who it's for
      const reminderTitle = contact.name ? `פגישה - ${contact.name}` : "פגישה";
      reminder = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...state.newReminder,
        title: reminderTitle,
      };
      state.userReminders.push(reminder);
    }

    // Render immediately with local data (optimistic update)
    renderRemindersList();

    // Save to backend - encode phone number for URL
    try {
      const encodedPhone = encodeURIComponent(contact.phone);
      const response = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ reminders: state.userReminders }),
        credentials: "omit", // Don't send cookies
        cache: "no-cache", // Prevent caching
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Ensure we're getting JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }

      // Reload reminders from server to ensure sync
      const savedReminders = await response.json();
      state.userReminders = savedReminders;

      // Force re-render with fresh data from server to show updated date/day
      renderRemindersList();

      // Dispatch custom event to notify other components
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", {
          detail: { phone: contact.phone, reminders: savedReminders },
        })
      );

      // Reload all users for schedule view
      try {
        const usersRes = await fetch(`${API_URL}/api/users`);
        if (usersRes.ok) {
          state.allUsers = await usersRes.json();
          // If panel is open, refresh the schedule based on mode
          if (slidingPanel.classList.contains("open")) {
            if (state.newReminder.dateMode === "day-of-week" && state.newReminder.day) {
              await renderDayMeetings(state.newReminder.day);
            } else if (state.newReminder.dateMode === "specific-date" && state.newReminder.date) {
              await renderDateMeetings(state.newReminder.date);
            }
          }
        }
      } catch (error) {
        console.error("Failed to reload users", error);
      }

      // Force another re-render after all data is loaded to ensure UI is updated with latest date/day info
      setTimeout(() => {
        renderRemindersList();
      }, 100);

      // Reset form
      dayInput.value = "";
      const now = new Date();
      const defaultTime = `${String(now.getHours()).padStart(2, "0")}:00`;
      timeInput.value = defaultTime;
      state.newReminder.day = "";
      state.newReminder.date = null;
      state.newReminder.dateMode = "day-of-week";
      state.newReminder.time = defaultTime;
      state.newReminder.preReminder = ["1h", "1d", "3d"];
      // Reset date mode selector
      dateModeBtns.forEach((b) => {
        if (b.dataset.mode === "day-of-week") {
          b.classList.add("selected");
        } else {
          b.classList.remove("selected");
        }
      });
      preReminderCheckboxes.forEach((cb) => {
        cb.checked = ["1h", "1d", "3d"].includes(cb.value);
      });

      // Reset edit mode
      delete saveBtn.dataset.editingId;
      saveBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        שמור תזכורת
      `;

      // Reset section title
      const sectionTitle = addReminderSection.querySelector(".section-title");
      sectionTitle.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        צור תזכורת חדשה
      `;

      toast.success(editingId ? "התזכורת עודכנה בהצלחה" : "התזכורת נשמרה בהצלחה");
    } catch (error) {
      console.error("Failed to save reminder", error);
      const errorMessage = error.message || "שגיאה לא ידועה";
      toast.error(`שגיאה בשמירת התזכורת: ${errorMessage}`);
      // Revert local state change on error - reload from server
      state.userReminders = await loadRemindersFromServer();
      renderRemindersList();
    } finally {
      // Re-enable button after save completes
      saveBtn.disabled = false;
    }
  });

  // Sliding Panel Logic
  const slidingPanel = document.createElement("div");
  slidingPanel.className = "sliding-panel";
  slidingPanel.innerHTML = `
    <div class="panel-header">
      <h3>בחר יום לפגישה</h3>
      <button type="button" class="close-panel-btn">&times;</button>
    </div>
    <div class="date-mode-selector" style="margin-bottom: 15px;">
      <div class="type-selector" id="dateModeSelector">
        <div class="type-btn selected" data-mode="day-of-week">יום בשבוע</div>
        <div class="type-btn" data-mode="specific-date">תאריך ספציפי</div>
      </div>
    </div>
    <div class="day-picker-buttons" style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 15px;">
      <!-- Day Buttons -->
    </div>
    <div class="date-picker-container" style="display: none; margin-bottom: 15px;">
      <input type="date" id="specificDateInput" class="form-input" style="width: 100%;">
    </div>
    <div class="panel-actions" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; display: none;">
      <button type="button" id="saveDayBtn" class="btn btn-primary" style="width: 100%;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        שמור
      </button>
    </div>
    <h4 id="panelScheduleTitle" style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; display: none;">לוח פגישות</h4>
    <div class="day-meetings-list" id="dayMeetingsList">
      <!-- Meetings go here -->
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.className = "sliding-panel-overlay";

  document.body.appendChild(overlay);
  document.body.appendChild(slidingPanel);

  // Generate Day Buttons in Panel
  const dayPickerContainer = slidingPanel.querySelector(".day-picker-buttons");
  const datePickerContainer = slidingPanel.querySelector(".date-picker-container");
  const specificDateInput = slidingPanel.querySelector("#specificDateInput");
  const dateModeSelector = slidingPanel.querySelector("#dateModeSelector");
  const dateModeBtns = slidingPanel.querySelectorAll("#dateModeSelector .type-btn");

  // Set date picker constraints
  const today = new Date();
  specificDateInput.min = today.toISOString().split("T")[0];
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 6);
  specificDateInput.max = maxDate.toISOString().split("T")[0];

  // Date Mode Selector Logic
  dateModeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      dateModeBtns.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const mode = btn.dataset.mode;
      state.newReminder.dateMode = mode;

      if (mode === "day-of-week") {
        dayPickerContainer.style.display = "flex";
        datePickerContainer.style.display = "none";
        // Clear date when switching to day mode
        state.newReminder.date = null;
        specificDateInput.value = "";
      } else {
        dayPickerContainer.style.display = "none";
        datePickerContainer.style.display = "block";
        // Clear day when switching to date mode
        state.newReminder.day = "";
        // Clear schedule display
        slidingPanel.querySelector("#panelScheduleTitle").style.display = "none";
        slidingPanel.querySelector(".panel-actions").style.display = "none";
      }
    });
  });

  // Date Picker Change Handler
  specificDateInput.addEventListener("change", async (e) => {
    state.newReminder.date = e.target.value;
    state.newReminder.day = ""; // Clear day when selecting date

    // Update dayInput display
    if (state.newReminder.date) {
      dayInput.value = formatDateHebrew(state.newReminder.date);

      // Show Schedule and Save Button
      slidingPanel.querySelector("#panelScheduleTitle").style.display = "block";
      slidingPanel.querySelector(".panel-actions").style.display = "block";

      // Render meetings for this specific date
      await renderDateMeetings(state.newReminder.date);
    } else {
      // Hide schedule if date is cleared
      slidingPanel.querySelector("#panelScheduleTitle").style.display = "none";
      slidingPanel.querySelector(".panel-actions").style.display = "none";
    }
  });

  DAYS_OF_WEEK.forEach((d) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary";
    btn.style.padding = "5px 10px";
    btn.style.fontSize = "0.85rem";
    btn.textContent = d.label;
    btn.onclick = () => selectDayInPanel(d.label, btn);
    dayPickerContainer.appendChild(btn);
  });

  async function selectDayInPanel(dayName, btnElement) {
    // Highlight button
    const buttons = dayPickerContainer.querySelectorAll("button");
    buttons.forEach((b) => {
      b.classList.remove("btn-primary");
      b.classList.add("btn-secondary");
    });
    btnElement.classList.remove("btn-secondary");
    btnElement.classList.add("btn-primary");

    // Update State & UI
    state.newReminder.day = dayName;
    state.newReminder.date = null; // Clear date when selecting day
    dayInput.value = dayName;

    // Show Schedule and Save Button
    slidingPanel.querySelector("#panelScheduleTitle").style.display = "block";
    slidingPanel.querySelector(".panel-actions").style.display = "block";
    await renderDayMeetings(dayName);
  }

  // Open Panel on Input Click
  dayInput.addEventListener("click", () => {
    openPanel();
  });

  async function openPanel() {
    overlay.style.display = "block";
    // Trigger reflow
    overlay.offsetHeight;
    overlay.style.opacity = "1";
    slidingPanel.classList.add("open");

    // Set initial mode display
    if (state.newReminder.dateMode === "specific-date") {
      dayPickerContainer.style.display = "none";
      datePickerContainer.style.display = "block";
      // Set date mode button as selected
      dateModeBtns.forEach((b) => {
        if (b.dataset.mode === "specific-date") {
          b.classList.add("selected");
        } else {
          b.classList.remove("selected");
        }
      });
      // If date already selected, show save button and meetings list
      if (state.newReminder.date) {
        slidingPanel.querySelector(".panel-actions").style.display = "block";
        specificDateInput.value = state.newReminder.date;
        // Show schedule and load meetings for this date
        slidingPanel.querySelector("#panelScheduleTitle").style.display = "block";
        await renderDateMeetings(state.newReminder.date);
      } else {
        slidingPanel.querySelector(".panel-actions").style.display = "none";
        slidingPanel.querySelector("#panelScheduleTitle").style.display = "none";
      }
    } else {
      dayPickerContainer.style.display = "flex";
      datePickerContainer.style.display = "none";
      // Set day mode button as selected
      dateModeBtns.forEach((b) => {
        if (b.dataset.mode === "day-of-week") {
          b.classList.add("selected");
        } else {
          b.classList.remove("selected");
        }
      });
      // Hide save button initially
      slidingPanel.querySelector(".panel-actions").style.display = "none";
      // If day already selected, highlight it
      if (state.newReminder.day) {
        const buttons = dayPickerContainer.querySelectorAll("button");
        buttons.forEach((b) => {
          if (b.textContent === state.newReminder.day) {
            b.click(); // Simulate click to load schedule
          }
        });
      }
    }
  }

  function closePanel() {
    slidingPanel.classList.remove("open");
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
    }, 300);
  }

  slidingPanel.querySelector(".close-panel-btn").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  // Save Day Button
  const saveDayBtn = slidingPanel.querySelector("#saveDayBtn");
  saveDayBtn.addEventListener("click", () => {
    if (state.newReminder.dateMode === "specific-date" && state.newReminder.date) {
      // Date is selected, update dayInput display and close panel
      dayInput.value = formatDateHebrew(state.newReminder.date);
      closePanel();
    } else if (state.newReminder.day) {
      // Day is already selected and saved in state, just close the panel
      closePanel();
    }
  });

  async function renderDayMeetings(dayName) {
    const list = slidingPanel.querySelector("#dayMeetingsList");
    list.innerHTML = '<p style="text-align:center; color:#999;">טוען...</p>';

    // Reload data to ensure we have the latest reminders
    try {
      // Reload all users with reminders
      const usersRes = await fetch(`${API_URL}/api/users`);
      if (usersRes.ok) {
        state.allUsers = await usersRes.json();
      }

      // Reload current user's reminders
      if (contact.phone) {
        const encodedPhone = encodeURIComponent(contact.phone);
        const remindersRes = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`);
        if (remindersRes.ok) {
          state.userReminders = await remindersRes.json();
          // Ensure all reminders have IDs (for backwards compatibility)
          state.userReminders.forEach((rem, index) => {
            if (!rem.id) {
              rem.id = `reminder-${Date.now()}-${index}`;
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to reload data for day meetings", error);
    }

    list.innerHTML = "";

    // Filter meetings from all users for this day
    const meetings = [];
    const seenReminderIds = new Set(); // To avoid duplicates

    // First, add reminders from all users
    Object.values(state.allUsers).forEach((user) => {
      if (user.reminders && Array.isArray(user.reminders)) {
        user.reminders.forEach((r) => {
          // Check both day and date (for backward compatibility)
          const matchesDay = r.day === dayName;
          let matchesDate = false;

          // If reminder has a date, check if it matches the day of week
          if (r.date && !r.day) {
            const dateObj = parseDateString(r.date);
            if (dateObj) {
              const reminderDayName = getDayName(dateObj.getDay());
              matchesDate = reminderDayName === dayName;
            }
          }

          if ((matchesDay || matchesDate) && !seenReminderIds.has(r.id)) {
            seenReminderIds.add(r.id);
            meetings.push({
              id: r.id,
              time: r.time,
              duration: r.duration,
              userName: user.name || user.phone || "לא ידוע",
              type: r.type,
              phone: user.phone || Object.keys(state.allUsers).find((key) => state.allUsers[key] === user),
              reminder: r,
            });
          }
        });
      }
    });

    // Also include current user's reminders (avoid duplicates)
    state.userReminders.forEach((r) => {
      // Check both day and date (for backward compatibility)
      const matchesDay = r.day === dayName;
      let matchesDate = false;

      // If reminder has a date, check if it matches the day of week
      if (r.date && !r.day) {
        const dateObj = parseDateString(r.date);
        if (dateObj) {
          const reminderDayName = getDayName(dateObj.getDay());
          matchesDate = reminderDayName === dayName;
        }
      }

      if ((matchesDay || matchesDate) && !seenReminderIds.has(r.id)) {
        seenReminderIds.add(r.id);
        meetings.push({
          id: r.id,
          time: r.time,
          duration: r.duration,
          userName: contact.name,
          type: r.type,
          phone: contact.phone,
          reminder: r,
        });
      }
    });

    // Sort by time
    meetings.sort((a, b) => a.time.localeCompare(b.time));

    if (meetings.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:#999;">אין פגישות ביום זה</p>';
      return;
    }

    meetings.forEach((m) => {
      const item = document.createElement("div");
      item.className = "day-meeting-item";

      // Only make clickable if it's the current user's reminder
      if (m.phone === contact.phone) {
        item.style.cursor = "pointer";
        item.style.transition = "background-color 0.2s";
        item.addEventListener("click", () => {
          closePanel();
          editReminder(m.id);
        });
        item.addEventListener("mouseenter", () => {
          item.style.backgroundColor = "#f0f0f0";
        });
        item.addEventListener("mouseleave", () => {
          item.style.backgroundColor = "";
        });
      }

      item.innerHTML = `
        <div class="day-meeting-time">${m.time} (${m.duration} דק')</div>
        <div class="day-meeting-user">${m.userName}${m.phone === contact.phone ? ' <span style="color: #999; font-size: 0.85em;">(לחץ לעריכה)</span>' : ""}</div>
      `;
      list.appendChild(item);
    });
  }

  async function renderDateMeetings(dateStr) {
    const list = slidingPanel.querySelector("#dayMeetingsList");
    list.innerHTML = '<p style="text-align:center; color:#999;">טוען...</p>';

    // Reload data to ensure we have the latest reminders
    try {
      // Reload all users with reminders
      const usersRes = await fetch(`${API_URL}/api/users`);
      if (usersRes.ok) {
        state.allUsers = await usersRes.json();
      }

      // Reload current user's reminders
      if (contact.phone) {
        const encodedPhone = encodeURIComponent(contact.phone);
        const remindersRes = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`);
        if (remindersRes.ok) {
          state.userReminders = await remindersRes.json();
          // Ensure all reminders have IDs (for backwards compatibility)
          state.userReminders.forEach((rem, index) => {
            if (!rem.id) {
              rem.id = `reminder-${Date.now()}-${index}`;
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to reload data for date meetings", error);
    }

    list.innerHTML = "";

    // Filter meetings from all users for this specific date
    const meetings = [];
    const seenReminderIds = new Set(); // To avoid duplicates

    // First, add reminders from all users
    Object.values(state.allUsers).forEach((user) => {
      if (user.reminders && Array.isArray(user.reminders)) {
        user.reminders.forEach((r) => {
          // Check if reminder matches the specific date
          const matchesDate = r.date === dateStr;

          if (matchesDate && !seenReminderIds.has(r.id)) {
            seenReminderIds.add(r.id);
            meetings.push({
              id: r.id,
              time: r.time,
              duration: r.duration,
              userName: user.name || user.phone || "לא ידוע",
              type: r.type,
              phone: user.phone || Object.keys(state.allUsers).find((key) => state.allUsers[key] === user),
              reminder: r,
            });
          }
        });
      }
    });

    // Also include current user's reminders (avoid duplicates)
    state.userReminders.forEach((r) => {
      // Check if reminder matches the specific date
      const matchesDate = r.date === dateStr;

      if (matchesDate && !seenReminderIds.has(r.id)) {
        seenReminderIds.add(r.id);
        meetings.push({
          id: r.id,
          time: r.time,
          duration: r.duration,
          userName: contact.name,
          type: r.type,
          phone: contact.phone,
          reminder: r,
        });
      }
    });

    // Sort by time
    meetings.sort((a, b) => a.time.localeCompare(b.time));

    if (meetings.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:#999;">אין פגישות בתאריך זה</p>';
      return;
    }

    meetings.forEach((m) => {
      const item = document.createElement("div");
      item.className = "day-meeting-item";

      // Only make clickable if it's the current user's reminder
      if (m.phone === contact.phone) {
        item.style.cursor = "pointer";
        item.style.transition = "background-color 0.2s";
        item.addEventListener("click", () => {
          closePanel();
          editReminder(m.id);
        });
        item.addEventListener("mouseenter", () => {
          item.style.backgroundColor = "#f0f0f0";
        });
        item.addEventListener("mouseleave", () => {
          item.style.backgroundColor = "";
        });
      }

      item.innerHTML = `
        <div class="day-meeting-time">${m.time} (${m.duration} דק')</div>
        <div class="day-meeting-user">${m.userName}${m.phone === contact.phone ? ' <span style="color: #999; font-size: 0.85em;">(לחץ לעריכה)</span>' : ""}</div>
      `;
      list.appendChild(item);
    });
  }

  // Reminders List Section
  const remindersListSection = document.createElement("div");
  remindersListSection.className = "settings-section";
  remindersListSection.innerHTML = `
    <div class="section-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M3 10h18"></path></svg>
      רשימת תזכורות
    </div>
    <div class="reminders-list" id="remindersList">
      <!-- Reminders will be rendered here -->
    </div>
  `;
  container.appendChild(remindersListSection);

  // Edit Reminder Function
  async function editReminder(reminderId) {
    // Find reminder
    const reminder = state.userReminders.find((r) => r.id === reminderId);
    if (!reminder) {
      toast.error("התזכורת לא נמצאה");
      return;
    }

    // Populate form with reminder data
    // Check if reminder has date (new format) or day (old format)
    if (reminder.date) {
      // New format: specific date
      state.newReminder.date = reminder.date;
      state.newReminder.dateMode = "specific-date";
      dayInput.value = formatDateHebrew(reminder.date);
      state.newReminder.day = "";
      // Update date mode selector
      dateModeBtns.forEach((b) => {
        if (b.dataset.mode === "specific-date") {
          b.classList.add("selected");
        } else {
          b.classList.remove("selected");
        }
      });
    } else {
      // Old format: day of week
      dayInput.value = reminder.day;
      state.newReminder.day = reminder.day;
      state.newReminder.date = null;
      state.newReminder.dateMode = "day-of-week";
      // Update date mode selector
      dateModeBtns.forEach((b) => {
        if (b.dataset.mode === "day-of-week") {
          b.classList.add("selected");
        } else {
          b.classList.remove("selected");
        }
      });
    }
    timeInput.value = reminder.time;
    state.newReminder.time = reminder.time;
    durationInputRem.value = reminder.duration;
    state.newReminder.duration = reminder.duration;

    // Set type
    typeBtns.forEach((btn) => {
      if (btn.dataset.value === reminder.type) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
    state.newReminder.type = reminder.type;

    // Set pre-reminders
    const preReminders = Array.isArray(reminder.preReminder) ? reminder.preReminder : reminder.preReminder ? [reminder.preReminder] : [];
    state.newReminder.preReminder = preReminders;
    preReminderCheckboxes.forEach((cb) => {
      cb.checked = preReminders.includes(cb.value);
    });

    // Store the reminder ID for update
    saveBtn.dataset.editingId = reminderId;
    saveBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      עדכן תזכורת
    `;

    // Update section title
    const sectionTitle = addReminderSection.querySelector(".section-title");
    sectionTitle.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      ערוך תזכורת
    `;

    // Scroll to form
    addReminderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Delete Reminder Function
  async function deleteReminder(reminderId) {
    // Confirm deletion
    if (!confirm("האם אתה בטוח שברצונך למחוק את התזכורת?")) {
      return;
    }

    // Find reminder index
    const index = state.userReminders.findIndex((r) => r.id === reminderId);
    if (index === -1) {
      toast.error("התזכורת לא נמצאה");
      return;
    }

    // Remove from local state
    state.userReminders.splice(index, 1);
    renderRemindersList();

    // Save to backend
    try {
      const encodedPhone = encodeURIComponent(contact.phone);
      const response = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ reminders: state.userReminders }),
        credentials: "omit",
        cache: "no-cache",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Reload reminders from server to ensure sync
      const savedReminders = await response.json();
      state.userReminders = savedReminders;

      // Force re-render with fresh data from server to show updated date/day
      renderRemindersList();

      // Dispatch custom event to notify other components
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", {
          detail: { phone: contact.phone, reminders: savedReminders },
        })
      );

      // Reload all users for schedule view
      try {
        const usersRes = await fetch(`${API_URL}/api/users`);
        if (usersRes.ok) {
          state.allUsers = await usersRes.json();
          // If panel is open, refresh the schedule based on mode
          if (slidingPanel.classList.contains("open")) {
            if (state.newReminder.dateMode === "day-of-week" && state.newReminder.day) {
              await renderDayMeetings(state.newReminder.day);
            } else if (state.newReminder.dateMode === "specific-date" && state.newReminder.date) {
              await renderDateMeetings(state.newReminder.date);
            }
          }
        }
      } catch (error) {
        console.error("Failed to reload users", error);
      }

      toast.success("התזכורת נמחקה בהצלחה");
    } catch (error) {
      console.error("Failed to delete reminder", error);
      const errorMessage = error.message || "שגיאה לא ידועה";
      toast.error(`שגיאה במחיקת התזכורת: ${errorMessage}`);
      // Revert local state change on error
      state.userReminders = await loadRemindersFromServer();
      renderRemindersList();
    }
  }

  // Helper function to reload reminders from server
  async function loadRemindersFromServer() {
    try {
      const encodedPhone = encodeURIComponent(contact.phone);
      const remindersRes = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`);
      if (remindersRes.ok) {
        return await remindersRes.json();
      }
    } catch (error) {
      console.error("Failed to reload reminders", error);
    }
    return [];
  }

  function renderRemindersList() {
    const list = remindersListSection.querySelector("#remindersList");
    list.innerHTML = "";

    if (state.userReminders.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:#999;">אין תזכורות למשתמש זה</p>';
      return;
    }

    // Sort reminders: recurring first, then one-time, both newest to oldest
    const sortedReminders = [...state.userReminders].sort((a, b) => {
      // First, separate by type: recurring first
      if (a.type === "recurring" && b.type !== "recurring") {
        return -1;
      }
      if (a.type !== "recurring" && b.type === "recurring") {
        return 1;
      }
      // Both same type, sort by createdAt (newest first)
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated; // Descending order (newest first)
    });

    sortedReminders.forEach((rem) => {
      const el = document.createElement("div");
      // Add class based on type for styling (one-time or recurring)
      el.className = `reminder-item ${rem.type === "recurring" ? "recurring" : "one-time"}`;

      // Note: Removed click handler from entire element, now only edit button triggers edit

      // Handle both old format (string) and new format (array)
      const preReminders = Array.isArray(rem.preReminder) ? rem.preReminder : rem.preReminder ? [rem.preReminder] : [];
      const preRemLabels =
        preReminders.length > 0
          ? preReminders
              .map((pr) => {
                if (pr === "30m") return "חצי שעה לפני";
                if (pr === "1h") return "שעה לפני";
                if (pr === "1d") return "יום לפני";
                if (pr === "3d") return "3 ימים לפני";
                return pr;
              })
              .join(", ")
          : "ללא תזכורות מקדימות";

      const reminderTypeLabel = rem.type === "recurring" ? "קבוע" : "חד פעמי";
      const reminderTypeClass = rem.type === "recurring" ? "recurring" : "one-time";

      // Format reminder day/date display
      let dayDisplay = "";
      if (rem.date) {
        // Specific date: show day of week + month/day
        const dateObj = parseDateString(rem.date);
        if (dateObj) {
          const dayName = getDayName(dateObj.getDay());
          const monthDay = formatDateMonthDay(rem.date);
          dayDisplay = `יום ${dayName}, ${monthDay}`;
        } else {
          dayDisplay = formatDateHebrew(rem.date);
        }
      } else if (rem.day) {
        // Day of week: show day name + next occurrence date
        const nextDate = getNextDayOfWeekFromToday(rem.day);
        if (nextDate) {
          const monthDay = formatDateMonthDay(nextDate);
          dayDisplay = `יום ${rem.day}, ${monthDay}`;
        } else {
          dayDisplay = `יום ${rem.day}`;
        }
      }

      el.innerHTML = `
        <div class="reminder-row">
          <div class="reminder-main-info">
            <span class="reminder-time">${rem.time}</span>
            <span class="reminder-day">${dayDisplay}</span>
          </div>
          <button class="delete-reminder-btn" data-reminder-id="${rem.id}" type="button" title="מחק תזכורת">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
        <div class="reminder-details">
          <span class="reminder-tag">${rem.duration} דקות</span>
          <span class="reminder-tag type-tag ${reminderTypeClass}">${reminderTypeLabel}</span>
          <span class="reminder-tag">תזכורות: ${preRemLabels}</span>
        </div>
        <div class="reminder-actions-row">
          <button class="edit-reminder-btn" data-reminder-id="${rem.id}" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>עריכה</span>
          </button>
          <button class="send-reminder-btn" data-reminder-id="${rem.id}" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>שליחת הודעה ידנית</span>
          </button>
          <div class="reminder-sent-indicator" data-reminder-id="${rem.id}" style="display: none;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>נשלח בהצלחה</span>
          </div>
        </div>
      `;

      // Add edit button handler
      const editBtn = el.querySelector(".edit-reminder-btn");
      editBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        editReminder(rem.id);
      });

      // Add send button handler
      const sendBtn = el.querySelector(".send-reminder-btn");
      sendBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await sendReminderManually(rem);
      });

      // Add delete button handler
      const deleteBtn = el.querySelector(".delete-reminder-btn");
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteReminder(rem.id);
      });

      list.appendChild(el);
    });
  }

  // Send reminder manually function
  async function sendReminderManually(reminder) {
    const sendBtn = document.querySelector(`.send-reminder-btn[data-reminder-id="${reminder.id}"]`);
    if (!sendBtn || sendBtn.disabled) return;

    try {
      sendBtn.disabled = true;
      const originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        <span>שולח...</span>
      `;

      const encodedPhone = encodeURIComponent(contact.phone);
      const response = await fetch(`${API_URL}/api/users/${encodedPhone}/send-reminder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ reminderId: reminder.id }),
        credentials: "omit",
        cache: "no-cache",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Show success toast and restore button
      toast.success("התזכורת נשלחה בהצלחה");
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalHTML;
    } catch (error) {
      console.error("Failed to send reminder", error);
      toast.error(`שגיאה בשליחת התזכורת: ${error.message}`);

      // Restore button on error
      sendBtn.disabled = false;
      sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>שליחת הודעה ידנית</span>
      `;
    }
  }

  // Initial Load
  loadData();

  // Listen for reminder updates from other components
  const reminderUpdateHandler = async (event) => {
    const { phone, reminders } = event.detail;

    // If this is the current user, reload data
    if (phone === contact.phone) {
      // Reload reminders
      state.userReminders = reminders;
      renderRemindersList();

      // Reload all users for schedule
      try {
        const usersRes = await fetch(`${API_URL}/api/users`);
        if (usersRes.ok) {
          state.allUsers = await usersRes.json();
          // If panel is open, refresh the schedule based on mode
          if (slidingPanel.classList.contains("open")) {
            if (state.newReminder.dateMode === "day-of-week" && state.newReminder.day) {
              await renderDayMeetings(state.newReminder.day);
            } else if (state.newReminder.dateMode === "specific-date" && state.newReminder.date) {
              await renderDateMeetings(state.newReminder.date);
            }
          }
        }
      } catch (error) {
        console.error("Failed to reload users", error);
      }
    } else {
      // Another user's reminders were updated, reload all users for schedule
      try {
        const usersRes = await fetch(`${API_URL}/api/users`);
        if (usersRes.ok) {
          state.allUsers = await usersRes.json();
          // If panel is open, refresh the schedule based on mode
          if (slidingPanel.classList.contains("open")) {
            if (state.newReminder.dateMode === "day-of-week" && state.newReminder.day) {
              await renderDayMeetings(state.newReminder.day);
            } else if (state.newReminder.dateMode === "specific-date" && state.newReminder.date) {
              await renderDateMeetings(state.newReminder.date);
            }
          }
        }
      } catch (error) {
        console.error("Failed to reload users", error);
      }
    }
  };

  window.addEventListener("remindersUpdated", reminderUpdateHandler);

  // Cleanup event listener when component is removed
  // Note: This is a simple cleanup - in a more complex app, you might want to track and remove listeners properly
  const originalReturn = container;
  container.addEventListener("DOMNodeRemoved", () => {
    window.removeEventListener("remindersUpdated", reminderUpdateHandler);
  });

  return container;
}
