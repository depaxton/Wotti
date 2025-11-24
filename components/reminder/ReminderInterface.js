import { REMINDER_TEMPLATE, DAYS_OF_WEEK } from '../../config/reminderTemplates.js';
import { toast } from '../toast/Toast.js';
import { formatDateHebrew } from '../../utils/dateUtils.js';

export function createReminderInterface(contact) {
  const container = document.createElement('div');
  container.className = 'reminder-container';

  // State
  let state = {
    dateMode: 'day-of-week', // 'day-of-week' or 'specific-date'
    selectedDay: null,
    selectedDate: null,
    selectedTime: '',
    reminderType: 'one-time'
  };

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'reminder-header';
  header.innerHTML = `
    <h2>תזכורת חדשה</h2>
    <p>יצירת תזכורת עבור <strong>${contact.name}</strong></p>
  `;
  container.appendChild(header);

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
      updatePreview();
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
    updatePreview();
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
    updatePreview();
  };
  
  specificDateBtn.onclick = () => {
    specificDateBtn.classList.add('selected');
    dayOfWeekBtn.classList.remove('selected');
    daysGrid.style.display = 'none';
    datePickerContainer.style.display = 'block';
    state.dateMode = 'specific-date';
    state.selectedDay = null;
    updatePreview();
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
    updatePreview();
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

  // --- Preview Window ---
  const previewSection = document.createElement('div');
  previewSection.className = 'reminder-section';
  previewSection.innerHTML = `<div class="section-label">תצוגה מקדימה</div>`;
  
  const previewBox = document.createElement('div');
  previewBox.className = 'preview-box';
  
  const previewText = document.createElement('div');
  previewText.className = 'preview-text';
  
  previewBox.appendChild(previewText);
  previewSection.appendChild(previewBox);
  container.appendChild(previewSection);

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
  
  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-send';
  sendBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
    שלח עכשיו
  `;
  
  sendBtn.onclick = () => {
    const hasValidDate = (state.dateMode === 'day-of-week' && state.selectedDay) || 
                         (state.dateMode === 'specific-date' && state.selectedDate);
    
    if (!hasValidDate || !state.selectedTime) {
      // Shake animation or visual feedback for error
      previewBox.style.transform = 'translateX(5px)';
      setTimeout(() => previewBox.style.transform = 'translateX(-5px)', 50);
      setTimeout(() => previewBox.style.transform = 'none', 100);
      return;
    }
    // TODO: Implement actual sending logic
    console.log('Sending reminder:', { ...state, contact: contact.name });
    
    const dateDisplay = state.dateMode === 'day-of-week' 
      ? `יום ${state.selectedDay}` 
      : formatDateHebrew(state.selectedDate);
    
    toast.success(`התזכורת נקבעה ל-${dateDisplay} בשעה ${state.selectedTime}`);
  };
  
  actionsRow.appendChild(saveBtn);
  actionsRow.appendChild(sendBtn);
  container.appendChild(actionsRow);

  // Helper to update preview text
  function updatePreview() {
    const hasValidDate = (state.dateMode === 'day-of-week' && state.selectedDay) || 
                         (state.dateMode === 'specific-date' && state.selectedDate);
    
    if (hasValidDate && state.selectedTime) {
      let dayDisplay;
      if (state.dateMode === 'day-of-week') {
        dayDisplay = `יום ${state.selectedDay}`;
      } else {
        dayDisplay = formatDateHebrew(state.selectedDate);
      }
      
      const filledTemplate = REMINDER_TEMPLATE
        .replace('{name}', contact.name)
        .replace('{day}', dayDisplay)
        .replace('{time}', state.selectedTime);
      previewText.textContent = filledTemplate;
      previewText.classList.remove('preview-placeholder');
    } else {
      previewText.textContent = 'בחר יום ושעה כדי לראות את התצוגה המקדימה...';
      previewText.classList.add('preview-placeholder');
    }
  }

  // Initialize preview
  updatePreview();

  return container;
}
