// Grow Connection Panel – התחברות ל-GROW (שירות סליקה)
// מציג סטטוס התחברות וכפתורי התחברות/התנתקות

const API_BASE = "/api";

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function fetchGrowStatus() {
  const res = await fetch(`${API_BASE}/grow/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

async function disconnectGrow() {
  const res = await fetch(`${API_BASE}/grow/disconnect`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to disconnect");
  return res.json();
}

async function saveGrowCookies(payload) {
  const res = await fetch(`${API_BASE}/grow/cookies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save cookies");
  }
  return res.json();
}

async function refreshGrowCookies() {
  const res = await fetch(`${API_BASE}/grow/refresh`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to refresh");
  return res.json();
}

/**
 * Creates the GROW connection panel (desktop-only menu item)
 * Displays connection status and Connect/Disconnect buttons
 */
export async function createGrowConnectionPanel() {
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) {
    console.error("Chat area not found");
    return;
  }

  chatArea.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "grow-connection-panel grow-connection-panel-center";

  const { isMobile, showChatArea } = await import("../../utils/mobileNavigation.js");
  const isMobileDevice = isMobile();
  if (isMobileDevice) {
    panel.classList.add("active");
  }

  const header = document.createElement("div");
  header.className = "grow-connection-panel-header";
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
      <h2>התחברות ל-GROW</h2>
    </div>
    <button type="button" class="close-grow-connection-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const content = document.createElement("div");
  content.className = "grow-connection-panel-content";

  let isConnected = false;
  let lastRefreshAt = null;
  let bizToken = "";
  let showConnectForm = false;
  let isRefreshing = false;

  async function loadStatus() {
    try {
      const status = await fetchGrowStatus();
      isConnected = status.isConnected === true;
      lastRefreshAt = status.lastRefreshAt || null;
      bizToken = status.bizToken || "";
    } catch (e) {
      isConnected = false;
      bizToken = "";
    }
    renderContent();
  }

  function renderContent() {
    if (showConnectForm) {
      content.innerHTML = `
        <div class="grow-connection-status-card">
          <h3 class="grow-connect-form-title">הדבק JSON של קוקיז</h3>
          <p class="grow-connect-form-desc">הדבק כאן את מבנה ה-JSON עם cookieHeader, cookies ו-bizToken (כמו שמוחזר מהדפדפן – bizToken נמצא ב-Session Storage)</p>
          <textarea id="growCookiesJson" class="grow-cookies-textarea" placeholder='{"cookieHeader":"...","cookies":[...],"bizToken":"...","source":"https://grow.website"}' rows="6"></textarea>
          <div class="grow-connection-actions">
            <button type="button" class="grow-disconnect-btn" id="growCancelConnectBtn">ביטול</button>
            <button type="button" class="grow-connect-btn" id="growSubmitCookiesBtn">שמור והתחבר</button>
          </div>
        </div>
      `;
      const cancelBtn = content.querySelector("#growCancelConnectBtn");
      const submitBtn = content.querySelector("#growSubmitCookiesBtn");
      const textarea = content.querySelector("#growCookiesJson");
      cancelBtn.addEventListener("click", () => {
        showConnectForm = false;
        renderContent();
      });
      submitBtn.addEventListener("click", async () => {
        try {
          const raw = textarea.value.trim();
          if (!raw) return;
          const payload = JSON.parse(raw);
          await saveGrowCookies(payload);
          showConnectForm = false;
          await loadStatus();
        } catch (e) {
          alert("שגיאה: " + (e.message || "נתונים לא תקינים"));
        }
      });
      return;
    }

    content.innerHTML = `
      <div class="grow-connection-status-card">
        <div class="grow-status-header">
          <span class="grow-status-label">סטטוס התחברות</span>
          <span class="grow-status-badge ${isConnected ? 'connected' : 'disconnected'}">
            ${isConnected ? 'מחובר' : 'מנותק'}
          </span>
        </div>
        <p class="grow-status-description">
          ${isConnected
            ? 'החשבון מחובר לשירות הסליקה GROW. ניתן לבצע תשלומים.'
            : 'החשבון לא מחובר לשירות הסליקה GROW. לחץ התחבר כדי לפתוח את האתר ולהתחבר.'}
        </p>
        ${lastRefreshAt ? `<p class="grow-last-refresh">רענון אחרון: ${new Date(lastRefreshAt).toLocaleString("he-IL")}</p>` : ""}
        ${bizToken ? `<p class="grow-biz-token"><strong>BIZTOKEN:</strong> <code class="grow-biz-token-value">${escapeHtml(bizToken)}</code></p>` : ""}
        <div class="grow-connection-actions">
          ${isConnected
            ? `
              <button type="button" class="grow-refresh-btn" id="growRefreshBtn" ${isRefreshing ? "disabled" : ""}>
                ${isRefreshing ? "מרענן..." : "רענון קוקיז"}
              </button>
              <button type="button" class="grow-disconnect-btn" id="growDisconnectBtn">התנתק</button>
            `
            : `
              <button type="button" class="grow-connect-btn" id="growConnectBtn">התחבר</button>
              <a href="#" class="grow-paste-link" id="growPasteLink">או הדבק קוקיז ידנית</a>
            `}
        </div>
      </div>
    `;

    const connectBtn = content.querySelector("#growConnectBtn");
    const disconnectBtn = content.querySelector("#growDisconnectBtn");
    const refreshBtn = content.querySelector("#growRefreshBtn");
    const pasteLink = content.querySelector("#growPasteLink");

    if (pasteLink) {
      pasteLink.addEventListener("click", (e) => {
        e.preventDefault();
        showConnectForm = true;
        renderContent();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        if (isRefreshing) return;
        isRefreshing = true;
        renderContent();
        try {
          const result = await refreshGrowCookies();
          isConnected = result.isConnected === true;
          lastRefreshAt = result.lastRefreshAt || new Date().toISOString();
          if (result.bizToken) bizToken = result.bizToken;
          await loadStatus();
        } catch (e) {
          alert("שגיאה ברענון: " + (e.message || "לא הצלחנו לרענן"));
          await loadStatus();
        } finally {
          isRefreshing = false;
          renderContent();
        }
      });
    }

    if (connectBtn) {
      connectBtn.addEventListener("click", () => {
        window.open("https://grow.website/dashboard", "_blank", "noopener,noreferrer");
      });
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", async () => {
        if (!confirm("למחוק את הקוקיז השמורים? זה יאפס את החיבור ותוכל להתחבר מחדש. לא תתבצע התנתקות מהאתר grow.website.")) return;
        try {
          await disconnectGrow();
          isConnected = false;
          lastRefreshAt = null;
          await loadStatus();
          renderContent();
        } catch (e) {
          alert("שגיאה בהתנתקות: " + (e.message || "לא הצלחנו להתנתק"));
        }
      });
    }
  }

  await loadStatus();

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

  const closeBtn = header.querySelector(".close-grow-connection-btn");
  closeBtn.addEventListener("click", () => closePanel(panel));

  document.addEventListener("keydown", function onEscape(e) {
    if (e.key === "Escape") {
      closePanel(panel);
      document.removeEventListener("keydown", onEscape);
    }
  });
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
