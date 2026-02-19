/**
 * Business Hours (שעות פעילות עסק) - Component
 * Manages weekly business hours: open/closed per day, time ranges, and breaks.
 * Internal state: { baseShift: { start, end }, breaks: [{ start, end }, ...] } per day.
 * Saved format: array of continuous ranges per day (breaks "cut out" from baseShift).
 * Data is persisted locally via API (data/business_hours.json).
 */

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : `${window.location.protocol}//${window.location.hostname}:5000`;

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const DAY_LABELS = {
  sunday: "יום ראשון",
  monday: "יום שני",
  tuesday: "יום שלישי",
  wednesday: "יום רביעי",
  thursday: "יום חמישי",
  friday: "יום שישי",
  saturday: "יום שבת"
};

const DEFAULT_HOURS = { start: "09:00", end: "17:00" };

/**
 * Convert saved ranges array to internal state (baseShift + breaks).
 * e.g. [{ start: "14:00", end: "16:00" }, { start: "18:00", end: "20:00" }] → baseShift 14-20, breaks [{ 16-18 }]
 */
function rangesToInternal(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return null;
  const sorted = [...ranges].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const baseShift = { start: sorted[0].start, end: sorted[sorted.length - 1].end };
  const breaks = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    breaks.push({ start: sorted[i].end, end: sorted[i + 1].start });
  }
  return { baseShift, breaks };
}

/**
 * "Cut out" breaks from base shift → array of continuous activity ranges (for save).
 * e.g. baseShift 14:00-20:00, breaks [{ 16:00-18:00 }] → [{ 14:00-16:00 }, { 18:00-20:00 }]
 */
function internalToRanges(baseShift, breaks) {
  if (!baseShift || !baseShift.start || !baseShift.end) return [];
  let segments = [{ start: baseShift.start, end: baseShift.end }];
  const baseStart = baseShift.start;
  const baseEnd = baseShift.end;
  const validBreaks = (breaks || []).filter(
    (b) => b && b.start && b.end && b.start < b.end && b.start >= baseStart && b.end <= baseEnd
  );
  for (const br of validBreaks) {
    const next = [];
    for (const seg of segments) {
      if (br.end <= seg.start || br.start >= seg.end) {
        next.push(seg);
        continue;
      }
      if (br.start > seg.start) next.push({ start: seg.start, end: br.start });
      if (br.end < seg.end) next.push({ start: br.end, end: seg.end });
    }
    segments = next;
  }
  return segments.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

/**
 * Check if a break is within base shift (for validation)
 */
function isBreakWithinBase(baseShift, breakRange) {
  if (!baseShift || !breakRange) return false;
  const b = baseShift.start;
  const e = baseShift.end;
  return breakRange.start >= b && breakRange.end <= e && breakRange.start < breakRange.end;
}

/** Check if two time ranges overlap (a.start < b.end && b.start < a.end) */
function rangesOverlap(a, b) {
  if (!a || !b || !a.start || !a.end || !b.start || !b.end) return false;
  return a.start < b.end && b.start < a.end;
}

/** Check if any break is outside base or if breaks overlap */
function getDayValidationErrors(dayData) {
  if (!dayData || !dayData.baseShift) return [];
  const errors = [];
  const base = dayData.baseShift;
  const breaks = dayData.breaks || [];
  for (let i = 0; i < breaks.length; i++) {
    if (!isBreakWithinBase(base, breaks[i])) {
      errors.push({ type: "outside", index: i });
    }
    for (let j = i + 1; j < breaks.length; j++) {
      if (rangesOverlap(breaks[i], breaks[j])) {
        errors.push({ type: "overlap", index: i, other: j });
      }
    }
  }
  return errors;
}

function createInitialInternal() {
  const data = {};
  for (const day of DAY_KEYS) data[day] = null;
  return data;
}

const DAY_LABELS_SHORT = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת"
};

/** Convert hour index (0-23) to "HH:00" string */
function hourToTime(h) {
  return `${String(h).padStart(2, "0")}:00`;
}

/** Parse "HH:MM" to minutes from midnight */
function timeToMinutes(t) {
  if (!t || t.length < 5) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * For hour block [h:00, h+1:00): "break" | "activity" | "closed"
 * Break = red, activity = green, closed = gray
 */
function getHourBlockType(dayData, hour) {
  if (!dayData) return "closed";
  const base = dayData.baseShift;
  if (!base || !base.start || !base.end) return "closed";
  const hourStart = hour * 60;
  const hourEnd = (hour + 1) * 60;
  const baseStart = timeToMinutes(base.start);
  const baseEnd = timeToMinutes(base.end);
  if (hourEnd <= baseStart || hourStart >= baseEnd) return "closed";

  const breaks = dayData.breaks || [];
  for (const br of breaks) {
    const brStart = timeToMinutes(br.start || "");
    const brEnd = timeToMinutes(br.end || "");
    if (brStart < hourEnd && brEnd > hourStart) return "break";
  }
  return "activity";
}

/**
 * New Weekly View: Days in horizontal row.
 * Only shows hours when open (activity) or break. Green = activity, red = break.
 */
function renderWeeklyVisual(container, internal) {
  if (!container) return;
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "weekly-view-new";

  const daysRow = document.createElement("div");
  daysRow.className = "weekly-view-days-row";

  for (const dayKey of DAY_KEYS) {
    const dayCol = document.createElement("div");
    dayCol.className = "weekly-view-day-col";
    dayCol.dataset.day = dayKey;

    const header = document.createElement("div");
    header.className = "weekly-view-day-header";
    header.textContent = DAY_LABELS_SHORT[dayKey];

    const hoursScroll = document.createElement("div");
    hoursScroll.className = "weekly-view-hours-scroll";

    const dayData = internal[dayKey];
    const hoursToShow = [];
    for (let h = 0; h < 24; h++) {
      const type = getHourBlockType(dayData, h);
      if (type === "activity" || type === "break") {
        hoursToShow.push({ hour: h, type });
      }
    }

    if (hoursToShow.length === 0) {
      const empty = document.createElement("div");
      empty.className = "weekly-view-day-closed";
      empty.textContent = "סגור";
      hoursScroll.appendChild(empty);
    } else {
      for (const { hour, type } of hoursToShow) {
        const block = document.createElement("div");
        block.className = `weekly-view-hour-block weekly-view-hour--${type}`;
        block.dataset.type = type;
        const label = document.createElement("span");
        label.className = "weekly-view-hour-label";
        label.textContent = hourToTime(hour);
        block.appendChild(label);
        hoursScroll.appendChild(block);
      }
    }

    dayCol.appendChild(header);
    dayCol.appendChild(hoursScroll);
    daysRow.appendChild(dayCol);
  }

  const legend = document.createElement("div");
  legend.className = "weekly-view-legend";
  legend.innerHTML = `
    <span class="weekly-view-legend-item"><i class="weekly-view-legend-dot weekly-view-hour--activity"></i> פעילות</span>
    <span class="weekly-view-legend-item"><i class="weekly-view-legend-dot weekly-view-hour--break"></i> הפסקה</span>
  `;

  wrap.appendChild(daysRow);
  wrap.appendChild(legend);
  container.appendChild(wrap);
}

/**
 * Creates the Business Hours panel (שעות פעילות עסק)
 */
export async function createBusinessHoursPanel() {
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) {
    console.error("Chat area not found");
    return;
  }

  chatArea.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "business-hours-panel business-hours-panel-center";

  const { isMobile } = await import("../../utils/mobileNavigation.js");
  if (isMobile()) panel.classList.add("active");

  // Internal state: day → null (closed) or { baseShift: { start, end }, breaks: [...] }
  let internal = createInitialInternal();

  // Load saved data and convert to internal
  try {
    const res = await fetch(`${API_URL}/api/business-hours`);
    if (res.ok) {
      const saved = await res.json();
      if (saved && typeof saved === "object") {
        for (const day of DAY_KEYS) {
          if (Array.isArray(saved[day]) && saved[day].length > 0) {
            internal[day] = rangesToInternal(saved[day]);
            if (internal[day] && !internal[day].breaks) internal[day].breaks = [];
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not load business hours from server:", err);
  }

  // Ensure breaks array exists
  for (const day of DAY_KEYS) {
    if (internal[day] && !Array.isArray(internal[day].breaks)) internal[day].breaks = [];
  }

  // Header
  const header = document.createElement("div");
  header.className = "business-hours-header";
  header.innerHTML = `
    ${isMobile() ? `
      <button type="button" class="panel-back-button" aria-label="חזור" title="חזור">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>חזרה</span>
      </button>
    ` : ""}
    <div class="panel-header-content">
      <h2>שעות פעילות עסק</h2>
    </div>
    <button type="button" class="close-business-hours-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const content = document.createElement("div");
  content.className = "business-hours-content";

  // Top: weekly visual timeline (real-time)
  const weeklyVisualWrap = document.createElement("div");
  weeklyVisualWrap.className = "business-hours-weekly-visual-wrap";
  const weeklyVisualTitle = document.createElement("h3");
  weeklyVisualTitle.className = "business-hours-visual-title";
  weeklyVisualTitle.textContent = "מבט שבועי";
  const weeklyVisualContainer = document.createElement("div");
  weeklyVisualContainer.className = "business-hours-weekly-visual";
  weeklyVisualWrap.appendChild(weeklyVisualTitle);
  weeklyVisualWrap.appendChild(weeklyVisualContainer);
  content.appendChild(weeklyVisualWrap);

  const list = document.createElement("div");
  list.className = "business-hours-list";
  const listTitle = document.createElement("h3");
  listTitle.className = "business-hours-settings-title";
  listTitle.textContent = "הגדרות";
  content.appendChild(listTitle);
  const rowElements = {};

  for (const dayKey of DAY_KEYS) {
    const row = document.createElement("div");
    row.className = "business-hours-row";
    row.dataset.day = dayKey;

    const isSunday = dayKey === "sunday";
    const dayData = internal[dayKey];
    const baseStart = dayData?.baseShift?.start ?? DEFAULT_HOURS.start;
    const baseEnd = dayData?.baseShift?.end ?? DEFAULT_HOURS.end;

    row.innerHTML = `
      <div class="business-hours-row-main">
        <span class="business-hours-day-name">${DAY_LABELS[dayKey]}</span>
        <label class="business-hours-toggle-wrap">
          <input type="checkbox" class="business-hours-toggle" data-day="${dayKey}" />
          <span class="business-hours-toggle-slider"></span>
        </label>
        <div class="business-hours-times ${isSunday ? "has-copy-btn" : ""}">
          <input type="time" class="business-hours-start" data-day="${dayKey}" value="${baseStart}" />
          <span class="business-hours-sep">–</span>
          <input type="time" class="business-hours-end" data-day="${dayKey}" value="${baseEnd}" />
          <button type="button" class="business-hours-add-break" data-day="${dayKey}" title="הוסף הפסקה">+ הוסף הפסקה</button>
          ${isSunday ? `
            <button type="button" class="business-hours-copy-weekdays" data-day="${dayKey}" title="העתק לכל ימי החול (שני–חמישי)">
              העתק לכל ימי החול
            </button>
          ` : ""}
        </div>
      </div>
      <div class="business-hours-breaks-wrap" data-day="${dayKey}"></div>
    `;

    list.appendChild(row);
    rowElements[dayKey] = row;
  }

  content.appendChild(list);

  const saveWrap = document.createElement("div");
  saveWrap.className = "business-hours-save-wrap";
  saveWrap.innerHTML = `<button type="button" class="business-hours-save-btn">שמור</button>`;
  content.appendChild(saveWrap);
  panel.appendChild(header);
  panel.appendChild(content);
  chatArea.appendChild(panel);

  function setDayOpen(dayKey, open) {
    if (open) {
      internal[dayKey] = {
        baseShift: { ...DEFAULT_HOURS },
        breaks: []
      };
    } else {
      internal[dayKey] = null;
    }
  }

  function setBaseShift(dayKey, start, end) {
    if (internal[dayKey]) {
      internal[dayKey].baseShift = { start, end };
    }
  }

  function setBreak(dayKey, breakIndex, start, end) {
    if (internal[dayKey] && Array.isArray(internal[dayKey].breaks)) {
      if (!internal[dayKey].breaks[breakIndex]) internal[dayKey].breaks[breakIndex] = { start: "12:00", end: "13:00" };
      internal[dayKey].breaks[breakIndex] = { start, end };
    }
  }

  /** Add one hour to "HH:MM" (simple, no day overflow) */
  function addOneHour(t) {
    if (!t || t.length < 5) return "13:00";
    const [h, m] = t.split(":").map(Number);
    const next = (h + 1) % 24;
    return `${String(next).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  }

  function addBreak(dayKey) {
    if (!internal[dayKey]) return;
    if (!internal[dayKey].breaks) internal[dayKey].breaks = [];
    const base = internal[dayKey].baseShift;
    const start = base?.start ?? "12:00";
    internal[dayKey].breaks.push({
      start,
      end: addOneHour(start)
    });
    renderBreaksForDay(dayKey);
    refreshWeeklyVisual();
  }

  function removeBreak(dayKey, breakIndex) {
    if (!internal[dayKey] || !internal[dayKey].breaks) return;
    internal[dayKey].breaks.splice(breakIndex, 1);
    renderBreaksForDay(dayKey);
    refreshWeeklyVisual();
  }

  /** Update invalid styling on existing break rows without recreating DOM (preserves focus) */
  function updateBreakRowValidation(dayKey) {
    const dayData = internal[dayKey];
    if (!dayData) return;
    const errors = getDayValidationErrors(dayData);
    const invalidIndices = new Set();
    errors.forEach((err) => {
      if (err.type === "outside") invalidIndices.add(err.index);
      if (err.type === "overlap") {
        invalidIndices.add(err.index);
        invalidIndices.add(err.other);
      }
    });
    const wrap = list.querySelector(`.business-hours-breaks-wrap[data-day="${dayKey}"]`);
    if (!wrap) return;
    wrap.querySelectorAll(".business-hours-break-row").forEach((row, i) => {
      const br = dayData.breaks[i];
      const invalid = invalidIndices.has(i) || (br && !isBreakWithinBase(dayData.baseShift, br));
      row.classList.toggle("business-hours-break-invalid", !!invalid);
    });
  }

  function renderBreaksForDay(dayKey) {
    const wrap = list.querySelector(`.business-hours-breaks-wrap[data-day="${dayKey}"]`);
    if (!wrap) return;
    wrap.innerHTML = "";
    const dayData = internal[dayKey];
    if (!dayData || !Array.isArray(dayData.breaks)) return;
    const base = dayData.baseShift || {};
    const errors = getDayValidationErrors(dayData);
    const invalidIndices = new Set();
    errors.forEach((err) => {
      if (err.type === "outside") invalidIndices.add(err.index);
      if (err.type === "overlap") {
        invalidIndices.add(err.index);
        invalidIndices.add(err.other);
      }
    });
    dayData.breaks.forEach((br, i) => {
      const invalid = invalidIndices.has(i) || !isBreakWithinBase(base, br);
      const sub = document.createElement("div");
      sub.className = "business-hours-break-row" + (invalid ? " business-hours-break-invalid" : "");
      sub.innerHTML = `
        <span class="business-hours-break-icon" aria-hidden="true">☕</span>
        <label class="business-hours-break-label">תחילת הפסקה</label>
        <input type="time" class="business-hours-break-start" data-day="${dayKey}" data-break-index="${i}" value="${br.start || ""}" />
        <span class="business-hours-sep">–</span>
        <label class="business-hours-break-label">סיום הפסקה</label>
        <input type="time" class="business-hours-break-end" data-day="${dayKey}" data-break-index="${i}" value="${br.end || ""}" />
        <button type="button" class="business-hours-break-delete" data-day="${dayKey}" data-break-index="${i}" aria-label="מחק הפסקה">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      `;
      wrap.appendChild(sub);
    });
  }

  function refreshWeeklyVisual() {
    renderWeeklyVisual(weeklyVisualContainer, internal);
  }

  function syncUIFromData() {
    for (const dayKey of DAY_KEYS) {
      const row = rowElements[dayKey];
      if (!row) continue;
      const dayData = internal[dayKey];
      const open = !!dayData;
      const toggle = row.querySelector(".business-hours-toggle");
      const startInput = row.querySelector(".business-hours-start");
      const endInput = row.querySelector(".business-hours-end");
      const addBreakBtn = row.querySelector(".business-hours-add-break");

      toggle.checked = open;
      row.classList.toggle("open", open);

      if (open) {
        startInput.value = dayData.baseShift?.start ?? DEFAULT_HOURS.start;
        endInput.value = dayData.baseShift?.end ?? DEFAULT_HOURS.end;
        startInput.disabled = false;
        endInput.disabled = false;
        addBreakBtn.style.display = "";
      } else {
        startInput.disabled = true;
        endInput.disabled = true;
        addBreakBtn.style.display = "none";
      }
      renderBreaksForDay(dayKey);
    }
    refreshWeeklyVisual();
  }

  list.addEventListener("change", (e) => {
    const toggle = e.target.closest(".business-hours-toggle");
    if (toggle) {
      setDayOpen(toggle.dataset.day, toggle.checked);
      syncUIFromData();
      return;
    }
    const startInput = e.target.closest(".business-hours-start");
    const endInput = e.target.closest(".business-hours-end");
    if (startInput) {
      const dayKey = startInput.dataset.day;
      const endEl = rowElements[dayKey].querySelector(".business-hours-end");
      setBaseShift(dayKey, startInput.value, endEl?.value ?? DEFAULT_HOURS.end);
      renderBreaksForDay(dayKey);
      refreshWeeklyVisual();
      return;
    }
    if (endInput) {
      const dayKey = endInput.dataset.day;
      const startEl = rowElements[dayKey].querySelector(".business-hours-start");
      setBaseShift(dayKey, startEl?.value ?? DEFAULT_HOURS.start, endInput.value);
      renderBreaksForDay(dayKey);
      refreshWeeklyVisual();
      return;
    }
    const breakStart = e.target.closest(".business-hours-break-start");
    const breakEnd = e.target.closest(".business-hours-break-end");
    if (breakStart) {
      const dayKey = breakStart.dataset.day;
      const idx = parseInt(breakStart.dataset.breakIndex, 10);
      const endEl = list.querySelector(`.business-hours-break-end[data-day="${dayKey}"][data-break-index="${idx}"]`);
      setBreak(dayKey, idx, breakStart.value, endEl?.value ?? "");
      updateBreakRowValidation(dayKey);
      refreshWeeklyVisual();
      return;
    }
    if (breakEnd) {
      const dayKey = breakEnd.dataset.day;
      const idx = parseInt(breakEnd.dataset.breakIndex, 10);
      const startEl = list.querySelector(`.business-hours-break-start[data-day="${dayKey}"][data-break-index="${idx}"]`);
      setBreak(dayKey, idx, startEl?.value ?? "", breakEnd.value);
      updateBreakRowValidation(dayKey);
      refreshWeeklyVisual();
    }
  });

  list.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".business-hours-add-break");
    if (addBtn) {
      addBreak(addBtn.dataset.day);
      return;
    }
    const copyBtn = e.target.closest(".business-hours-copy-weekdays");
    if (copyBtn && copyBtn.dataset.day === "sunday") {
      const src = internal.sunday;
      if (src) {
        const weekdays = ["monday", "tuesday", "wednesday", "thursday"];
        for (const d of weekdays) {
          internal[d] = {
            baseShift: { ...src.baseShift },
            breaks: (src.breaks || []).map((b) => ({ ...b }))
          };
        }
        syncUIFromData();
      }
      return;
    }
    const delBtn = e.target.closest(".business-hours-break-delete");
    if (delBtn) {
      removeBreak(delBtn.dataset.day, parseInt(delBtn.dataset.breakIndex, 10));
    }
  });

  saveWrap.querySelector(".business-hours-save-btn").addEventListener("click", async () => {
    // Validate: no day may have breaks outside base or overlapping
    let hasValidationErrors = false;
    for (const day of DAY_KEYS) {
      const dayData = internal[day];
      if (dayData && getDayValidationErrors(dayData).length > 0) {
        hasValidationErrors = true;
        break;
      }
    }
    if (hasValidationErrors) {
      alert("לא ניתן לשמור: יש הפסקות מחוץ לשעות הפעילות או הפסקות חופפות. תקן את ההגדרות.");
      return;
    }

    // Build payload: each day → array of ranges (internalToRanges)
    const payload = {};
    for (const day of DAY_KEYS) {
      const dayData = internal[day];
      if (!dayData) {
        payload[day] = [];
        continue;
      }
      payload[day] = internalToRanges(dayData.baseShift, dayData.breaks);
    }

    const btn = saveWrap.querySelector(".business-hours-save-btn");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "שומר...";
    try {
      const res = await fetch(`${API_URL}/api/business-hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        if (saved && typeof saved === "object") {
          for (const day of DAY_KEYS) {
            if (Array.isArray(saved[day]) && saved[day].length > 0) {
              internal[day] = rangesToInternal(saved[day]);
              if (internal[day] && !internal[day].breaks) internal[day].breaks = [];
            } else {
              internal[day] = null;
            }
          }
        }
        syncUIFromData();
        // פלט נתונים סופי: מערך טווחים רציפים לכל יום (הפסקות מנוכות)
        console.log("Business hours (שעות פעילות) – נתונים סופיים:", payload);
        if (typeof window !== "undefined" && window.alert) {
          alert("שעות הפעילות נשמרו בהצלחה.");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert("שגיאה בשמירה: " + (err.error || res.statusText));
      }
    } catch (err) {
      console.error("Save business hours failed:", err);
      if (typeof window !== "undefined" && window.alert) {
        alert("שגיאה בשמירה. בדוק את החיבור לשרת.");
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  function closePanel() {
    import("../../utils/mobileNavigation.js").then(({ isMobile, showContactsSidebar }) => {
      if (isMobile()) showContactsSidebar();
      const chatArea = document.querySelector(".chat-area");
      if (chatArea) {
        chatArea.innerHTML = "";
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
        chatArea.appendChild(chatPlaceholder);
      }
    });
  }

  header.querySelector(".close-business-hours-btn").addEventListener("click", closePanel);
  const backBtn = header.querySelector(".panel-back-button");
  if (backBtn) backBtn.addEventListener("click", closePanel);

  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      closePanel();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);

  syncUIFromData();
  return panel;
}
