// Logs Panel – תצוגת לוגים לפי סוגי שגיאות (צד שרת)

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : `${window.location.protocol}//${window.location.hostname}:5000`;

/**
 * Creates the logs panel (desktop-only menu item; panel works on all viewports)
 */
export async function createLogsPanel() {
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) {
    console.error("Chat area not found");
    return;
  }

  chatArea.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "logs-panel logs-panel-center";

  const { isMobile, showChatArea } = await import("../../utils/mobileNavigation.js");
  const isMobileDevice = isMobile();
  if (isMobileDevice) {
    panel.classList.add("active");
  }

  const header = document.createElement("div");
  header.className = "logs-panel-header";
  header.innerHTML = `
    ${isMobileDevice ? `
      <button type="button" class="panel-back-button" aria-label="חזור">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>חזרה</span>
      </button>
    ` : ""}
    <div class="panel-header-content">
      <h2>לוגים (שגיאות שרת)</h2>
    </div>
    <button type="button" class="close-logs-panel-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const content = document.createElement("div");
  content.className = "logs-panel-content";
  content.innerHTML = `
    <div class="logs-toolbar">
      <div class="logs-filters">
        <label>סינון:</label>
        <select id="logsLevelFilter" class="logs-level-select">
          <option value="">הכל (שגיאות + אזהרות)</option>
          <option value="ERROR">שגיאות בלבד</option>
          <option value="WARN">אזהרות בלבד</option>
        </select>
      </div>
      <div class="logs-actions">
        <button type="button" class="logs-refresh-btn" id="logsRefreshBtn">רענן</button>
        <button type="button" class="logs-clear-btn" id="logsClearBtn">נקה לוגים</button>
      </div>
    </div>
    <div class="logs-list-container">
      <div class="logs-loading" id="logsLoading">
        <div class="loader-spinner"></div>
        <p>טוען לוגים...</p>
      </div>
      <div class="logs-list" id="logsList" style="display: none;"></div>
      <div class="logs-empty" id="logsEmpty" style="display: none;">
        <p>אין רשומות לוג.</p>
      </div>
    </div>
  `;

  panel.appendChild(header);
  panel.appendChild(content);

  if (isMobileDevice) {
    document.body.appendChild(panel);
    showChatArea();
  } else {
    chatArea.appendChild(panel);
  }

  if (isMobileDevice) {
    const backBtn = header.querySelector(".panel-back-button");
    if (backBtn) backBtn.addEventListener("click", () => closePanel(panel));
  }

  const closeBtn = header.querySelector(".close-logs-panel-btn");
  closeBtn.addEventListener("click", () => closePanel(panel));

  document.addEventListener("keydown", function onEscape(e) {
    if (e.key === "Escape") {
      closePanel(panel);
      document.removeEventListener("keydown", onEscape);
    }
  });

  const levelSelect = content.querySelector("#logsLevelFilter");
  const refreshBtn = content.querySelector("#logsRefreshBtn");
  const clearBtn = content.querySelector("#logsClearBtn");

  async function loadLogs() {
    const loading = content.querySelector("#logsLoading");
    const listEl = content.querySelector("#logsList");
    const emptyEl = content.querySelector("#logsEmpty");
    loading.style.display = "flex";
    listEl.style.display = "none";
    emptyEl.style.display = "none";

    const level = levelSelect.value || undefined;
    try {
      const url = `${API_URL}/api/logs${level ? `?level=${encodeURIComponent(level)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      loading.style.display = "none";
      if (!data.entries || data.entries.length === 0) {
        emptyEl.style.display = "block";
        return;
      }
      listEl.style.display = "block";
      listEl.innerHTML = data.entries
        .map(
          (entry) => `
          <div class="logs-entry logs-entry-${(entry.level || "").toLowerCase()}" data-level="${entry.level || ""}">
            <div class="logs-entry-header">
              <span class="logs-entry-level">${entry.level || "—"}</span>
              <span class="logs-entry-time">${formatTime(entry.timestamp)}</span>
            </div>
            <div class="logs-entry-message">${escapeHtml(entry.message)}</div>
            ${entry.stack ? `<pre class="logs-entry-stack">${escapeHtml(entry.stack)}</pre>` : ""}
          </div>
        `
        )
        .join("");
    } catch (err) {
      loading.style.display = "none";
      emptyEl.style.display = "block";
      emptyEl.innerHTML = `<p>שגיאה בטעינת לוגים: ${escapeHtml(err.message)}</p>`;
    }
  }

  levelSelect.addEventListener("change", loadLogs);
  refreshBtn.addEventListener("click", loadLogs);
  clearBtn.addEventListener("click", async () => {
    if (!confirm("לנקות את כל הלוגים?")) return;
    try {
      const res = await fetch(`${API_URL}/api/logs`, { method: "DELETE" });
      if (!res.ok) throw new Error(res.statusText);
      await loadLogs();
    } catch (err) {
      alert("שגיאה בניקוי לוגים: " + err.message);
    }
  });

  await loadLogs();
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function closePanel(panel) {
  import("../../utils/mobileNavigation.js").then(({ isMobile, showContactsSidebar }) => {
    if (isMobile()) {
      if (panel?.parentNode) panel.parentNode.removeChild(panel);
      showContactsSidebar();
    } else {
      const chatArea = document.querySelector(".chat-area");
      if (chatArea) {
        const placeholder = document.createElement("div");
        placeholder.className = "chat-placeholder";
        placeholder.id = "chatPlaceholder";
        placeholder.innerHTML = `
          <div class="placeholder-content">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h2>בחר איש קשר כדי להכניס תזכורות</h2>
            <p>התזכורות שלך יופיעו כאן</p>
          </div>
        `;
        chatArea.innerHTML = "";
        chatArea.appendChild(placeholder);
      }
      if (panel?.parentNode) panel.parentNode.removeChild(panel);
    }
  });
}
