// Appointments list in contacts sidebar – today's appointments, past/upcoming, edit popup

import { formatDateString, getCurrentDate, parseTime, parseDateString, getDayIndex, getNextDayOfWeek } from '../../utils/dateUtils.js';

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

    const meetings = [];
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) continue;
      const contactName = contactsMap[phoneNumber] || phoneNumber;

      for (const reminder of userReminders) {
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
export function renderAppointmentsList(appointments, subtab) {
  const listEl = document.getElementById('appointmentsList');
  if (!listEl) return;
  const filtered = subtab === 'past'
    ? appointments.filter((a) => a.isPast)
    : appointments.filter((a) => !a.isPast);

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="appointments-empty">
        ${subtab === 'past' ? 'אין תורים שעברו להיום' : 'אין תורים הבאים להיום'}
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Open popup to edit appointment: notes and "move to past"
 * @param {Object} appointment - one item from loadTodayAppointments
 * @param {Function} onSave - callback after save (e.g. refresh list)
 */
export function openEditPopup(appointment, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'appointment-edit-overlay';
  const notes = (appointment.reminder && appointment.reminder.notes) || '';
  overlay.innerHTML = `
    <div class="appointment-edit-popup" role="dialog" aria-label="עריכת תור">
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
        <p class="appointment-edit-info">${escapeHtml(appointment.title)} – ${appointment.time}</p>
        <label for="appointment-edit-notes">הערות</label>
        <textarea id="appointment-edit-notes" rows="3" placeholder="הוסף הערות...">${escapeHtml(notes)}</textarea>
      </div>
      <div class="appointment-edit-actions">
        <button type="button" class="appointment-edit-save-notes">שמור הערות</button>
        ${!appointment.isPast ? '<button type="button" class="appointment-edit-move-past">העבר לתורים שעברו</button>' : ''}
      </div>
    </div>
  `;

  const popup = overlay.querySelector('.appointment-edit-popup');
  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.appointment-edit-close').addEventListener('click', close);

  overlay.querySelector('.appointment-edit-save-notes').addEventListener('click', async () => {
    const newNotes = overlay.querySelector('#appointment-edit-notes').value.trim();
    const API_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : `${window.location.protocol}//${window.location.hostname}:5000`;
    try {
      const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(appointment.phoneNumber)}/reminders/${encodeURIComponent(appointment.reminderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes })
      });
      if (res.ok) {
        close();
        if (typeof onSave === 'function') onSave();
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
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
  popup.querySelector('#appointment-edit-notes').focus();
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
