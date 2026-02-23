/**
 * Marketing Distribution Panel (הפצה שיווקית)
 * UI for pre-made messages, to-send list, sent list, and settings.
 */

import { toast } from "../toast/Toast.js";

const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : `${window.location.protocol}//${window.location.hostname}:5000`;
const BASE = `${API_URL}/api/marketing-distribution`;

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatSentDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function createMarketingDistributionPanel() {
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) {
    console.error("Chat area not found");
    return;
  }

  chatArea.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "marketing-panel";

  const { isMobile, showChatArea, showContactsSidebar } = await import("../../utils/mobileNavigation.js");
  const isMobileDevice = isMobile();
  if (isMobileDevice) panel.classList.add("active");

  // --- Header ---
  const header = document.createElement("div");
  header.className = "marketing-header";
  header.innerHTML = `
    <div class="panel-header-content">
      <h2>הפצה שיווקית</h2>
    </div>
    ${!isMobileDevice ? `
    <div class="marketing-header-actions">
      <button type="button" class="marketing-close-btn" aria-label="סגור">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    ` : ""}
  `;

  const content = document.createElement("div");
  content.className = "marketing-content";

  // Legal disclaimer (red)
  const disclaimerEl = document.createElement("div");
  disclaimerEl.className = "marketing-disclaimer";
  disclaimerEl.innerHTML = `
    <p>הפעלת ההפצה השיווקית נעשית על באחריות ועל ידי בעלי העסק בלבד.<br>
    יוצר התוכנה מסיר כל אחריות לרבות נזק ותביעה וכל אשר יבוא בעקבות זאת.<br>
    על בעל העסק האחריות לבדוק את תנאי החוק ולוודא שהרשימה שאיתה הוא עובד נחשבת חוקית ועומדת בכל התנאים.</p>
  `;

  // Toggle
  const toggleSection = document.createElement("div");
  toggleSection.className = "marketing-toggle-section";
  toggleSection.innerHTML = `
    <span class="marketing-toggle-label">הפעלת שליחה אוטומטית</span>
    <div class="marketing-toggle-switch" id="marketingToggleSwitch" role="switch" aria-checked="false"></div>
  `;
  const toggleEl = toggleSection.querySelector("#marketingToggleSwitch");

  // Settings
  const settingsSection = document.createElement("div");
  settingsSection.className = "marketing-settings-section";
  settingsSection.innerHTML = `
    <h3>הגדרות שליחה</h3>
    <div class="marketing-settings-grid">
      <div class="marketing-form-group">
        <label>שעת התחלה</label>
        <input type="time" id="mdStartHour" step="60" value="09:00" />
      </div>
      <div class="marketing-form-group">
        <label>שעת סיום</label>
        <input type="time" id="mdEndHour" step="60" value="18:00" />
      </div>
      <div class="marketing-form-group">
        <label>שעת איפוס יומי</label>
        <input type="time" id="mdResumeHour" step="60" value="08:00" />
      </div>
      <div class="marketing-form-group">
        <label>מגבלה יומית</label>
        <input type="number" id="mdDailyLimit" min="1" value="50" />
      </div>
      <div class="marketing-form-group">
        <label>השהייה בין שליחות (דקות)</label>
        <input type="number" id="mdDelayMinutes" min="1" value="5" />
      </div>
    </div>
    <div style="margin-top:12px;">
      <button type="button" class="marketing-add-message-btn" id="mdSaveSettingsBtn" style="border-style:solid;">שמור הגדרות</button>
    </div>
  `;

  // Messages pool
  const messagesSection = document.createElement("div");
  messagesSection.className = "marketing-messages-section";
  messagesSection.innerHTML = `
    <h3>הודעות מוכנות <span class="marketing-messages-count" id="mdMessagesCount">0</span></h3>
    <div id="mdMessagesList"></div>
    <button type="button" class="marketing-add-message-btn" id="mdAddMessageBtn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      הוסף הודעה
    </button>
  `;
  const messagesListEl = messagesSection.querySelector("#mdMessagesList");
  const messagesCountEl = messagesSection.querySelector("#mdMessagesCount");

  // Three lists: to-send, sent, never-send
  const listsSection = document.createElement("div");
  listsSection.className = "marketing-lists-section";
  listsSection.innerHTML = `
    <div class="marketing-list-card">
      <h3>רשימה לשליחה <span class="marketing-list-count" id="mdToSendCount">0</span></h3>
      <input type="text" id="mdSearchToSend" class="marketing-list-search" placeholder="חיפוש לפי שם או מספר..." aria-label="חיפוש ברשימה לשליחה" />
      <div class="marketing-list-body" id="mdToSendList"></div>
      <div class="marketing-add-to-send">
        <input type="text" id="mdPhoneInput" placeholder="מספר טלפון או כמה מופרדים בפסיק" />
        <button type="button" id="mdAddPhoneBtn">הוסף לרשימה</button>
        <label class="marketing-excel-upload">
          <input type="file" id="mdExcelInput" accept=".xlsx,.xls" hidden />
          <span class="marketing-excel-btn">ייבוא מאקסל</span>
        </label>
        <button type="button" id="mdClearToSendBtn" class="marketing-clear-list-btn">נקה רשימה</button>
      </div>
    </div>
    <div class="marketing-list-card">
      <h3>נשלחו <span class="marketing-list-count sent" id="mdSentCount">0</span></h3>
      <input type="text" id="mdSearchSent" class="marketing-list-search" placeholder="חיפוש לפי שם או מספר..." aria-label="חיפוש ברשימה נשלחו" />
      <div class="marketing-list-body" id="mdSentList"></div>
    </div>
    <div class="marketing-list-card marketing-never-send-card">
      <h3>לעולם לא לשלוח <span class="marketing-list-count never" id="mdNeverSendCount">0</span></h3>
      <p class="marketing-never-send-desc">מי ששלח הודעה עם המילה &quot;הסרה&quot; – לא יישלחו אליו הודעות.</p>
      <input type="text" id="mdSearchNeverSend" class="marketing-list-search" placeholder="חיפוש לפי שם או מספר..." aria-label="חיפוש ברשימה לעולם לא לשלוח" />
      <div class="marketing-list-body" id="mdNeverSendList"></div>
    </div>
  `;
  const toSendListEl = listsSection.querySelector("#mdToSendList");
  const sentListEl = listsSection.querySelector("#mdSentList");
  const toSendCountEl = listsSection.querySelector("#mdToSendCount");
  const sentCountEl = listsSection.querySelector("#mdSentCount");
  const phoneInput = listsSection.querySelector("#mdPhoneInput");
  const addPhoneBtn = listsSection.querySelector("#mdAddPhoneBtn");

  content.appendChild(disclaimerEl);
  content.appendChild(toggleSection);
  content.appendChild(settingsSection);
  content.appendChild(messagesSection);
  content.appendChild(listsSection);
  panel.appendChild(header);
  panel.appendChild(content);

  const neverSendListEl = listsSection.querySelector("#mdNeverSendList");
  const neverSendCountEl = listsSection.querySelector("#mdNeverSendCount");
  const excelInput = listsSection.querySelector("#mdExcelInput");

  let refreshIntervalId = null;
  let state = {
    messages: [],
    toSend: [],
    sent: [],
    neverSend: [],
    settings: {},
  };

  async function loadStatus() {
    const data = await apiGet("/status");
    state.settings = data.settings || {};
    const toSendRes = await apiGet("/to-send");
    state.toSend = (toSendRes.items || toSendRes.phones || []).map((e) =>
      typeof e === "object" && e && e.phone != null ? { phone: e.phone, name: e.name != null ? String(e.name) : "" } : { phone: String(e), name: "" }
    );
    state.sent = (await apiGet("/sent")).sent || [];
    const neverRes = await apiGet("/never-send");
    state.neverSend = (neverRes.items || neverRes.phones || []).map((e) =>
      typeof e === "object" && e && e.phone != null ? { phone: e.phone, name: e.name != null ? String(e.name) : "" } : { phone: String(e), name: "" }
    );
    state.messages = (await apiGet("/messages")).messages || [];
    toSendCountEl.textContent = data.eligibleToSendCount ?? state.toSend.length;
    sentCountEl.textContent = data.sentCount ?? state.sent.length;
    neverSendCountEl.textContent = state.neverSend.length;
    messagesCountEl.textContent = state.messages.length;
    return data;
  }

  function hourMinuteToTimeValue(hour, minute) {
    const h = Number(hour);
    const m = Number(minute);
    if (Number.isNaN(h) || h < 0 || h > 23) return "09:00";
    const min = Number.isNaN(m) || m < 0 || m > 59 ? 0 : Math.floor(m);
    return `${String(Math.floor(h)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  function timeValueToHourMinute(value) {
    if (!value || typeof value !== "string") return { hour: 9, minute: 0 };
    const parts = value.trim().split(":");
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return {
      hour: Number.isNaN(h) ? 9 : Math.max(0, Math.min(23, h)),
      minute: Number.isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
    };
  }

  function renderSettings() {
    const s = state.settings;
    const get = (id) => content.querySelector(`#${id}`);
    const set = (id, val) => {
      const el = get(id);
      if (el) el.value = val;
    };
    set("mdStartHour", hourMinuteToTimeValue(s.startHour ?? 9, s.startMinute ?? 0));
    set("mdEndHour", hourMinuteToTimeValue(s.endHour ?? 18, s.endMinute ?? 0));
    set("mdResumeHour", hourMinuteToTimeValue(s.resumeHour ?? 8, s.resumeMinute ?? 0));
    set("mdDailyLimit", s.dailyLimit ?? 50);
    set("mdDelayMinutes", s.delayMinutes ?? 5);
    toggleEl.classList.toggle("on", !!s.enabled);
    toggleEl.setAttribute("aria-checked", s.enabled ? "true" : "false");
  }

  function renderMessages() {
    messagesListEl.innerHTML = "";
    state.messages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "marketing-message-item";
      div.innerHTML = `
        <span class="marketing-message-index">${msg.id}</span>
        <span class="marketing-message-text">${escapeHtml((msg.text || "").slice(0, 120))}${(msg.text || "").length > 120 ? "…" : ""}</span>
        <div class="marketing-message-actions">
          <button type="button" class="marketing-btn-icon md-edit-msg" data-id="${msg.id}" aria-label="עריכה"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
          <button type="button" class="marketing-btn-icon md-delete-msg" data-id="${msg.id}" aria-label="מחיקה"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
      `;
      messagesListEl.appendChild(div);
    });
    messagesListEl.querySelectorAll(".md-edit-msg").forEach((btn) => {
      btn.addEventListener("click", () => openEditMessageModal(parseInt(btn.dataset.id, 10)));
    });
    messagesListEl.querySelectorAll(".md-delete-msg").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("למחוק הודעה זו?")) return;
        try {
          await apiDelete(`/messages/${btn.dataset.id}`);
          await refresh();
        } catch (e) {
          alert("שגיאה: " + e.message);
        }
      });
    });
  }

  function matchesSearch(entry, query) {
    if (!query || typeof query !== "string") return true;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const phone = (entry.phone != null ? String(entry.phone) : "").toLowerCase();
    const name = (entry.name != null ? String(entry.name) : "").toLowerCase();
    return phone.includes(q) || name.includes(q);
  }

  function renderToSendList() {
    const sentSet = new Set((state.sent || []).map((e) => e.phone));
    let eligible = (state.toSend || []).filter((e) => e && e.phone && !sentSet.has(e.phone));
    const searchEl = content.querySelector("#mdSearchToSend");
    const searchQ = searchEl ? searchEl.value.trim() : "";
    if (searchQ) eligible = eligible.filter((e) => matchesSearch(e, searchQ));
    toSendListEl.innerHTML = "";
    const headerRow = document.createElement("div");
    headerRow.className = "marketing-list-item marketing-list-header";
    headerRow.innerHTML = `<span class="marketing-col-name">שם</span><span class="marketing-col-phone">מספר</span><span></span>`;
    toSendListEl.appendChild(headerRow);
    eligible.forEach((entry) => {
      const phone = entry.phone || "";
      const name = entry.name != null ? String(entry.name) : "";
      const div = document.createElement("div");
      div.className = "marketing-list-item marketing-list-item-cols";
      div.innerHTML = `
        <span class="marketing-col-name">${escapeHtml(name)}</span>
        <span class="marketing-col-phone">${escapeHtml(phone)}</span>
        <button type="button" class="marketing-btn-icon md-remove-phone" data-phone="${escapeHtml(phone)}" aria-label="הסר">×</button>
      `;
      toSendListEl.appendChild(div);
    });
    toSendListEl.querySelectorAll(".md-remove-phone").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await apiDelete(`/to-send/${encodeURIComponent(btn.dataset.phone)}`);
          await refresh();
        } catch (e) {
          alert("שגיאה: " + e.message);
        }
      });
    });
    toSendCountEl.textContent = eligible.length;
  }

  function renderSentList() {
    const searchEl = content.querySelector("#mdSearchSent");
    const searchQ = searchEl ? searchEl.value.trim() : "";
    let list = state.sent || [];
    if (searchQ) list = list.filter((e) => matchesSearch(e, searchQ));
    sentListEl.innerHTML = "";
    const headerRow = document.createElement("div");
    headerRow.className = "marketing-list-item marketing-list-header";
    headerRow.innerHTML = `<span class="marketing-col-name">שם</span><span class="marketing-col-phone">מספר</span><span class="marketing-list-item-sent-at">נשלח ב</span><span></span>`;
    sentListEl.appendChild(headerRow);
    list.forEach((entry) => {
      const name = entry.name != null ? String(entry.name) : "";
      const div = document.createElement("div");
      div.className = "marketing-list-item marketing-list-item-cols";
      div.innerHTML = `
        <span class="marketing-col-name">${escapeHtml(name)}</span>
        <span class="marketing-col-phone">${escapeHtml(entry.phone)}</span>
        <span class="marketing-list-item-sent-at">${formatSentDate(entry.sentAt)}</span>
        <button type="button" class="marketing-btn-icon md-remove-sent" data-phone="${escapeHtml(entry.phone)}" aria-label="הסר מרשימת נשלחו">×</button>
      `;
      sentListEl.appendChild(div);
    });
    sentListEl.querySelectorAll(".md-remove-sent").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await apiDelete(`/sent/${encodeURIComponent(btn.dataset.phone)}`);
          await refresh();
        } catch (e) {
          alert("שגיאה: " + e.message);
        }
      });
    });
    sentCountEl.textContent = state.sent.length;
  }

  function renderNeverSendList() {
    const searchEl = content.querySelector("#mdSearchNeverSend");
    const searchQ = searchEl ? searchEl.value.trim() : "";
    let list = state.neverSend || [];
    if (searchQ) list = list.filter((e) => matchesSearch(e, searchQ));
    neverSendListEl.innerHTML = "";
    const headerRow = document.createElement("div");
    headerRow.className = "marketing-list-item marketing-list-header";
    headerRow.innerHTML = `<span class="marketing-col-name">שם</span><span class="marketing-col-phone">מספר</span>`;
    neverSendListEl.appendChild(headerRow);
    list.forEach((entry) => {
      const phone = typeof entry === "object" && entry && entry.phone != null ? entry.phone : entry;
      const name = typeof entry === "object" && entry && entry.name != null ? String(entry.name) : "";
      const div = document.createElement("div");
      div.className = "marketing-list-item marketing-list-item-cols";
      div.innerHTML = `<span class="marketing-col-name">${escapeHtml(name)}</span><span class="marketing-col-phone">${escapeHtml(phone)}</span>`;
      neverSendListEl.appendChild(div);
    });
    neverSendCountEl.textContent = (state.neverSend || []).length;
  }

  async function refresh() {
    try {
      await loadStatus();
      renderSettings();
      renderMessages();
      renderToSendList();
      renderSentList();
      renderNeverSendList();
    } catch (e) {
      console.error("Marketing distribution refresh", e);
    }
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function openEditMessageModal(id) {
    const msg = state.messages.find((m) => m.id === id);
    if (!msg) return;
    const overlay = document.createElement("div");
    overlay.className = "marketing-modal-overlay";
    const textarea = document.createElement("textarea");
    textarea.value = msg.text || "";
    overlay.innerHTML = "";
    const modal = document.createElement("div");
    modal.className = "marketing-modal";
    modal.innerHTML = `<h4>עריכת הודעה #${id}</h4>`;
    modal.appendChild(textarea);
    const actions = document.createElement("div");
    actions.className = "marketing-modal-actions";
    actions.innerHTML = `
      <button type="button" class="marketing-btn-cancel">ביטול</button>
      <button type="button" class="marketing-btn-save">שמור</button>
    `;
    modal.appendChild(actions);
    overlay.appendChild(modal);

    const close = () => {
      overlay.remove();
    };
    actions.querySelector(".marketing-btn-cancel").addEventListener("click", close);
    actions.querySelector(".marketing-btn-save").addEventListener("click", async () => {
      try {
        await apiPut(`/messages/${id}`, { text: textarea.value });
        close();
        await refresh();
      } catch (e) {
        alert("שגיאה: " + e.message);
      }
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
    textarea.focus();
  }

  function openAddMessageModal() {
    const overlay = document.createElement("div");
    overlay.className = "marketing-modal-overlay";
    const textarea = document.createElement("textarea");
    textarea.placeholder = "טקסט ההודעה...";
    overlay.innerHTML = "";
    const modal = document.createElement("div");
    modal.className = "marketing-modal";
    modal.innerHTML = "<h4>הודעה חדשה</h4>";
    modal.appendChild(textarea);
    const actions = document.createElement("div");
    actions.className = "marketing-modal-actions";
    actions.innerHTML = `
      <button type="button" class="marketing-btn-cancel">ביטול</button>
      <button type="button" class="marketing-btn-save">הוסף</button>
    `;
    modal.appendChild(actions);
    overlay.appendChild(modal);

    const close = () => overlay.remove();
    actions.querySelector(".marketing-btn-cancel").addEventListener("click", close);
    actions.querySelector(".marketing-btn-save").addEventListener("click", async () => {
      const text = textarea.value.trim();
      if (!text) return;
      try {
        await apiPost("/messages", { text });
        close();
        await refresh();
      } catch (e) {
        alert("שגיאה: " + e.message);
      }
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
    textarea.focus();
  }

  // Toggle: when turning ON, show confirmation popup first
  toggleEl.addEventListener("click", async () => {
    const next = !state.settings.enabled;
    if (next) {
      const confirmed = await new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "marketing-modal-overlay";
        const modal = document.createElement("div");
        modal.className = "marketing-modal";
        modal.innerHTML = `
          <h4>אישור אחריות</h4>
          <p class="marketing-confirm-text">אני בעל העסק קראתי את האזהרה ומאשר שהאחריות היא 100 אחוז עלי.</p>
          <div class="marketing-modal-actions">
            <button type="button" class="marketing-btn-cancel">ביטול</button>
            <button type="button" class="marketing-btn-save marketing-confirm-ok">אישור</button>
          </div>
        `;
        overlay.appendChild(modal);
        const close = (result) => {
          overlay.remove();
          resolve(result);
        };
        modal.querySelector(".marketing-btn-cancel").addEventListener("click", () => close(false));
        modal.querySelector(".marketing-confirm-ok").addEventListener("click", () => close(true));
        overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
        document.body.appendChild(overlay);
      });
      if (!confirmed) return;
    }
    try {
      state.settings = await apiPost("/settings", { enabled: next });
      renderSettings();
    } catch (e) {
      alert("שגיאה: " + e.message);
    }
  });

  // Save settings
  settingsSection.querySelector("#mdSaveSettingsBtn").addEventListener("click", async () => {
    const start = timeValueToHourMinute(content.querySelector("#mdStartHour").value);
    const end = timeValueToHourMinute(content.querySelector("#mdEndHour").value);
    const resume = timeValueToHourMinute(content.querySelector("#mdResumeHour").value);
    const dailyLimit = parseInt(content.querySelector("#mdDailyLimit").value, 10);
    const delayMinutes = parseInt(content.querySelector("#mdDelayMinutes").value, 10);
    try {
      state.settings = await apiPost("/settings", {
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
        resumeHour: resume.hour,
        resumeMinute: resume.minute,
        dailyLimit: Number.isNaN(dailyLimit) ? 50 : dailyLimit,
        delayMinutes: Number.isNaN(delayMinutes) ? 5 : delayMinutes,
      });
      toast.success("ההגדרות נשמרו");
    } catch (e) {
      alert("שגיאה: " + e.message);
    }
  });

  // Add message
  messagesSection.querySelector("#mdAddMessageBtn").addEventListener("click", openAddMessageModal);

  // Add phone(s)
  addPhoneBtn.addEventListener("click", async () => {
    const raw = phoneInput.value.trim();
    if (!raw) return;
    const phones = raw.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
    if (!phones.length) return;
    try {
      await apiPost("/to-send", { phones, replace: false });
      phoneInput.value = "";
      await refresh();
    } catch (e) {
      alert("שגיאה: " + e.message);
    }
  });

  // Excel import
  excelInput.addEventListener("change", async (e) => {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${BASE}/import-excel`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      e.target.value = "";
      if (!res.ok) {
        alert(data.error || "שגיאה בייבוא הקובץ");
        return;
      }
      toast.success(`נוספו ${data.added ?? 0} מספרים לרשימה לשליחה`);
      await refresh();
    } catch (err) {
      alert("שגיאה: " + (err.message || "לא ניתן לייבא את הקובץ"));
      e.target.value = "";
    }
  });

  listsSection.querySelector("#mdClearToSendBtn").addEventListener("click", async () => {
    if (!confirm("לנקות את כל הרשימה לשליחה? לא ניתן לשחזר.")) return;
    try {
      await apiPost("/to-send", { replace: true, items: [] });
      toast.success("הרשימה נוקתה");
      await refresh();
    } catch (e) {
      alert("שגיאה: " + e.message);
    }
  });

  content.querySelector("#mdSearchToSend")?.addEventListener("input", () => renderToSendList());
  content.querySelector("#mdSearchSent")?.addEventListener("input", () => renderSentList());
  content.querySelector("#mdSearchNeverSend")?.addEventListener("input", () => renderNeverSendList());

  function closePanel() {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
    import("../../utils/mobileNavigation.js").then(({ isMobile, showContactsSidebar }) => {
      if (isMobile()) {
        if (panel.parentNode) panel.parentNode.removeChild(panel);
        showContactsSidebar();
      } else {
        const chatArea = document.querySelector(".chat-area");
        if (chatArea) {
          const ph = document.createElement("div");
          ph.className = "chat-placeholder";
          ph.id = "chatPlaceholder";
          ph.innerHTML = `
            <div class="placeholder-content">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <h2>בחר איש קשר כדי להכניס תזכורות</h2>
              <p>התזכורות שלך יופיעו כאן</p>
            </div>
          `;
          chatArea.innerHTML = "";
          chatArea.appendChild(ph);
        }
      }
    });
  }

  const closeBtn = header.querySelector(".marketing-close-btn");
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  const backBtn = header.querySelector(".panel-back-button");
  if (backBtn) backBtn.addEventListener("click", closePanel);

  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      closePanel();
      document.removeEventListener("keydown", esc);
    }
  });

  if (isMobileDevice) {
    document.body.appendChild(panel);
    showChatArea();
  } else {
    chatArea.appendChild(panel);
  }

  await refresh();
  refreshIntervalId = setInterval(() => refresh(), 15000);
  return panel;
}
