// Meeting Calendar Component

import { getDayName, getWeekStart, formatDateString, getCurrentDate, getDayIndex, getNextDayOfWeek, parseTime, parseDateString } from '../../utils/dateUtils.js';
import { DAYS_OF_WEEK } from '../../config/reminderTemplates.js';
import { toast } from '../toast/Toast.js';

const MANUAL_PHONE = '__manual__';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

/**
 * Creates and returns the meeting calendar panel
 * @returns {HTMLElement} Meeting calendar panel element
 */
export async function createMeetingCalendarPanel() {
  // Cleanup any existing panels
  const existingPanels = document.querySelectorAll(".meeting-calendar-panel");
  existingPanels.forEach((p) => p.remove());

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
  panel.className = "meeting-calendar-panel";
  
  // Handle mobile navigation
  const { isMobile, showChatArea } = await import("../../utils/mobileNavigation.js");
  const isMobileDevice = isMobile();
  
  if (isMobileDevice) {
    panel.classList.add("active");
  }

  // State
  let currentView = 'week'; // 'week' or 'month'
  let currentDate = getCurrentDate();
  let meetings = [];

  const API_URL = window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : `${window.location.protocol}//${window.location.hostname}:5000`;

  // Load reminders from server (defined below)
  const loadAndRender = async () => {
    meetings = await loadRemindersFromServer();
    render();
  };

  // Delete reminder (from calendar) – removes everywhere and refreshes
  const deleteReminderFromCalendar = async (phoneNumber, reminderId, onSuccess) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק את התזכורת?")) {
      return;
    }
    try {
      const encodedPhone = encodeURIComponent(phoneNumber);
      const res = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`);
      if (!res.ok) throw new Error("Failed to load reminders");
      const list = await res.json();
      if (!Array.isArray(list)) throw new Error("Invalid reminders response");
      const filtered = list.filter((r) => r.id !== reminderId);
      if (filtered.length === list.length) {
        toast.error("התזכורת לא נמצאה");
        return;
      }
      const saveRes = await fetch(`${API_URL}/api/users/${encodedPhone}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reminders: filtered }),
        credentials: "omit",
        cache: "no-cache",
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${saveRes.status}`);
      }
      toast.success("התזכורת נמחקה בהצלחה");
      await loadAndRender();
      if (typeof onSuccess === "function") onSuccess();
    } catch (err) {
      console.error("Delete reminder failed:", err);
      toast.error(`שגיאה במחיקת התזכורת: ${err.message || "שגיאה לא ידועה"}`);
    }
  };

  // רענון אוטומטי כל דקה - כדי שתורים שקבע ה-AI יופיעו אוטומטית
  const AUTO_REFRESH_INTERVAL_MS = 60000;
  let autoRefreshTimer = null;

  const startAutoRefresh = () => {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAndRender();
      }
    }, AUTO_REFRESH_INTERVAL_MS);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  };

  // רענון כשחוזרים לטאב/חלון
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      loadAndRender();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  startAutoRefresh();
  
  loadAndRender();

  // Header
  const header = document.createElement("div");
  header.className = "meeting-calendar-header";
  
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
      <h2>יומן פגישות</h2>
    </div>
    <div class="meeting-calendar-header-actions">
      <div class="google-calendar-actions" id="googleCalendarActions">
        <button type="button" class="google-calendar-connect-btn" id="googleCalendarConnectBtn" title="התחברות ליומן גוגל">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="18" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
          <span>ממשקות ליומן גוגל</span>
        </button>
      </div>
      <button type="button" class="refresh-meeting-calendar-btn" aria-label="רענן" title="רענן פגישות">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
      <button type="button" class="close-meeting-calendar-btn" aria-label="סגור">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;
  
  // Add back button handler for mobile
  if (isMobileDevice) {
    const backButton = header.querySelector('.panel-back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        stopAutoRefresh();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        // Show placeholder instead
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
        
        // On mobile, ensure chat area is hidden and contacts sidebar is shown
        import("../../utils/mobileNavigation.js").then(({ isMobile, showContactsSidebar }) => {
          if (isMobile()) {
            chatArea.classList.remove("active");
            showContactsSidebar();
          }
        });
      });
    }
  }

  // View Tabs
  const tabsContainer = document.createElement("div");
  tabsContainer.className = "meeting-calendar-tabs";
  tabsContainer.innerHTML = `
    <button class="tab-button active" data-view="week">השבוע</button>
    <button class="tab-button" data-view="month">החודש</button>
  `;

  // Content Container
  const contentContainer = document.createElement("div");
  contentContainer.className = "meeting-calendar-content";

  // Render function
  const render = () => {
    contentContainer.innerHTML = '';
    if (currentView === 'week') {
      contentContainer.appendChild(renderWeekView());
    } else {
      contentContainer.appendChild(renderMonthView());
    }
  };

  // Week View
  const renderWeekView = () => {
    const weekContainer = document.createElement("div");
    weekContainer.className = "week-view";

    const today = getCurrentDate();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    const weekDays = [];

    // Get 14 days starting from today (not from week start)
    for (let i = 0; i < 14; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      weekDays.push(day);
    }

    weekDays.forEach((day) => {
      const dayCard = document.createElement("div");
      dayCard.className = "week-day-card";
      
      const isToday = formatDateString(day) === formatDateString(getCurrentDate());
      if (isToday) {
        dayCard.classList.add('today');
      }

      const dayName = getDayName(day.getDay());
      const dayNumber = day.getDate();
      const month = day.getMonth() + 1;

      // Get meetings for this day
      const dayMeetings = getMeetingsForDate(day);

      dayCard.innerHTML = `
        <div class="day-header">
          <div class="day-name">${dayName}</div>
          <div class="day-date">
            <span class="day-number">${dayNumber}</span>
            <span class="day-month">/${month}</span>
          </div>
        </div>
        <div class="day-meetings">
          ${dayMeetings.length === 0 
            ? '<div class="no-meetings">אין פגישות</div>'
            : dayMeetings.map(meeting => `
                <div class="meeting-item ${meeting.categoryId ? 'meeting-item--category' : ''}" data-meeting-id="${meeting.id}" data-reminder-id="${meeting.reminder?.id ?? meeting.id}" data-phone="${(meeting.phoneNumber || '').replace(/"/g, '&quot;')}">
                  <div class="meeting-item-content">
                    <div class="meeting-time">${meeting.time}</div>
                    <div class="meeting-title">${meeting.title || 'פגישה'}${meeting.duration ? ` <span class="meeting-duration">(${meeting.duration} דק')</span>` : ''}</div>
                    ${meeting.location ? `<div class="meeting-location">${meeting.location}</div>` : ''}
                  </div>
                  <div class="meeting-item-actions">
                    <button type="button" class="meeting-edit-btn" aria-label="ערוך תזכורת" title="ערוך תזכורת">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button type="button" class="meeting-delete-btn" aria-label="מחק תזכורת" title="מחק תזכורת">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </div>
              `).join('')
          }
        </div>
      `;

      weekContainer.appendChild(dayCard);
    });

    return weekContainer;
  };

  // Month View
  const renderMonthView = () => {
    const monthContainer = document.createElement("div");
    monthContainer.className = "month-view";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get first Sunday of the calendar view
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Count meetings in current month
    const monthMeetings = meetings.filter(meeting => {
      if (!meeting.date) return false;
      const meetingDate = parseDateString(meeting.date);
      if (!meetingDate) return false;
      return meetingDate.getFullYear() === year && meetingDate.getMonth() === month;
    });
    const meetingCount = monthMeetings.length;

    // Check if we're at the current month (to disable previous button)
    const today = getCurrentDate();
    const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && 
                          currentDate.getMonth() === today.getMonth();

    // Month header
    const monthHeader = document.createElement("div");
    monthHeader.className = "month-header";
    const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    monthHeader.innerHTML = `
      <div class="month-header-content">
        <button type="button" class="month-nav-btn month-nav-next" aria-label="חודש הבא">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <div class="month-header-text">
          <h3>${monthNames[month]} ${year}</h3>
          <div class="month-meetings-count">${meetingCount} פגישות</div>
        </div>
        <button type="button" class="month-nav-btn month-nav-prev" ${isCurrentMonth ? 'disabled' : ''} aria-label="חודש קודם">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>
    `;
    monthContainer.appendChild(monthHeader);

    // Add navigation event handlers
    const prevBtn = monthHeader.querySelector('.month-nav-prev');
    const nextBtn = monthHeader.querySelector('.month-nav-next');
    
    prevBtn.addEventListener('click', () => {
      // Check if we're at current month before navigating
      const today = getCurrentDate();
      const isAtCurrentMonth = currentDate.getFullYear() === today.getFullYear() && 
                               currentDate.getMonth() === today.getMonth();
      
      if (!isAtCurrentMonth) {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        currentDate = newDate;
        render();
      }
    });
    
    nextBtn.addEventListener('click', () => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      currentDate = newDate;
      render();
    });

    // Day names header
    const dayNamesHeader = document.createElement("div");
    dayNamesHeader.className = "calendar-day-names";
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    dayNames.forEach(name => {
      const dayNameCell = document.createElement("div");
      dayNameCell.className = "day-name-cell";
      dayNameCell.textContent = name;
      dayNamesHeader.appendChild(dayNameCell);
    });
    monthContainer.appendChild(dayNamesHeader);

    // Calendar grid
    const calendarGrid = document.createElement("div");
    calendarGrid.className = "calendar-grid";

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);
      
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = formatDateString(cellDate) === formatDateString(getCurrentDate());
      
      if (!isCurrentMonth) {
        cell.classList.add('other-month');
      }
      if (isToday) {
        cell.classList.add('today');
      }

      const dayNumber = cellDate.getDate();
      const dayMeetings = isCurrentMonth ? getMeetingsForDate(cellDate) : [];

      // Add class if day has meetings
      if (dayMeetings.length > 0) {
        cell.classList.add('has-meetings');
      }

      cell.innerHTML = `
        <div class="cell-day-number">${dayNumber}</div>
        ${dayMeetings.length > 0 ? `<div class="cell-meetings-count">${dayMeetings.length}</div>` : ''}
      `;

      // Add click handler to show day details
      cell.addEventListener('click', () => {
        if (isCurrentMonth) {
          showDayDetails(cellDate, dayMeetings);
        }
      });

      calendarGrid.appendChild(cell);
    }

    monthContainer.appendChild(calendarGrid);

    return monthContainer;
  };

  // Show day details modal
  const showDayDetails = (date, dayMeetings) => {
    const modal = document.createElement("div");
    modal.className = "day-details-modal";

    const dayName = getDayName(date.getDay());
    const dayNumber = date.getDate();
    const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    modal.innerHTML = `
      <div class="day-details-content">
        <div class="day-details-header">
          <h3>${dayName}, ${dayNumber} ${monthNames[date.getMonth()]}</h3>
          <button class="close-day-details-btn" aria-label="סגור">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="day-details-meetings">
          ${dayMeetings.length === 0
            ? '<div class="no-meetings">אין פגישות ביום זה</div>'
            : dayMeetings.map(meeting => {
                const reminderId = meeting.reminder?.id ?? meeting.id;
                const phone = (meeting.phoneNumber || '').replace(/"/g, '&quot;');
                return `
                <div class="day-meeting-item ${meeting.categoryId ? 'day-meeting-item--category' : ''}" data-reminder-id="${reminderId}" data-phone="${phone}">
                  <div class="day-meeting-main">
                    <div class="day-meeting-time">${meeting.time}</div>
                    <div class="day-meeting-info">
                      <div class="day-meeting-title">${meeting.title || 'פגישה'}${meeting.duration ? ` <span class="day-meeting-duration">(${meeting.duration} דק')</span>` : ''}</div>
                      ${meeting.location ? `<div class="day-meeting-location">${meeting.location}</div>` : ''}
                      ${meeting.description ? `<div class="day-meeting-description">${meeting.description}</div>` : ''}
                    </div>
                  </div>
                  <div class="day-meeting-actions">
                    <button type="button" class="day-meeting-edit-btn" aria-label="ערוך תזכורת" title="ערוך תזכורת">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      <span>ערוך</span>
                    </button>
                    <button type="button" class="day-meeting-delete-btn" aria-label="מחק תזכורת" title="מחק תזכורת">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      <span>מחק</span>
                    </button>
                  </div>
                </div>
              `;
              }).join('')
          }
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close-day-details-btn');
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Delete button in day details
    modal.querySelectorAll('.day-meeting-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('.day-meeting-item');
        if (!item) return;
        const reminderId = item.dataset.reminderId;
        const phone = item.dataset.phone;
        if (reminderId && phone) {
          deleteReminderFromCalendar(phone, reminderId, () => modal.remove());
        }
      });
    });

    // Edit button in day details
    modal.querySelectorAll('.day-meeting-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('.day-meeting-item');
        if (!item) return;
        const reminderId = item.dataset.reminderId;
        const phone = item.dataset.phone;
        const meeting = meetings.find(m => m.phoneNumber === phone && (m.reminder?.id ?? m.id) === reminderId);
        if (meeting) {
          modal.remove();
          showEditReminderModal(meeting, () => loadAndRender());
        }
      });
    });
  };

  // Show edit reminder modal – full edit: category, treatment, date, time, user/name
  const showEditReminderModal = async (meeting, onSuccess) => {
    const r = meeting.reminder || {};
    const hasDate = r.date && String(r.date).trim();
    const dateMode = hasDate ? 'date' : 'day';
    const todayStr = formatDateString(getCurrentDate());
    const dayOptions = DAYS_OF_WEEK.map((d) => `<option value="${escapeHtml(d.label)}" ${r.day === d.label ? 'selected' : ''}>${escapeHtml(d.label)}</option>`).join('');
    const isManual = meeting.phoneNumber === MANUAL_PHONE;
    const nameBlock = isManual
      ? `<label for="edit-reminder-name">שם *</label><input type="text" id="edit-reminder-name" value="${escapeHtml(r.clientName || '')}" required />`
      : '';
    const userBlock = !isManual
      ? `
        <label for="edit-reminder-contact-search">משתמש / איש קשר</label>
        <input type="text" id="edit-reminder-contact-search" placeholder="חפש לפי שם או מספר טלפון..." autocomplete="off" />
        <div id="edit-reminder-contact-list" class="meeting-edit-contact-list" data-selected-phone="${escapeHtml(meeting.phoneNumber || '')}">
          <div class="meeting-edit-contact-loading">טוען אנשי קשר...</div>
        </div>
      `
      : '';

    const overlay = document.createElement('div');
    overlay.className = 'meeting-edit-overlay';
    overlay.innerHTML = `
      <div class="meeting-edit-modal" role="dialog" aria-label="עריכת תור">
        <div class="meeting-edit-header">
          <h3>עריכת תור</h3>
          <button type="button" class="meeting-edit-close" aria-label="סגור">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="meeting-edit-body">
          ${nameBlock}
          ${userBlock}
          <label for="edit-reminder-category">קטגוריה / סוג טיפול</label>
          <select id="edit-reminder-category" class="meeting-edit-select">
            <option value="">— בחר קטגוריה —</option>
          </select>
          <label for="edit-reminder-treatment">סוג טיפול</label>
          <select id="edit-reminder-treatment" class="meeting-edit-select" disabled>
            <option value="">— בחר טיפול —</option>
          </select>
          <label for="edit-reminder-time">שעה *</label>
          <input type="time" id="edit-reminder-time" value="${escapeHtml(r.time || '')}" required />
          <label for="edit-reminder-duration">משך (דקות) *</label>
          <input type="number" id="edit-reminder-duration" min="1" step="1" value="${r.duration != null ? r.duration : 60}" required />
          <fieldset class="meeting-edit-date-mode">
            <legend>תאריך *</legend>
            <label class="meeting-edit-radio"><input type="radio" name="edit-reminder-datemode" value="day" ${dateMode === 'day' ? 'checked' : ''} /> לפי יום בשבוע</label>
            <label class="meeting-edit-radio"><input type="radio" name="edit-reminder-datemode" value="date" ${dateMode === 'date' ? 'checked' : ''} /> לפי תאריך מדויק</label>
            <div class="meeting-edit-date-by-day ${dateMode === 'date' ? 'hidden' : ''}">
              <label for="edit-reminder-day">יום</label>
              <select id="edit-reminder-day">${dayOptions}</select>
            </div>
            <div class="meeting-edit-date-by-date ${dateMode === 'day' ? 'hidden' : ''}">
              <label for="edit-reminder-date">תאריך</label>
              <input type="date" id="edit-reminder-date" min="${todayStr}" value="${hasDate ? escapeHtml(r.date) : ''}" />
            </div>
          </fieldset>
          <label for="edit-reminder-notes">הערות</label>
          <textarea id="edit-reminder-notes" rows="3" placeholder="הערות...">${escapeHtml(r.notes || '')}</textarea>
        </div>
        <div class="meeting-edit-actions">
          <button type="button" class="meeting-edit-save">שמור שינויים</button>
        </div>
      </div>
    `;

    const popup = overlay.querySelector('.meeting-edit-modal');
    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };

    const categorySelect = overlay.querySelector('#edit-reminder-category');
    const treatmentSelect = overlay.querySelector('#edit-reminder-treatment');
    const durationInput = overlay.querySelector('#edit-reminder-duration');
    const contactSearchInput = overlay.querySelector('#edit-reminder-contact-search');
    const contactListDiv = overlay.querySelector('#edit-reminder-contact-list');

    // Load categories
    let categories = [];
    try {
      const catRes = await fetch(`${API_URL}/api/service-categories`);
      const catData = catRes.ok ? await catRes.json() : {};
      categories = Array.isArray(catData?.categories) ? catData.categories : [];
      categories = categories.filter((c) => (c.name || '').trim() !== 'שירות כותרת');
    } catch (e) {
      console.warn('Could not load categories:', e);
    }
    categorySelect.innerHTML = '<option value="">— בחר קטגוריה —</option>';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = (cat.name || '').trim() || cat.id;
      opt.dataset.category = JSON.stringify(cat);
      if (r.categoryId === cat.id) opt.selected = true;
      categorySelect.appendChild(opt);
    });

    // Populate treatments when category selected
    const updateTreatments = () => {
      const catOpt = categorySelect.selectedOptions[0];
      treatmentSelect.innerHTML = '<option value="">— בחר טיפול —</option>';
      treatmentSelect.disabled = true;
      durationInput.value = String(r.duration != null ? r.duration : 60);
      if (!catOpt?.value) return;
      let category;
      try {
        category = catOpt.dataset.category ? JSON.parse(catOpt.dataset.category) : null;
      } catch (_) {
        category = null;
      }
      if (!category?.treatments?.length) return;
      treatmentSelect.disabled = false;
      (category.treatments || []).forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (t.name || '').trim() || t.id;
        opt.dataset.durationMinutes = String(t.durationMinutes != null ? t.durationMinutes : 30);
        if (r.treatmentId === t.id) opt.selected = true;
        treatmentSelect.appendChild(opt);
      });
      if (r.treatmentId) {
        const trtOpt = treatmentSelect.querySelector(`option[value="${r.treatmentId}"]`);
        if (trtOpt) {
          trtOpt.selected = true;
          const min = parseInt(trtOpt.dataset.durationMinutes, 10);
          durationInput.value = Number.isFinite(min) && min >= 1 ? min : 60;
        }
      }
    };
    categorySelect.addEventListener('change', updateTreatments);
    treatmentSelect.addEventListener('change', () => {
      const opt = treatmentSelect.selectedOptions[0];
      if (!opt?.value) {
        durationInput.value = '60';
        return;
      }
      const min = parseInt(opt.dataset.durationMinutes, 10);
      durationInput.value = Number.isFinite(min) && min >= 1 ? min : 60;
    });
    updateTreatments();

    // Load contacts for user selector with search (when not manual)
    let allContacts = [];
    const renderContactList = (filter = '') => {
      if (!contactListDiv) return;
      const q = (filter || '').trim().toLowerCase();
      const filtered = q
        ? allContacts.filter((c) => {
            const name = ((c.name || '').trim() || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            return name.includes(q) || phone.includes(q);
          })
        : allContacts;
      contactListDiv.innerHTML = '';
      contactListDiv.dataset.selectedPhone = contactListDiv.dataset.selectedPhone || meeting.phoneNumber || '';
      filtered.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'meeting-edit-contact-item';
        item.dataset.phone = c.phone;
        const displayName = (c.name || '').trim() || c.phone;
        item.textContent = `${displayName} (${c.phone})`;
        if (c.phone === (contactListDiv.dataset.selectedPhone || '')) {
          item.classList.add('selected');
        }
        item.addEventListener('click', () => {
          contactListDiv.querySelectorAll('.meeting-edit-contact-item').forEach((el) => el.classList.remove('selected'));
          item.classList.add('selected');
          contactListDiv.dataset.selectedPhone = c.phone;
        });
        contactListDiv.appendChild(item);
      });
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'meeting-edit-contact-empty';
        empty.textContent = q ? 'לא נמצאו תוצאות' : 'אין אנשי קשר';
        contactListDiv.appendChild(empty);
      }
    };
    if (contactSearchInput && contactListDiv) {
      contactSearchInput.addEventListener('input', () => renderContactList(contactSearchInput.value));
      contactSearchInput.addEventListener('focus', () => renderContactList(contactSearchInput.value));
      try {
        const contactsRes = await fetch(`${API_URL}/api/contacts/json`);
        const contactsData = contactsRes.ok ? await contactsRes.json() : {};
        const contacts = contactsData.contacts && Array.isArray(contactsData.contacts) ? contactsData.contacts : [];
        allContacts = contacts.map((c) => ({ phone: c.phone, name: (c.name || '').trim() || c.phone }));
        if (!allContacts.some((c) => c.phone === meeting.phoneNumber) && meeting.phoneNumber) {
          allContacts.push({ phone: meeting.phoneNumber, name: `${meeting.phoneNumber} (נוכחי)` });
        }
        renderContactList();
      } catch (e) {
        console.warn('Could not load contacts:', e);
        contactListDiv.innerHTML = '<div class="meeting-edit-contact-empty">לא ניתן לטעון אנשי קשר</div>';
      }
    }

    // Date mode toggle
    const byDayEl = overlay.querySelector('.meeting-edit-date-by-day');
    const byDateEl = overlay.querySelector('.meeting-edit-date-by-date');
    overlay.querySelectorAll('input[name="edit-reminder-datemode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const isDay = overlay.querySelector('input[name="edit-reminder-datemode"]:checked').value === 'day';
        byDayEl.classList.toggle('hidden', !isDay);
        byDateEl.classList.toggle('hidden', isDay);
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.meeting-edit-close').addEventListener('click', close);

    overlay.querySelector('.meeting-edit-save').addEventListener('click', async () => {
      const nameInput = overlay.querySelector('#edit-reminder-name');
      const timeInput = overlay.querySelector('#edit-reminder-time');
      const durationInputEl = overlay.querySelector('#edit-reminder-duration');
      const daySelect = overlay.querySelector('#edit-reminder-day');
      const dateInput = overlay.querySelector('#edit-reminder-date');
      const notesInput = overlay.querySelector('#edit-reminder-notes');

      const time = timeInput.value.trim();
      const durationVal = Number(durationInputEl.value);
      const duration = Number.isFinite(durationVal) && durationVal >= 1 ? Math.round(durationVal) : 60;
      const dateModeVal = overlay.querySelector('input[name="edit-reminder-datemode"]:checked').value;
      const dateStr = dateInput.value.trim();
      const dayStr = daySelect.value.trim();

      if (!time) {
        timeInput.focus();
        return;
      }
      if (isManual && nameInput) {
        if (!nameInput.value.trim()) {
          nameInput.focus();
          return;
        }
      }
      if (dateModeVal === 'date' && !dateStr) {
        dateInput.focus();
        return;
      }

      let title = 'פגישה';
      let categoryId = null;
      let treatmentId = null;
      const catOpt = categorySelect.selectedOptions[0];
      const trtOpt = treatmentSelect.selectedOptions[0];
      if (catOpt?.value && trtOpt?.value && catOpt.dataset.category) {
        try {
          const category = JSON.parse(catOpt.dataset.category);
          categoryId = category.id;
          const treatment = (category.treatments || []).find((t) => t.id === trtOpt.value);
          treatmentId = treatment ? treatment.id : null;
          const catName = (category.name || '').trim() || 'שירות';
          const trtName = treatment ? ((treatment.name || '').trim() || 'טיפול') : 'טיפול';
          title = `${catName} - ${trtName}`;
        } catch (_) {}
      }

      const newPhone = contactListDiv ? (contactListDiv.dataset.selectedPhone || meeting.phoneNumber) : meeting.phoneNumber;
      const updated = {
        ...r,
        time,
        duration,
        title,
        notes: notesInput.value.trim(),
        date: dateModeVal === 'date' ? dateStr : null,
        day: dateModeVal === 'day' ? dayStr : '',
        categoryId: categoryId || null,
        treatmentId: treatmentId || null
      };
      if (isManual && nameInput) updated.clientName = nameInput.value.trim();

      try {
        const oldPhone = meeting.phoneNumber;
        if (newPhone !== oldPhone) {
          // Move to different user: remove from old, add to new
          const oldRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(oldPhone)}/reminders`);
          const oldListRaw = oldRes.ok ? await oldRes.json() : [];
          const oldList = Array.isArray(oldListRaw) ? oldListRaw : [];
          const filtered = oldList.filter((item) => item.id !== r.id);
          await fetch(`${API_URL}/api/users/${encodeURIComponent(oldPhone)}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminders: filtered })
          });

          const newRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(newPhone)}/reminders`);
          const newListRaw = newRes.ok ? await newRes.json() : [];
          const newList = Array.isArray(newListRaw) ? newListRaw : [];
          const withoutSame = newList.filter((item) => item.id !== r.id);
          withoutSame.push(updated);
          const saveRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(newPhone)}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminders: withoutSame })
          });
          if (!saveRes.ok) throw new Error('Failed to save');
        } else {
          // Same user: update in place
          const listRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(oldPhone)}/reminders`);
          const list = listRes.ok ? await listRes.json() : [];
          if (!Array.isArray(list)) throw new Error('Invalid response');
          const idx = list.findIndex((item) => item.id === r.id);
          if (idx < 0) throw new Error('Reminder not found');
          list[idx] = updated;
          const saveRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(oldPhone)}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminders: list })
          });
          if (!saveRes.ok) throw new Error('Failed to save');
        }
        toast.success('התור עודכן בהצלחה');
        close();
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) {
        console.error('Failed to save reminder:', err);
        toast.error(`שגיאה בשמירה: ${err.message || 'שגיאה לא ידועה'}`);
      }
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const firstInput = overlay.querySelector(isManual ? '#edit-reminder-name' : '#edit-reminder-time');
    if (firstInput) firstInput.focus();
  };

  // Get meetings for a specific date
  const getMeetingsForDate = (date) => {
    const dateStr = formatDateString(date);
    return meetings.filter(meeting => meeting.date === dateStr);
  };

  // Edit and Delete button click (event delegation for week view meeting items)
  contentContainer.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".meeting-edit-btn");
    if (editBtn) {
      const item = editBtn.closest(".meeting-item");
      if (!item) return;
      const reminderId = item.dataset.reminderId;
      const phone = item.dataset.phone;
      const meeting = meetings.find(m => m.phoneNumber === phone && (m.reminder?.id ?? m.id) === reminderId);
      if (meeting) {
        e.preventDefault();
        e.stopPropagation();
        showEditReminderModal(meeting, () => loadAndRender());
      }
      return;
    }
    const deleteBtn = e.target.closest(".meeting-delete-btn");
    if (!deleteBtn) return;
    const item = deleteBtn.closest(".meeting-item");
    if (!item) return;
    const reminderId = item.dataset.reminderId;
    const phone = item.dataset.phone;
    if (reminderId && phone) {
      e.preventDefault();
      e.stopPropagation();
      deleteReminderFromCalendar(phone, reminderId);
    }
  });

  // Tab click handlers
  tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      
      // Reset to current month when switching to month view
      if (currentView === 'month') {
        currentDate = getCurrentDate();
      }
      
      render();
    });
  });

  // Refresh button handler
  const refreshBtn = header.querySelector('.refresh-meeting-calendar-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      // Add spinning animation
      refreshBtn.style.transform = 'rotate(360deg)';
      refreshBtn.style.transition = 'transform 0.5s ease';
      
      // Reload data
      await loadAndRender();
      
      // Reset animation after a short delay
      setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
      }, 500);
    });
  }

  // Google Calendar: status, connect, disconnect
  const apiBase = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : `${window.location.protocol}//${window.location.hostname}:5000`;

  const updateGoogleCalendarUI = async () => {
    const container = header.querySelector('#googleCalendarActions');
    if (!container) return;
    try {
      const r = await fetch(`${apiBase}/api/google-calendar/status`);
      const data = await r.json();
      const connected = data.connected === true;
      const configured = data.configured === true;
      if (connected) {
        container.innerHTML = `
          <span class="google-calendar-status connected">מחובר ליומן גוגל</span>
          <button type="button" class="google-calendar-disconnect-btn" id="googleCalendarDisconnectBtn" title="התנתקות">התנתק</button>
        `;
        container.querySelector('#googleCalendarDisconnectBtn').addEventListener('click', async () => {
          try {
            await fetch(`${apiBase}/api/google-calendar/disconnect`, { method: 'POST' });
            await updateGoogleCalendarUI();
          } catch (e) {
            console.error('Google Calendar disconnect:', e);
          }
        });
      } else {
        container.innerHTML = `
          <button type="button" class="google-calendar-connect-btn" id="googleCalendarConnectBtn" title="התחברות ליומן גוגל">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="18" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
            <span>ממשקות ליומן גוגל</span>
          </button>
        `;
        if (!configured) {
          const btn = container.querySelector('#googleCalendarConnectBtn');
          if (btn) btn.title = 'לא מוגדר – הוסף קובץ credentials ב-config';
        }
        container.querySelector('#googleCalendarConnectBtn').addEventListener('click', async () => {
          try {
            const res = await fetch(`${apiBase}/api/google-calendar/auth-url?base_url=${encodeURIComponent(apiBase)}`);
            const json = await res.json();
            if (json.url) {
              const popup = window.open(json.url, 'google_calendar_auth', 'width=520,height=600');
              const onMessage = (e) => {
                if (e.data === 'google_calendar_connected') {
                  window.removeEventListener('message', onMessage);
                  if (popup && !popup.closed) popup.close();
                  updateGoogleCalendarUI();
                }
              };
              window.addEventListener('message', onMessage);
              const closer = setInterval(() => {
                if (popup && popup.closed) {
                  clearInterval(closer);
                  window.removeEventListener('message', onMessage);
                  updateGoogleCalendarUI();
                }
              }, 500);
            } else {
              alert(json.error === 'credentials_missing' ? 'לא הוגדר קובץ התחברות. הוסף config/google-calendar-credentials.json (על בסיס הקובץ .example).' : (json.error || 'שגיאה'));
            }
          } catch (e) {
            console.error('Google Calendar auth:', e);
            alert('שגיאה בפתיחת חלון ההתחברות.');
          }
        });
      }
    } catch (e) {
      container.innerHTML = `<button type="button" class="google-calendar-connect-btn" id="googleCalendarConnectBtn" disabled title="שגיאה בטעינת סטטוס"><span>ממשקות ליומן גוגל</span></button>`;
    }
  };

  updateGoogleCalendarUI();

  // Close button handler
  header.querySelector('.close-meeting-calendar-btn').addEventListener('click', () => {
    stopAutoRefresh();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    });
  });

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(tabsContainer);
  panel.appendChild(contentContainer);

  // Initial render (will be updated when reminders load)
  render();

  // On mobile, append to body for fixed positioning
  // On desktop, append to chat area
  if (isMobileDevice) {
    document.body.appendChild(panel);
    // Hide contacts sidebar
    showChatArea();
  } else {
    chatArea.appendChild(panel);
  }
  
  // Return panel for potential external updates
  return panel;
}

/**
 * Load reminders from server and convert them to meetings format
 * @returns {Promise<Array>} Array of meeting objects
 */
async function loadRemindersFromServer() {
  const API_URL = window.location.hostname === "localhost" 
    ? "http://localhost:5000" 
    : `${window.location.protocol}//${window.location.hostname}:5000`;

  try {
    // Get all reminders from all users
    const response = await fetch(`${API_URL}/api/reminders/all`);
    
    if (!response.ok) {
      console.warn("Could not load reminders:", response.statusText);
      return [];
    }

    const allReminders = await response.json();
    const meetings = [];
    const today = getCurrentDate();
    
    // Get contacts to map phone numbers to names
    const contactsResponse = await fetch(`${API_URL}/api/contacts/json`);
    let contactsMap = {};
    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      if (contactsData.contacts && Array.isArray(contactsData.contacts)) {
        contactsData.contacts.forEach(contact => {
          contactsMap[contact.phone] = contact.name;
        });
      }
    }

    // Process reminders from all users
    // Calculate end date (60 days from today to cover both week and month views)
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 60);
    endDate.setHours(23, 59, 59, 999);
    
    const MANUAL_PHONE = '__manual__';
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) continue;

      userReminders.forEach(reminder => {
        const contactName = (phoneNumber === MANUAL_PHONE && reminder.clientName) ? reminder.clientName : (contactsMap[phoneNumber] || phoneNumber);
        if (!reminder.time) return;
        
        // Parse time
        const timeParts = parseTime(reminder.time);
        if (!timeParts) return;
        
        const [hours, minutes] = timeParts;
        
        // Check if reminder has a specific date (date mode)
        if (reminder.date) {
          // Handle specific date reminder
          const dateObj = parseDateString(reminder.date);
          if (!dateObj) return;
          
          const reminderDate = new Date(dateObj);
          reminderDate.setHours(hours, minutes, 0, 0);
          
          // Only include if date (without time) is today or in the future and within our period
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);
          const reminderDateOnly = new Date(reminderDate);
          reminderDateOnly.setHours(0, 0, 0, 0);
          
          if (reminderDateOnly >= todayStart && reminderDate <= endDate) {
            const isAppointment = reminder.title === 'פגישה' || reminder.categoryId;
            const serviceLabel = reminder.categoryId ? reminder.title : (reminder.title || 'פגישה');
            const label = isAppointment ? serviceLabel : 'תזכורת';
            meetings.push({
              id: reminder.id,
              date: formatDateString(reminderDate),
              time: reminder.time,
              title: `${contactName} - ${label}`,
              location: null,
              description: isAppointment ? 'תור שנקבע' : (reminder.type === 'recurring' ? 'תזכורת קבועה' : 'תזכורת חד פעמית'),
              duration: reminder.duration || 60,
              categoryId: reminder.categoryId || null,
              color: isAppointment ? '#1565c0' : (reminder.type === 'recurring' ? '#007025' : '#00a855'),
              phoneNumber: phoneNumber,
              reminder: reminder
            });
          }
          return; // Skip day-of-week processing for specific date reminders
        }
        
        // Handle day-of-week reminders (legacy or when no specific date)
        if (!reminder.day) return;
        
        // Get day index from Hebrew day name
        const dayIndex = getDayIndex(reminder.day);
        if (dayIndex === null) return;
        
        if (reminder.type === 'recurring') {
          // For recurring reminders, calculate all occurrences in the period
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);
          
          let reminderDate = getNextDayOfWeek(today, dayIndex);
          reminderDate.setHours(hours, minutes, 0, 0);
          
          // If the first occurrence date (without time) is before today, get next week's occurrence
          const firstDateOnly = new Date(reminderDate);
          firstDateOnly.setHours(0, 0, 0, 0);
          if (firstDateOnly < todayStart) {
            reminderDate = new Date(reminderDate);
            reminderDate.setDate(reminderDate.getDate() + 7);
          }
          
          // Generate all occurrences up to endDate
          while (reminderDate <= endDate) {
            // Only include if date (without time) is today or in the future
            const dateOnly = new Date(reminderDate);
            dateOnly.setHours(0, 0, 0, 0);
            if (dateOnly >= todayStart) {
              meetings.push({
                id: `${reminder.id}-${formatDateString(reminderDate)}`,
                date: formatDateString(reminderDate),
                time: reminder.time,
                title: `${contactName} - תזכורת`,
                location: null,
                description: 'תזכורת קבועה',
                duration: reminder.duration || 60,
                color: '#007025',
                phoneNumber: phoneNumber,
                reminder: reminder
              });
            }
            // Move to next week
            reminderDate = new Date(reminderDate);
            reminderDate.setDate(reminderDate.getDate() + 7);
          }
        } else {
          // For one-time reminders, check if there's a scheduled date
          let reminderDate;
          if (reminder.mainReminderStatus && reminder.mainReminderStatus.scheduledFor) {
            reminderDate = new Date(reminder.mainReminderStatus.scheduledFor);
            reminderDate.setHours(hours, minutes, 0, 0);
          } else {
            // Fallback to next occurrence
            reminderDate = getNextDayOfWeek(today, dayIndex);
            reminderDate.setHours(hours, minutes, 0, 0);
          }
          
          // Only include if date (without time) is today or in the future and within our period
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);
          const reminderDateOnly = new Date(reminderDate);
          reminderDateOnly.setHours(0, 0, 0, 0);
          
          if (reminderDateOnly >= todayStart && reminderDate <= endDate) {
            meetings.push({
              id: reminder.id,
              date: formatDateString(reminderDate),
              time: reminder.time,
              title: `${contactName} - תזכורת`,
              location: null,
              description: 'תזכורת חד פעמית',
              duration: reminder.duration || 60,
              color: '#00a855',
              phoneNumber: phoneNumber,
              reminder: reminder
            });
          }
        }
      });
    }
    
    // Sort by date and time
    meetings.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA - dateB;
    });
    
    return meetings;
  } catch (error) {
    console.error("Failed to load reminders:", error);
    return [];
  }
}

