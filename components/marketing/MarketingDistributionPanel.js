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
        <label>שעת התחלה (0-23)</label>
        <input type="number" id="mdStartHour" min="0" max="23" value="9" />
      </div>
      <div class="marketing-form-group">
        <label>שעת סיום (0-23)</label>
        <input type="number" id="mdEndHour" min="0" max="23" value="18" />
      </div>
      <div class="marketing-form-group">
        <label>שעת איפוס יומי (0-23)</label>
        <input type="number" id="mdResumeHour" min="0" max="23" value="8" />
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

  // Two lists
  const listsSection = document.createElement("div");
  listsSection.className = "marketing-lists-section";
  listsSection.innerHTML = `
    <div class="marketing-list-card">
      <h3>רשימה לשליחה <span class="marketing-list-count" id="mdToSendCount">0</span></h3>
      <div class="marketing-list-body" id="mdToSendList"></div>
      <div class="marketing-add-to-send">
        <input type="text" id="mdPhoneInput" placeholder="מספר טלפון או כמה מופרדים בפסיק" />
        <button type="button" id="mdAddPhoneBtn">הוסף לרשימה</button>
      </div>
    </div>
    <div class="marketing-list-card">
      <h3>נשלחו <span class="marketing-list-count sent" id="mdSentCount">0</span></h3>
      <div class="marketing-list-body" id="mdSentList"></div>
    </div>
  `;
  const toSendListEl = listsSection.querySelector("#mdToSendList");
  const sentListEl = listsSection.querySelector("#mdSentList");
  const toSendCountEl = listsSection.querySelector("#mdToSendCount");
  const sentCountEl = listsSection.querySelector("#mdSentCount");
  const phoneInput = listsSection.querySelector("#mdPhoneInput");
  const addPhoneBtn = listsSection.querySelector("#mdAddPhoneBtn");

  content.appendChild(toggleSection);
  content.appendChild(settingsSection);
  content.appendChild(messagesSection);
  content.appendChild(listsSection);
  panel.appendChild(header);
  panel.appendChild(content);

  let state = {
    messages: [],
    toSend: [],
    sent: [],
    settings: {},
  };

  async function loadStatus() {
    const data = await apiGet("/status");
    state.settings = data.settings || {};
    state.toSend = (await apiGet("/to-send")).phones || [];
    state.sent = (await apiGet("/sent")).sent || [];
    state.messages = (await apiGet("/messages")).messages || [];
    toSendCountEl.textContent = data.eligibleToSendCount ?? state.toSend.length;
    sentCountEl.textContent = data.sentCount ?? state.sent.length;
    messagesCountEl.textContent = state.messages.length;
    return data;
  }

  function renderSettings() {
    const s = state.settings;
    const get = (id) => content.querySelector(`#${id}`);
    const set = (id, val) => {
      const el = get(id);
      if (el) el.value = val;
    };
    set("mdStartHour", s.startHour ?? 9);
    set("mdEndHour", s.endHour ?? 18);
    set("mdResumeHour", s.resumeHour ?? 8);
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

  function renderToSendList() {
    const sentSet = new Set((state.sent || []).map((e) => e.phone));
    const eligible = (state.toSend || []).filter((p) => !sentSet.has(p));
    toSendListEl.innerHTML = "";
    eligible.forEach((phone) => {
      const div = document.createElement("div");
      div.className = "marketing-list-item";
      div.innerHTML = `
        <span>${escapeHtml(phone)}</span>
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
    sentListEl.innerHTML = "";
    state.sent.forEach((entry) => {
      const div = document.createElement("div");
      div.className = "marketing-list-item";
      div.innerHTML = `
        <span>${escapeHtml(entry.phone)}</span>
        <span class="marketing-list-item-sent-at">${formatSentDate(entry.sentAt)}</span>
      `;
      sentListEl.appendChild(div);
    });
    sentCountEl.textContent = state.sent.length;
  }

  async function refresh() {
    try {
      await loadStatus();
      renderSettings();
      renderMessages();
      renderToSendList();
      renderSentList();
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

  // Toggle
  toggleEl.addEventListener("click", async () => {
    const next = !state.settings.enabled;
    try {
      state.settings = await apiPost("/settings", { enabled: next });
      renderSettings();
    } catch (e) {
      alert("שגיאה: " + e.message);
    }
  });

  // Save settings
  settingsSection.querySelector("#mdSaveSettingsBtn").addEventListener("click", async () => {
    const startHour = parseInt(content.querySelector("#mdStartHour").value, 10);
    const endHour = parseInt(content.querySelector("#mdEndHour").value, 10);
    const resumeHour = parseInt(content.querySelector("#mdResumeHour").value, 10);
    const dailyLimit = parseInt(content.querySelector("#mdDailyLimit").value, 10);
    const delayMinutes = parseInt(content.querySelector("#mdDelayMinutes").value, 10);
    try {
      state.settings = await apiPost("/settings", {
        startHour: isNaN(startHour) ? 9 : startHour,
        endHour: isNaN(endHour) ? 18 : endHour,
        resumeHour: isNaN(resumeHour) ? 8 : resumeHour,
        dailyLimit: isNaN(dailyLimit) ? 50 : dailyLimit,
        delayMinutes: isNaN(delayMinutes) ? 5 : delayMinutes,
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

  function closePanel() {
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
  return panel;
}
