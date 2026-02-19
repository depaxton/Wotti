import { REMINDER_TEMPLATE, DAYS_OF_WEEK } from '../../config/reminderTemplates.js';
import { toast } from '../toast/Toast.js';
import { formatDateHebrew, formatDateMonthDay, getNextDayOfWeekFromToday, getDayName, parseDateString, parseTime, getDayIndex, getNextDayOfWeek, isPast, formatDateString } from '../../utils/dateUtils.js';

export async function createReminderInterface(contact) {
  const container = document.createElement('div');
  container.className = 'reminder-container';

  // State
  let state = {
    dateMode: 'day-of-week', // 'day-of-week' or 'specific-date'
    selectedDay: null,
    selectedDate: null,
    selectedTime: '',
    reminderType: 'one-time',
    preReminder: ['1h', '1d', '3d'], // Array of selected pre-reminders: 30m, 1h, 1d, 3d
    userReminders: [] // Store user's reminders
  };

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'reminder-header';
  
  // Check if mobile to add back button
  const { isMobile, showContactsSidebar } = await import('../../utils/mobileNavigation.js');
  const isMobileDevice = isMobile();
  
  header.innerHTML = `
    ${isMobileDevice ? `
      <button type="button" class="reminder-back-button" aria-label="חזור לאנשי קשר" title="חזור לאנשי קשר">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>חזרה</span>
      </button>
    ` : ''}
    <div class="reminder-header-content">
      <h2>תזכורת חדשה</h2>
      <p>יצירת תזכורת עבור <strong>${contact.name}</strong></p>
    </div>
  `;
  container.appendChild(header);
  
  // Add back button handler for mobile
  if (isMobileDevice) {
    const backButton = header.querySelector('.reminder-back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        const chatArea = document.querySelector('.chat-area');
        if (chatArea) {
          // Clear chat area and show placeholder
          chatArea.innerHTML = `
            <div class="chat-placeholder" id="chatPlaceholder">
              <div class="placeholder-content">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h2>בחר איש קשר כדי להכניס תזכורות</h2>
                <p>התזכורות שלך יופיעו כאן</p>
              </div>
            </div>
          `;
          // Hide chat area and show contacts sidebar
          chatArea.classList.remove('active');
          showContactsSidebar();
        }
      });
    }
  }

  // --- Day Selection ---
  const daySection = document.createElement('div');
  daySection.className = 'reminder-section';
  daySection.innerHTML = `<div class="section-label">בחר יום</div>`;
  
  // Date Mode Selector (Tabs)
  const modeSelector = document.createElement('div');
  modeSelector.className = 'type-selector';
  
  const dayOfWeekBtn = document.createElement('button');
  dayOfWeekBtn.type = 'button';
  dayOfWeekBtn.className = 'type-btn selected';
  dayOfWeekBtn.textContent = 'יום בשבוע';
  
  const specificDateBtn = document.createElement('button');
  specificDateBtn.type = 'button';
  specificDateBtn.className = 'type-btn';
  specificDateBtn.textContent = 'תאריך ספציפי';
  
  modeSelector.appendChild(dayOfWeekBtn);
  modeSelector.appendChild(specificDateBtn);
  daySection.appendChild(modeSelector);
  
  // Days Grid (for day-of-week mode)
  const daysGrid = document.createElement('div');
  daysGrid.className = 'days-grid';
  
  // API URL for loading all reminders
  const API_URL = window.location.hostname === "localhost" 
    ? "http://localhost:5000" 
    : `${window.location.protocol}//${window.location.hostname}:5000`;

  // Function to load all reminders from server
  async function loadAllRemindersFromServer() {
    try {
      const response = await fetch(`${API_URL}/api/reminders/all`);
      if (response.ok) {
        return await response.json();
      }
      return {};
    } catch (error) {
      console.error("Failed to load all reminders:", error);
      return {};
    }
  }

  // Function to get contacts map
  async function getContactsMap() {
    try {
      const response = await fetch(`${API_URL}/api/contacts/json`);
      if (response.ok) {
        const data = await response.json();
        const map = {};
        if (data.contacts && Array.isArray(data.contacts)) {
          data.contacts.forEach(c => {
            map[c.phone] = c.name;
          });
        }
        return map;
      }
      return {};
    } catch (error) {
      console.error("Failed to load contacts:", error);
      return {};
    }
  }

  // Function to show day reminders sidebar
  // Can accept either a day label (e.g., "ראשון") or a specific date string (e.g., "2024-01-15")
  async function showDayRemindersSidebar(dayLabelOrDate, isSpecificDate = false) {
    // Remove existing sidebar if any
    const existingSidebar = document.querySelector('.day-reminders-sidebar');
    if (existingSidebar) {
      existingSidebar.remove();
    }

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'day-reminders-sidebar';
    
    let dateDisplay;
    let targetDateStr;
    let dayLabel = null;
    
    if (isSpecificDate) {
      // It's a specific date string (YYYY-MM-DD)
      const dateObj = parseDateString(dayLabelOrDate);
      if (dateObj) {
        const dayName = getDayName(dateObj.getDay());
        const monthDay = formatDateMonthDay(dayLabelOrDate);
        dateDisplay = `יום ${dayName}, ${monthDay}`;
        targetDateStr = dayLabelOrDate;
      } else {
        dateDisplay = formatDateHebrew(dayLabelOrDate);
        targetDateStr = dayLabelOrDate;
      }
    } else {
      // It's a day of week label
      dayLabel = dayLabelOrDate;
      const nextDate = getNextDayOfWeekFromToday(dayLabel);
      dateDisplay = `יום ${dayLabel}`;
      if (nextDate) {
        const monthDay = formatDateMonthDay(nextDate);
        dateDisplay = `יום ${dayLabel}, ${monthDay}`;
        targetDateStr = formatDateString(nextDate);
      }
    }

    sidebar.innerHTML = `
      <div class="day-reminders-sidebar-content">
        <div class="day-reminders-sidebar-header">
          <h3>${dateDisplay}</h3>
          <button class="close-day-reminders-sidebar-btn" aria-label="סגור">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="day-reminders-sidebar-meetings">
          <div class="loading-meetings" style="text-align:center; padding:40px 20px; color:var(--color-medium-grey);">
            טוען פגישות...
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Animate sidebar open
    requestAnimationFrame(() => {
      sidebar.classList.add('open');
    });

    // Close button handler
    const closeBtn = sidebar.querySelector('.close-day-reminders-sidebar-btn');
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      setTimeout(() => sidebar.remove(), 300);
    });

    // Click outside to close
    sidebar.addEventListener('click', (e) => {
      if (e.target === sidebar) {
        sidebar.classList.remove('open');
        setTimeout(() => sidebar.remove(), 300);
      }
    });

    // Load and display meetings for this day
    const meetingsContainer = sidebar.querySelector('.day-reminders-sidebar-meetings');
    
    try {
      const allReminders = await loadAllRemindersFromServer();
      const contactsMap = await getContactsMap();
      const meetings = [];

      // Process reminders from all users
      for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
        if (!Array.isArray(userReminders)) continue;
        
        const contactName = contactsMap[phoneNumber] || phoneNumber;
        
        userReminders.forEach(reminder => {
          if (!reminder.time) return;
          
          let isMatch = false;
          
          // Check if reminder has a specific date
          if (reminder.date) {
            const reminderDateObj = parseDateString(reminder.date);
            if (reminderDateObj && targetDateStr) {
              const reminderDateStr = formatDateString(reminderDateObj);
              isMatch = reminderDateStr === targetDateStr;
            }
          } else if (reminder.day && !isSpecificDate) {
            // Day-of-week reminder - only match if we're searching by day of week
            isMatch = reminder.day === dayLabel;
          } else if (reminder.day && isSpecificDate) {
            // For specific date, also check recurring day-of-week reminders
            const dateObj = parseDateString(targetDateStr);
            if (dateObj) {
              const targetDayName = getDayName(dateObj.getDay());
              isMatch = reminder.day === targetDayName;
            }
          }
          
          if (isMatch) {
            meetings.push({
              id: reminder.id,
              time: reminder.time,
              title: contactName,
              description: reminder.type === 'recurring' ? 'תזכורת קבועה' : 'תזכורת חד פעמית',
              duration: reminder.duration || 45,
              phoneNumber: phoneNumber
            });
          }
        });
      }

      // Sort meetings by time
      meetings.sort((a, b) => {
        const timeA = a.time.split(':').map(Number);
        const timeB = b.time.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      });

      // Render meetings
      if (meetings.length === 0) {
        meetingsContainer.innerHTML = '<div class="no-meetings">אין פגישות ביום זה</div>';
      } else {
        meetingsContainer.innerHTML = meetings.map(meeting => `
          <div class="day-meeting-item">
            <div class="day-meeting-time">${meeting.time}</div>
            <div class="day-meeting-info">
              <div class="day-meeting-title">${meeting.title}</div>
              <div class="day-meeting-description">${meeting.description}</div>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error("Failed to load meetings for day:", error);
      meetingsContainer.innerHTML = '<div class="no-meetings">שגיאה בטעינת הפגישות</div>';
    }
  }
  
  DAYS_OF_WEEK.forEach(day => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'day-btn';
    btn.textContent = day.label;
    btn.setAttribute('aria-label', `בחר יום ${day.label}`);
    
    btn.onclick = () => {
      // Update UI
      daysGrid.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      
      // Update State
      state.selectedDay = day.label;
      state.selectedDate = null; // Clear date when selecting day
      
      // Show day reminders sidebar
      showDayRemindersSidebar(day.label);
    };
    daysGrid.appendChild(btn);
  });
  daySection.appendChild(daysGrid);
  
  // Date Picker Container (for specific-date mode)
  const datePickerContainer = document.createElement('div');
  datePickerContainer.className = 'date-picker-container';
  datePickerContainer.style.display = 'none';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'time-input';
  
  // Set min date to today
  const today = new Date();
  dateInput.min = today.toISOString().split('T')[0];
  
  // Set max date to 6 months from now
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 6);
  dateInput.max = maxDate.toISOString().split('T')[0];
  
  dateInput.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    state.selectedDay = null; // Clear day when selecting date
    
    // Show day reminders sidebar for the selected date
    if (e.target.value) {
      showDayRemindersSidebar(e.target.value, true);
    }
  });
  
  datePickerContainer.appendChild(dateInput);
  daySection.appendChild(datePickerContainer);
  
  // Tab switching logic
  dayOfWeekBtn.onclick = () => {
    dayOfWeekBtn.classList.add('selected');
    specificDateBtn.classList.remove('selected');
    daysGrid.style.display = 'grid';
    datePickerContainer.style.display = 'none';
    state.dateMode = 'day-of-week';
    state.selectedDate = null;
  };
  
  specificDateBtn.onclick = () => {
    specificDateBtn.classList.add('selected');
    dayOfWeekBtn.classList.remove('selected');
    daysGrid.style.display = 'none';
    datePickerContainer.style.display = 'block';
    state.dateMode = 'specific-date';
    state.selectedDay = null;
  };
  
  container.appendChild(daySection);

  // --- Time Selection ---
  const timeSection = document.createElement('div');
  timeSection.className = 'reminder-section';
  timeSection.innerHTML = `<div class="section-label">בחר שעה</div>`;
  
  const timeContainer = document.createElement('div');
  timeContainer.className = 'time-picker-container';
  
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'time-input';
  
  // Set default time to next hour
  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setMinutes(0);
  // Format to HH:MM
  const defaultTime = now.toTimeString().substring(0, 5);
  timeInput.value = defaultTime;
  state.selectedTime = defaultTime;

  timeInput.addEventListener('input', (e) => {
    state.selectedTime = e.target.value;
  });
  
  timeContainer.appendChild(timeInput);
  timeSection.appendChild(timeContainer);
  container.appendChild(timeSection);

  // --- Reminder Type ---
  const typeSection = document.createElement('div');
  typeSection.className = 'reminder-section';
  typeSection.innerHTML = `<div class="section-label">סוג תזכורת</div>`;
  
  const typeSelector = document.createElement('div');
  typeSelector.className = 'type-selector';
  
  [
    { id: 'one-time', label: 'חד פעמי' },
    { id: 'recurring', label: 'קבוע' }
  ].forEach(type => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `type-btn ${type.id === state.reminderType ? 'selected' : ''}`;
    btn.textContent = type.label;
    
    btn.onclick = () => {
      typeSelector.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.reminderType = type.id;
    };
    typeSelector.appendChild(btn);
  });
  typeSection.appendChild(typeSelector);
  container.appendChild(typeSection);

  // --- Pre-Reminders Section ---
  const preReminderSection = document.createElement('div');
  preReminderSection.className = 'reminder-section';
  preReminderSection.innerHTML = `<div class="section-label">תזכורות מקדימות</div>`;
  
  const checkboxGroup = document.createElement('div');
  checkboxGroup.className = 'checkbox-group';
  
  const preReminderOptions = [
    { value: '30m', label: 'חצי שעה לפני' },
    { value: '1h', label: 'שעה לפני' },
    { value: '1d', label: 'יום לפני' },
    { value: '3d', label: '3 ימים לפני' }
  ];
  
  preReminderOptions.forEach(option => {
    const label = document.createElement('label');
    label.className = 'checkbox-option';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'preReminder';
    checkbox.value = option.value;
    checkbox.checked = state.preReminder.includes(option.value);
    
    checkbox.addEventListener('change', () => {
      const checkedValues = Array.from(checkboxGroup.querySelectorAll('input[name="preReminder"]'))
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      state.preReminder = checkedValues.length > 0 ? checkedValues : [];
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${option.label}`));
    checkboxGroup.appendChild(label);
  });
  
  preReminderSection.appendChild(checkboxGroup);
  container.appendChild(preReminderSection);

  // --- Action Buttons ---
  const actionsRow = document.createElement('div');
  actionsRow.className = 'actions-row';
  
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-save';
  saveBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
    שמור
  `;
  
  // Load existing reminders
  async function loadRemindersFromServer() {
    try {
      const encodedPhone = encodeURIComponent(contact.phone);
      const response = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error("Failed to load reminders:", error);
      return [];
    }
  }

  
  actionsRow.appendChild(saveBtn);
  container.appendChild(actionsRow);


  // --- Reminders List Section ---
  const remindersListSection = document.createElement('div');
  remindersListSection.className = 'reminder-section';
  remindersListSection.innerHTML = `
    <div class="section-label">
      רשימת תזכורות
    </div>
    <div class="reminders-list" id="remindersList">
      <!-- Reminders will be rendered here -->
    </div>
  `;
  container.appendChild(remindersListSection);

  // Edit Reminder Function
  async function editReminder(reminderId) {
    const reminder = state.userReminders.find((r) => r.id === reminderId);
    if (!reminder) {
      toast.error("התזכורת לא נמצאה");
      return;
    }

    // Populate form with reminder data
    if (reminder.date) {
      state.selectedDate = reminder.date;
      state.dateMode = "specific-date";
      dateInput.value = reminder.date;
      state.selectedDay = null;
      dayOfWeekBtn.classList.remove('selected');
      specificDateBtn.classList.add('selected');
      daysGrid.style.display = 'none';
      datePickerContainer.style.display = 'block';
    } else {
      state.selectedDay = reminder.day;
      state.dateMode = "day-of-week";
      state.selectedDate = null;
      dateInput.value = '';
      dayOfWeekBtn.classList.add('selected');
      specificDateBtn.classList.remove('selected');
      daysGrid.style.display = 'grid';
      datePickerContainer.style.display = 'none';
      
      // Highlight selected day
      daysGrid.querySelectorAll('.day-btn').forEach(b => {
        if (b.textContent === reminder.day) {
          b.classList.add('selected');
        } else {
          b.classList.remove('selected');
        }
      });
    }

    timeInput.value = reminder.time;
    state.selectedTime = reminder.time;
    state.reminderType = reminder.type || 'one-time';

    // Update type selector
    typeSelector.querySelectorAll('.type-btn').forEach(b => {
      if ((b.textContent === 'חד פעמי' && state.reminderType === 'one-time') ||
          (b.textContent === 'קבוע' && state.reminderType === 'recurring')) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });

    // Set pre-reminders
    const preReminders = Array.isArray(reminder.preReminder) ? reminder.preReminder : reminder.preReminder ? [reminder.preReminder] : ['1h', '1d', '3d'];
    state.preReminder = preReminders;
    checkboxGroup.querySelectorAll('input[name="preReminder"]').forEach(cb => {
      cb.checked = preReminders.includes(cb.value);
    });

    // Store the reminder ID for update
    saveBtn.dataset.editingId = reminderId;
    saveBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      עדכן תזכורת
    `;

    // Scroll to form
    header.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Delete Reminder Function
  async function deleteReminder(reminderId) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את התזכורת?")) {
      return;
    }

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

      const savedReminders = await response.json();
      state.userReminders = savedReminders;
      renderRemindersList();

      window.dispatchEvent(
        new CustomEvent("remindersUpdated", {
          detail: { phone: contact.phone, reminders: savedReminders },
        })
      );

      toast.success("התזכורת נמחקה בהצלחה");
    } catch (error) {
      console.error("Failed to delete reminder", error);
      toast.error(`שגיאה במחיקת התזכורת: ${error.message || "שגיאה לא ידועה"}`);
      state.userReminders = await loadRemindersFromServer();
      renderRemindersList();
    }
  }

  // Send reminder manually function
  async function sendReminderManually(reminder) {
    const sendBtn = document.querySelector(`.send-reminder-btn[data-reminder-id="${reminder.id}"]`);
    if (!sendBtn || sendBtn.disabled) return;

    try {
      sendBtn.disabled = true;
      const originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

      toast.success("התזכורת נשלחה בהצלחה");
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalHTML;
    } catch (error) {
      console.error("Failed to send reminder", error);
      toast.error(`שגיאה בשליחת התזכורת: ${error.message || "שגיאה לא ידועה"}`);
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

  function renderRemindersList() {
    const list = remindersListSection.querySelector("#remindersList");
    list.innerHTML = "";

    if (state.userReminders.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:#999;">אין תזכורות למשתמש זה</p>';
      return;
    }

    // Sort reminders: recurring first, then one-time, both newest to oldest
    const sortedReminders = [...state.userReminders].sort((a, b) => {
      if (a.type === "recurring" && b.type !== "recurring") {
        return -1;
      }
      if (a.type !== "recurring" && b.type === "recurring") {
        return 1;
      }
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });

    sortedReminders.forEach((rem) => {
      const el = document.createElement("div");
      el.className = `reminder-item ${rem.type === "recurring" ? "recurring" : "one-time"}`;

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
        const dateObj = parseDateString(rem.date);
        if (dateObj) {
          const dayName = getDayName(dateObj.getDay());
          const monthDay = formatDateMonthDay(rem.date);
          dayDisplay = `יום ${dayName}, ${monthDay}`;
        } else {
          dayDisplay = formatDateHebrew(rem.date);
        }
      } else if (rem.day) {
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
          <span class="reminder-tag">${rem.duration || 45} דקות</span>
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
        </div>
      `;

      // Add event handlers
      const editBtn = el.querySelector(".edit-reminder-btn");
      editBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await editReminder(rem.id);
      });

      const sendBtn = el.querySelector(".send-reminder-btn");
      sendBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await sendReminderManually(rem);
      });

      const deleteBtn = el.querySelector(".delete-reminder-btn");
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteReminder(rem.id);
      });

      list.appendChild(el);
    });
  }

  // Save button handler (handles both create and update)
  saveBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (saveBtn.disabled) {
      return;
    }

    saveBtn.disabled = true;

    if (!contact.phone) {
      toast.error("שגיאה: מספר טלפון חסר");
      saveBtn.disabled = false;
      return;
    }

    let reminderDay = null;
    let reminderDate = null;
    
    if (state.dateMode === "specific-date") {
      reminderDate = state.selectedDate;
      reminderDay = undefined;
    } else {
      reminderDay = state.selectedDay;
      reminderDate = undefined;
    }

    const hasValidDate = (state.dateMode === 'day-of-week' && state.selectedDay) || 
                         (state.dateMode === 'specific-date' && state.selectedDate);

    if (!hasValidDate || !state.selectedTime) {
      toast.error("נא לבחור יום או תאריך ושעה");
      saveBtn.disabled = false;
      return;
    }

    let reminderDateTime = null;

    if (state.dateMode === "specific-date" && reminderDate) {
      const dateObj = parseDateString(reminderDate);
      if (dateObj) {
        const timeParts = parseTime(state.selectedTime);
        if (timeParts) {
          reminderDateTime = new Date(dateObj);
          reminderDateTime.setHours(timeParts[0], timeParts[1], 0, 0);
        }
      }
    } else if (state.dateMode === "day-of-week" && reminderDay) {
      const dayIndex = getDayIndex(reminderDay);
      if (dayIndex !== null) {
        const today = new Date();
        const nextDay = getNextDayOfWeek(today, dayIndex);
        const timeParts = parseTime(state.selectedTime);
        if (timeParts) {
          reminderDateTime = new Date(nextDay);
          reminderDateTime.setHours(timeParts[0], timeParts[1], 0, 0);
        }
      }
    }

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
        day: reminderDay || '',
        date: reminderDate || null,
        dateMode: state.dateMode,
        time: state.selectedTime,
        type: state.reminderType,
        preReminder: state.preReminder,
      };
      state.userReminders[index] = reminder;
    } else {
      // Create new reminder – title as "פגישה - (contact name)" so calendar/display show who it's for
      const reminderTitle = contact.name ? `פגישה - ${contact.name}` : 'פגישה';
      reminder = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        day: reminderDay || '',
        date: reminderDate || null,
        dateMode: state.dateMode,
        time: state.selectedTime,
        duration: 45,
        type: state.reminderType,
        preReminder: state.preReminder,
        title: reminderTitle,
      };
      state.userReminders.push(reminder);
    }

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

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }

      const savedReminders = await response.json();
      state.userReminders = savedReminders;
      renderRemindersList();

      window.dispatchEvent(
        new CustomEvent("remindersUpdated", {
          detail: { phone: contact.phone, reminders: savedReminders },
        })
      );

      // Reset form
      daysGrid.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
      dateInput.value = '';
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      const defaultTime = now.toTimeString().substring(0, 5);
      timeInput.value = defaultTime;
      state.selectedDay = null;
      state.selectedDate = null;
      state.dateMode = 'day-of-week';
      state.selectedTime = defaultTime;
      state.reminderType = 'one-time';
      state.preReminder = ['1h', '1d', '3d'];
      
      dayOfWeekBtn.classList.add('selected');
      specificDateBtn.classList.remove('selected');
      daysGrid.style.display = 'grid';
      datePickerContainer.style.display = 'none';
      
      typeSelector.querySelectorAll('.type-btn').forEach(b => {
        if (b.textContent === 'חד פעמי') {
          b.classList.add('selected');
        } else {
          b.classList.remove('selected');
        }
      });

      // Reset pre-reminder checkboxes
      checkboxGroup.querySelectorAll('input[name="preReminder"]').forEach(cb => {
        cb.checked = ['1h', '1d', '3d'].includes(cb.value);
      });

      delete saveBtn.dataset.editingId;
      saveBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        שמור
      `;

      toast.success(editingId ? "התזכורת עודכנה בהצלחה" : "התזכורת נשמרה בהצלחה");
    } catch (error) {
      console.error("Failed to save reminder", error);
      toast.error(`שגיאה בשמירת התזכורת: ${error.message || "שגיאה לא ידועה"}`);
      state.userReminders = await loadRemindersFromServer();
      renderRemindersList();
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Load reminders on init
  loadRemindersFromServer().then(reminders => {
    state.userReminders = reminders;
    renderRemindersList();
  });

  // Listen for reminder updates from other components
  window.addEventListener("remindersUpdated", async (event) => {
    const { phone, reminders } = event.detail;
    if (phone === contact.phone) {
      state.userReminders = reminders;
      renderRemindersList();
    }
  });

  return container;
}
