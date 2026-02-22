// Appointments list in contacts sidebar – today's appointments, past/upcoming, edit popup

import { formatDateString, getCurrentDate, parseTime, parseDateString, getDayIndex, getNextDayOfWeek } from '../../utils/dateUtils.js';
import { DAYS_OF_WEEK } from '../../config/reminderTemplates.js';

const PAST_THRESHOLD_MINUTES = 30;

/**
 * Load today's appointments from API (same data source as meeting calendar)
 * @returns {Promise<Array<{ meeting: object, isPast: boolean }>>}
 */
export async function loadTodayAppointments() {
  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : `${window.location.protocol}//${window.location.hostname}:5000`;
  const today = getCurrentDate();
  const todayStr = formatDateString(today);
  const now = today.getTime();

  try {
    const [remindersRes, contactsRes] = await Promise.all([
      fetch(`${API_URL}/api/reminders/all`),
      fetch(`${API_URL}/api/contacts/json`)
    ]);
    if (!remindersRes.ok) return [];
    const allReminders = await remindersRes.json();
    let contactsMap = {};
    if (contactsRes.ok) {
      const contactsData = await contactsRes.json();
      if (contactsData.contacts && Array.isArray(contactsData.contacts)) {
        contactsData.contacts.forEach((c) => { contactsMap[c.phone] = c.name; });
      }
    }

    const MANUAL_PHONE = '__manual__';
    const meetings = [];
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) continue;

      for (const reminder of userReminders) {
        const contactName = (phoneNumber === MANUAL_PHONE && reminder.clientName) ? reminder.clientName : (contactsMap[phoneNumber] || phoneNumber);
        if (!reminder.time) continue;
        const timeParts = parseTime(reminder.time);
        if (!timeParts) continue;
        const [hours, minutes] = timeParts;

        let meetingDateStr = null;
        let meetingDateTime = null;

        if (reminder.date) {
          const dateObj = parseDateString(reminder.date);
          if (!dateObj) continue;
          const d = new Date(dateObj);
          d.setHours(hours, minutes, 0, 0);
          meetingDateStr = formatDateString(d);
          meetingDateTime = d;
        } else if (reminder.day) {
          const dayIndex = getDayIndex(reminder.day);
          if (dayIndex === null) continue;
          let reminderDate = getNextDayOfWeek(today, dayIndex);
          reminderDate.setHours(hours, minutes, 0, 0);
          const dateOnly = new Date(reminderDate);
          dateOnly.setHours(0, 0, 0, 0);
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);
          if (dateOnly.getTime() < todayStart.getTime()) {
            reminderDate = new Date(reminderDate);
            reminderDate.setDate(reminderDate.getDate() + 7);
          }
          meetingDateStr = formatDateString(reminderDate);
          meetingDateTime = new Date(reminderDate);
        } else continue;

        if (meetingDateStr !== todayStr) continue;

        const isAppointment = reminder.title === 'פגישה' || reminder.categoryId;
        const serviceLabel = reminder.categoryId ? reminder.title : (reminder.title || 'פגישה');
        const label = isAppointment ? serviceLabel : 'תזכורת';
        const endTime = new Date(meetingDateTime);
        endTime.setMinutes(endTime.getMinutes() + PAST_THRESHOLD_MINUTES);
        const isPast = endTime.getTime() < now || !!(reminder.completedAt);

        meetings.push({
          id: reminder.date ? reminder.id : `${reminder.id}-${meetingDateStr}`,
          reminderId: reminder.id,
          date: meetingDateStr,
          time: reminder.time,
          title: `${contactName} - ${label}`,
          duration: reminder.duration || 60,
          phoneNumber,
          reminder,
          isPast
        });
      }
    }

    meetings.sort((a, b) => {
      const tA = new Date(`${a.date}T${a.time}`).getTime();
      const tB = new Date(`${b.date}T${b.time}`).getTime();
      return tA - tB;
    });
    return meetings;
  } catch (e) {
    console.error('Failed to load today appointments:', e);
    return [];
  }
}

/**
 * Render appointments list in #appointmentsList; respect sub-tab (upcoming / past)
 * @param {Array} appointments - from loadTodayAppointments
 * @param {'upcoming'|'past'} subtab
 */
const MANUAL_PHONE = '__manual__';

export function renderAppointmentsList(appointments, subtab) {
  const listEl = document.getElementById('appointmentsList');
  if (!listEl) return;
  const filtered = subtab === 'past'
    ? appointments.filter((a) => a.isPast)
    : appointments.filter((a) => !a.isPast);

  const addButtonHtml = `
    <div class="appointments-add-manual-row">
      <button type="button" class="appointments-add-manual-btn" aria-label="הוסף תור ידנית">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        הוסף תור ידנית
      </button>
    </div>`;

  if (filtered.length === 0) {
    listEl.innerHTML = addButtonHtml + `
      <div class="appointments-empty">
        ${subtab === 'past' ? 'אין תורים שעברו להיום' : 'אין תורים הבאים להיום'}
      </div>
    `;
    listEl.querySelector('.appointments-add-manual-btn').addEventListener('click', () => openAddManualPopup(() => refreshAppointmentsView()));
    return;
  }

  listEl.innerHTML = addButtonHtml + filtered
    .map(
      (a) => `
    <div class="appointment-card" data-reminder-id="${a.reminderId}" data-phone="${a.phoneNumber}">
      <div class="appointment-card-main">
        <div class="appointment-time">${a.time}</div>
        <div class="appointment-title">${a.title}</div>
        ${a.reminder.notes ? `<div class="appointment-notes">${escapeHtml(a.reminder.notes)}</div>` : ''}
      </div>
      <button type="button" class="appointment-edit-btn" aria-label="ערוך תור" title="עריכה">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    </div>
  `
    )
    .join('');

  listEl.querySelector('.appointments-add-manual-btn').addEventListener('click', () => openAddManualPopup(() => refreshAppointmentsView()));
  listEl.querySelectorAll('.appointment-edit-btn').forEach((btn) => {
    const card = btn.closest('.appointment-card');
    if (!card) return;
    const reminderId = card.dataset.reminderId;
    const phone = card.dataset.phone;
    const appointment = filtered.find((a) => a.phoneNumber === phone && a.reminderId === reminderId);
    if (appointment) {
      btn.addEventListener('click', () => openEditPopup(appointment, () => refreshAppointmentsView()));
    }
  });
}

/**
 * Open popup to add a manual appointment (no phone number).
 * Required: name, time, duration, and date (by day of week or exact date).
 * Optional: title, notes. Duration is free (any minutes).
 */
function openAddManualPopup(onSave) {
  const today = getCurrentDate();
  const todayStr = formatDateString(today);
  const dayOptions = DAYS_OF_WEEK.map((d) => `<option value="${escapeHtml(d.label)}">${escapeHtml(d.label)}</option>`).join('');
  const overlay = document.createElement('div');
  overlay.className = 'appointment-edit-overlay';
  overlay.innerHTML = `
    <div class="appointment-edit-popup appointment-add-manual-popup" role="dialog" aria-label="הוספת תור ידנית">
      <div class="appointment-edit-header">
        <h3>הוסף תור ידנית</h3>
        <button type="button" class="appointment-edit-close" aria-label="סגור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="appointment-edit-body">
        <label for="add-manual-name">שם *</label>
        <input type="text" id="add-manual-name" placeholder="שם הלקוח / המטופל" required />
        <label for="add-manual-time">שעה *</label>
        <input type="time" id="add-manual-time" required />
        <label for="add-manual-duration">משך (דקות) *</label>
        <input type="number" id="add-manual-duration" min="1" step="1" value="60" required />
        <fieldset class="add-manual-date-mode">
          <legend>תאריך *</legend>
          <label class="add-manual-radio-label">
            <input type="radio" name="add-manual-datemode" value="day" checked />
            לפי יום בשבוע
          </label>
          <label class="add-manual-radio-label">
            <input type="radio" name="add-manual-datemode" value="date" />
            לפי תאריך מדויק
          </label>
          <div class="add-manual-date-by-day">
            <label for="add-manual-day">יום</label>
            <select id="add-manual-day">${dayOptions}</select>
          </div>
          <div class="add-manual-date-by-date hidden">
            <label for="add-manual-date">תאריך</label>
            <input type="date" id="add-manual-date" min="${todayStr}" />
          </div>
        </fieldset>
        <label for="add-manual-title">שירות / כותרת</label>
        <input type="text" id="add-manual-title" placeholder="פגישה" value="פגישה" />
        <label for="add-manual-notes">הערות</label>
        <textarea id="add-manual-notes" rows="3" placeholder="הערות..."></textarea>
      </div>
      <div class="appointment-edit-actions">
        <button type="button" class="appointment-edit-save-notes appointment-add-manual-submit">הוסף תור</button>
      </div>
    </div>
  `;

  const popup = overlay.querySelector('.appointment-edit-popup');
  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };

  const byDay = overlay.querySelector('.add-manual-date-by-day');
  const byDate = overlay.querySelector('.add-manual-date-by-date');
  overlay.querySelectorAll('input[name="add-manual-datemode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isDay = overlay.querySelector('input[name="add-manual-datemode"]:checked').value === 'day';
      byDay.classList.toggle('hidden', !isDay);
      byDate.classList.toggle('hidden', isDay);
    });
  });
  byDate.classList.add('hidden');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.appointment-edit-close').addEventListener('click', close);

  overlay.querySelector('.appointment-add-manual-submit').addEventListener('click', async () => {
    const nameInput = overlay.querySelector('#add-manual-name');
    const timeInput = overlay.querySelector('#add-manual-time');
    const durationInput = overlay.querySelector('#add-manual-duration');
    const dateInput = overlay.querySelector('#add-manual-date');
    const daySelect = overlay.querySelector('#add-manual-day');
    const titleInput = overlay.querySelector('#add-manual-title');
    const notesInput = overlay.querySelector('#add-manual-notes');
    const name = nameInput.value.trim();
    const time = timeInput.value.trim();
    const durationVal = Number(durationInput.value);
    const duration = Number.isFinite(durationVal) && durationVal >= 1 ? Math.round(durationVal) : 60;
    const dateMode = overlay.querySelector('input[name="add-manual-datemode"]:checked').value;
    const dateStr = dateInput.value.trim();
    const dayStr = daySelect.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    if (!time) {
      timeInput.focus();
      return;
    }
    if (dateMode === 'date' && !dateStr) {
      dateInput.focus();
      return;
    }
    const newReminder = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time,
      duration,
      title: titleInput.value.trim() || 'פגישה',
      notes: notesInput.value.trim(),
      clientName: name
    };
    if (dateMode === 'date') {
      newReminder.date = dateStr;
      newReminder.day = '';
    } else {
      newReminder.day = dayStr;
      newReminder.date = null;
    }

    const API_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : `${window.location.protocol}//${window.location.hostname}:5000`;
    try {
      const existingRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(MANUAL_PHONE)}/reminders`);
      const existing = existingRes.ok ? await existingRes.json() : [];
      const list = Array.isArray(existing) ? existing : [];
      list.push(newReminder);
      const saveRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(MANUAL_PHONE)}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: list })
      });
      if (saveRes.ok) {
        close();
        if (typeof onSave === 'function') onSave();
      } else {
        const err = await saveRes.json().catch(() => ({}));
        console.error('Failed to add manual appointment:', err);
      }
    } catch (err) {
      console.error('Failed to add manual appointment:', err);
    }
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.querySelector('#add-manual-name').focus();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Open popup to edit appointment: all params (name if manual, time, duration, date, title, notes) and "move to past"
 * @param {Object} appointment - one item from loadTodayAppointments
 * @param {Function} onSave - callback after save (e.g. refresh list)
 */
export function openEditPopup(appointment, onSave) {
  const r = appointment.reminder || {};
  const hasDate = r.date && String(r.date).trim();
  const dateMode = hasDate ? 'date' : 'day';
  const todayStr = formatDateString(getCurrentDate());
  const dayOptions = DAYS_OF_WEEK.map((d) => `<option value="${escapeHtml(d.label)}" ${r.day === d.label ? 'selected' : ''}>${escapeHtml(d.label)}</option>`).join('');
  const isManual = appointment.phoneNumber === MANUAL_PHONE;
  const nameBlock = isManual
    ? `
        <label for="edit-appointment-name">שם *</label>
        <input type="text" id="edit-appointment-name" value="${escapeHtml(r.clientName || '')}" required />
      `
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'appointment-edit-overlay';
  overlay.innerHTML = `
    <div class="appointment-edit-popup appointment-edit-full-popup" role="dialog" aria-label="עריכת תור">
      <div class="appointment-edit-header">
        <h3>עריכת תור</h3>
        <button type="button" class="appointment-edit-close" aria-label="סגור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="appointment-edit-body">
        ${nameBlock}
        <label for="edit-appointment-time">שעה *</label>
        <input type="time" id="edit-appointment-time" value="${escapeHtml(r.time || '')}" required />
        <label for="edit-appointment-duration">משך (דקות) *</label>
        <input type="number" id="edit-appointment-duration" min="1" step="1" value="${r.duration != null ? r.duration : 60}" required />
        <fieldset class="add-manual-date-mode">
          <legend>תאריך *</legend>
          <label class="add-manual-radio-label">
            <input type="radio" name="edit-datemode" value="day" ${dateMode === 'day' ? 'checked' : ''} />
            לפי יום בשבוע
          </label>
          <label class="add-manual-radio-label">
            <input type="radio" name="edit-datemode" value="date" ${dateMode === 'date' ? 'checked' : ''} />
            לפי תאריך מדויק
          </label>
          <div class="add-manual-date-by-day ${dateMode === 'date' ? 'hidden' : ''}">
            <label for="edit-appointment-day">יום</label>
            <select id="edit-appointment-day">${dayOptions}</select>
          </div>
          <div class="add-manual-date-by-date ${dateMode === 'day' ? 'hidden' : ''}">
            <label for="edit-appointment-date">תאריך</label>
            <input type="date" id="edit-appointment-date" min="${todayStr}" value="${hasDate ? escapeHtml(r.date) : ''}" />
          </div>
        </fieldset>
        <label for="edit-appointment-title">שירות / כותרת</label>
        <input type="text" id="edit-appointment-title" value="${escapeHtml(r.title || 'פגישה')}" placeholder="פגישה" />
        <label for="edit-appointment-notes">הערות</label>
        <textarea id="edit-appointment-notes" rows="3" placeholder="הערות...">${escapeHtml(r.notes || '')}</textarea>
      </div>
      <div class="appointment-edit-actions">
        <button type="button" class="appointment-edit-save-notes">שמור שינויים</button>
        ${!appointment.isPast ? '<button type="button" class="appointment-edit-move-past">העבר לתורים שעברו</button>' : ''}
      </div>
    </div>
  `;

  const popup = overlay.querySelector('.appointment-edit-popup');
  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };

  const byDayEl = overlay.querySelector('.add-manual-date-by-day');
  const byDateEl = overlay.querySelector('.add-manual-date-by-date');
  overlay.querySelectorAll('input[name="edit-datemode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isDay = overlay.querySelector('input[name="edit-datemode"]:checked').value === 'day';
      byDayEl.classList.toggle('hidden', !isDay);
      byDateEl.classList.toggle('hidden', isDay);
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.appointment-edit-close').addEventListener('click', close);

  overlay.querySelector('.appointment-edit-save-notes').addEventListener('click', async () => {
    const nameInput = overlay.querySelector('#edit-appointment-name');
    const timeInput = overlay.querySelector('#edit-appointment-time');
    const durationInput = overlay.querySelector('#edit-appointment-duration');
    const daySelect = overlay.querySelector('#edit-appointment-day');
    const dateInput = overlay.querySelector('#edit-appointment-date');
    const titleInput = overlay.querySelector('#edit-appointment-title');
    const notesInput = overlay.querySelector('#edit-appointment-notes');
    const time = timeInput.value.trim();
    const durationVal = Number(durationInput.value);
    const duration = Number.isFinite(durationVal) && durationVal >= 1 ? Math.round(durationVal) : 60;
    const dateMode = overlay.querySelector('input[name="edit-datemode"]:checked').value;
    const dateStr = dateInput.value.trim();
    const dayStr = daySelect.value.trim();
    if (!time) {
      timeInput.focus();
      return;
    }
    if (isManual && nameInput) {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
    }
    if (dateMode === 'date' && !dateStr) {
      dateInput.focus();
      return;
    }
    const API_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : `${window.location.protocol}//${window.location.hostname}:5000`;
    try {
      const listRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(appointment.phoneNumber)}/reminders`);
      const list = listRes.ok ? await listRes.json() : [];
      if (!Array.isArray(list)) {
        console.error('Invalid reminders response');
        return;
      }
      const idx = list.findIndex((item) => item.id === appointment.reminderId);
      if (idx < 0) {
        console.error('Reminder not found');
        return;
      }
      const existing = list[idx];
      const updated = {
        ...existing,
        time,
        duration,
        title: titleInput.value.trim() || 'פגישה',
        notes: notesInput.value.trim(),
        date: dateMode === 'date' ? dateStr : null,
        day: dateMode === 'day' ? dayStr : ''
      };
      if (isManual && nameInput) {
        updated.clientName = nameInput.value.trim();
      }
      list[idx] = updated;
      const saveRes = await fetch(`${API_URL}/api/users/${encodeURIComponent(appointment.phoneNumber)}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: list })
      });
      if (saveRes.ok) {
        close();
        if (typeof onSave === 'function') onSave();
      } else {
        const err = await saveRes.json().catch(() => ({}));
        console.error('Failed to save appointment:', err);
      }
    } catch (err) {
      console.error('Failed to save appointment:', err);
    }
  });

  const movePastBtn = overlay.querySelector('.appointment-edit-move-past');
  if (movePastBtn) {
    movePastBtn.addEventListener('click', async () => {
      const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : `${window.location.protocol}//${window.location.hostname}:5000`;
      try {
        const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(appointment.phoneNumber)}/reminders/${encodeURIComponent(appointment.reminderId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completedAt: true })
        });
        if (res.ok) {
          close();
          if (typeof onSave === 'function') onSave();
        }
      } catch (err) {
        console.error('Failed to move to past:', err);
      }
    });
  }

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const firstInput = overlay.querySelector(isManual ? '#edit-appointment-name' : '#edit-appointment-time');
  if (firstInput) firstInput.focus();
}

/**
 * Refresh appointments view (reload and re-render according to current sub-tab)
 */
export function refreshAppointmentsView() {
  const subtabEl = document.querySelector('.appointments-sub-tab.active');
  const subtab = subtabEl ? subtabEl.dataset.subtab : 'upcoming';
  loadTodayAppointments().then((list) => {
    renderAppointmentsList(list, subtab);
  });
}
