/**
 * Ready Messages Panel (הודעות מוכנות)
 * Add and manage pre-made messages (text, image, video, or image+text) with auto-increment INDEX.
 */

const API_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : `${window.location.protocol}//${window.location.hostname}:5000`;
const BASE = `${API_URL}/api/ready-messages`;

const TYPE_LABELS = {
  text: 'טקסט בלבד',
  image: 'תמונה',
  video: 'וידאו',
  text_image: 'תמונה + טקסט',
  text_video: 'וידאו + טקסט',
};

/** Detects message type from form: text + optional file (image/video). */
function detectType(hasText, file) {
  if (!file) return hasText ? 'text' : null;
  const isVideo = (file.type || '').startsWith('video/');
  const isImage = (file.type || '').startsWith('image/');
  if (isVideo) return hasText ? 'text_video' : 'video';
  if (isImage) return hasText ? 'text_image' : 'image';
  return hasText ? 'text_image' : 'image';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export async function createReadyMessagesPanel() {
  const chatArea = document.querySelector('.chat-area');
  if (!chatArea) {
    console.error('Chat area not found');
    return;
  }

  chatArea.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'ready-messages-panel ready-messages-panel-center';

  const { isMobile } = await import('../../utils/mobileNavigation.js');
  if (isMobile()) panel.classList.add('active');

  let messages = [];
  let nextIndex = 1;

  const header = document.createElement('div');
  header.className = 'ready-messages-header';
  header.innerHTML = `
    ${isMobile() ? `
      <button type="button" class="panel-back-button" aria-label="חזור" title="חזור">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>חזרה</span>
      </button>
    ` : ''}
    <div class="panel-header-content">
      <h2>הודעות מוכנות</h2>
      <p class="ready-messages-subtitle">הוסף הודעות מוכנות לשימוש בשליחת הודעות בתוכנה. ניתן לבחור מספר INDEX או להשאיר את ההצעה האוטומטית.</p>
    </div>
    <button type="button" class="close-ready-messages-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const content = document.createElement('div');
  content.className = 'ready-messages-content';

  // Left: add form (order 2 in RTL so it appears on the left)
  const formSection = document.createElement('div');
  formSection.className = 'ready-messages-form-section';
  formSection.innerHTML = `
    <h3>הוסף הודעה מוכנה</h3>
    <p class="ready-messages-form-hint">הזן טקסט ו/או בחר קובץ תמונה/וידאו – הסוג ייקבע אוטומטית</p>
    <form class="ready-messages-add-form" id="readyMessagesAddForm">
      <div class="ready-messages-form-row ready-messages-index-row">
        <label>
          <span>INDEX (ניתן לבחור מספר)</span>
          <input type="number" id="rmNextIndex" name="index" min="1" step="1" value="1" class="ready-messages-index-input" />
        </label>
      </div>
      <div class="ready-messages-form-row">
        <label>
          <span>טקסט</span>
          <textarea id="rmText" name="text" rows="4" placeholder="הטקסט של ההודעה (אופציונלי אם יש קובץ)..."></textarea>
        </label>
      </div>
      <div class="ready-messages-form-row">
        <label>
          <span>קובץ תמונה או וידאו</span>
          <input type="file" id="rmFile" name="file" accept="image/*,video/*" />
        </label>
      </div>
      <div class="ready-messages-form-actions">
        <button type="submit" class="ready-messages-save-btn">שמור הודעה</button>
      </div>
    </form>
  `;

  // Right: list (order 1 in RTL so it appears on the right)
  const listSection = document.createElement('div');
  listSection.className = 'ready-messages-list-section';
  listSection.innerHTML = `
    <h3>רשימת הודעות <span class="ready-messages-count" id="rmCount">0</span></h3>
    <div class="ready-messages-list" id="rmList"></div>
  `;

  content.appendChild(formSection);
  content.appendChild(listSection);
  panel.appendChild(header);
  panel.appendChild(content);
  chatArea.appendChild(panel);

  const rmNextIndex = formSection.querySelector('#rmNextIndex');
  const rmFile = formSection.querySelector('#rmFile');
  const addForm = formSection.querySelector('#readyMessagesAddForm');
  const listEl = listSection.querySelector('#rmList');
  const countEl = listSection.querySelector('#rmCount');

  async function loadMessages() {
    try {
      const res = await fetch(BASE);
      if (res.ok) {
        const data = await res.json();
        messages = data.messages || [];
        nextIndex = data.nextIndex ?? 1;
        rmNextIndex.value = nextIndex;
      }
    } catch (err) {
      console.warn('Could not load ready messages', err);
      messages = [];
    }
  }

  function renderList() {
    countEl.textContent = messages.length;
    listEl.innerHTML = '';
    if (messages.length === 0) {
      listEl.innerHTML = '<div class="ready-messages-empty">אין הודעות מוכנות. הוסף הודעה מהטופס בצד שמאל.</div>';
      return;
    }
    messages.forEach((msg) => {
      const card = document.createElement('div');
      card.className = 'ready-messages-card';
      card.dataset.id = msg.id;
      const typeLabel = TYPE_LABELS[msg.type] || msg.type;
      const textPreview = msg.text ? (msg.text.length > 80 ? msg.text.slice(0, 80) + '…' : msg.text) : '—';
      const isImage = msg.type === 'image' || msg.type === 'text_image';
      const isVideo = msg.type === 'video' || msg.type === 'text_video';
      const mediaPreview =
        msg.mediaPath && isImage
          ? `<img src="${BASE}/${msg.id}/media" alt="" class="ready-messages-card-thumb" onerror="this.style.display='none'" />`
          : msg.mediaPath && isVideo
            ? `<video src="${BASE}/${msg.id}/media" class="ready-messages-card-thumb" controls list="none" muted></video>`
            : '';
      card.innerHTML = `
        <div class="ready-messages-card-top">
          <span class="ready-messages-card-index">INDEX: ${msg.index}</span>
          <span class="ready-messages-card-type">${escapeHtml(typeLabel)}</span>
          <div class="ready-messages-card-actions">
            <button type="button" class="ready-messages-edit-btn" data-id="${msg.id}" title="עריכה">✏️</button>
            <button type="button" class="ready-messages-delete-btn" data-id="${msg.id}" title="מחק">🗑️</button>
          </div>
        </div>
        ${mediaPreview ? `<div class="ready-messages-card-media">${mediaPreview}</div>` : ''}
        ${msg.text ? `<p class="ready-messages-card-text">${escapeHtml(textPreview)}</p>` : ''}
      `;
      listEl.appendChild(card);
    });
  }

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = formSection.querySelector('#rmText').value.trim();
    const fileInput = rmFile;
    const hasText = text.length > 0;
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    const type = detectType(hasText, file);

    if (!type) {
      alert('הזן טקסט ו/או בחר קובץ תמונה או וידאו');
      return;
    }

    const indexNum = parseInt(rmNextIndex.value, 10);
    const index = indexNum >= 1 ? indexNum : undefined;

    let mediaBase64 = null;
    let mimeType = null;
    if (file) {
      mimeType = file.type;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      mediaBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
    }

    try {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text: text || '', mediaBase64, mimeType, index }),
      });
      if (res.ok) {
        const created = await res.json();
        messages.push(created);
        await loadMessages();
        renderList();
        addForm.reset();
        rmFile.value = '';
      } else {
        const err = await res.json().catch(() => ({}));
        alert('שגיאה בהוספה: ' + (err.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירה. בדוק את החיבור לשרת.');
    }
  });

  listEl.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.ready-messages-edit-btn');
    const deleteBtn = e.target.closest('.ready-messages-delete-btn');
    if (editBtn) openEditModal(editBtn.dataset.id);
    if (deleteBtn) deleteMessageById(deleteBtn.dataset.id);
  });

  function openEditModal(id) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    const modal = document.createElement('div');
    modal.className = 'ready-messages-modal-overlay';
    modal.innerHTML = `
      <div class="ready-messages-modal">
        <h3>עריכת הודעה INDEX ${msg.index}</h3>
        <form class="ready-messages-edit-form" data-id="${msg.id}">
          <input type="hidden" name="id" value="${msg.id}" />
          <div class="ready-messages-form-row">
            <label><span>טקסט</span>
              <textarea name="text" rows="3">${escapeHtml(msg.text)}</textarea>
            </label>
          </div>
          <div class="ready-messages-form-row">
            <label><span>קובץ חדש (אופציונלי – להחליף תמונה/וידאו)</span>
              <input type="file" name="file" accept="image/*,video/*" />
            </label>
          </div>
          <div class="ready-messages-modal-actions">
            <button type="button" class="ready-messages-modal-cancel">ביטול</button>
            <button type="submit" class="ready-messages-modal-save">שמור</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('.ready-messages-edit-form');
    const cancelBtn = modal.querySelector('.ready-messages-modal-cancel');

    const close = () => modal.remove();

    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = form.querySelector('textarea[name="text"]').value.trim();
      const fileInput = form.querySelector('input[name="file"]');
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      const hasText = text.length > 0;
      const type = file ? detectType(hasText, file) : msg.type;
      if (!type) {
        alert('הזן טקסט ו/או בחר קובץ');
        return;
      }
      let mediaBase64 = null;
      let mimeType = null;
      if (file) {
        mimeType = file.type;
        mediaBase64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.replace(/^data:[^;]+;base64,/, ''));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
      }
      try {
        const res = await fetch(`${BASE}/${msg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, text, mediaBase64, mimeType }),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = messages.findIndex((m) => m.id === msg.id);
          if (idx >= 0) messages[idx] = updated;
          renderList();
          close();
        } else {
          const err = await res.json().catch(() => ({}));
          alert('שגיאה בעדכון: ' + (err.error || res.statusText));
        }
      } catch (err) {
        console.error(err);
        alert('שגיאה בשמירה.');
      }
    });
  }

  async function deleteMessageById(id) {
    if (!confirm('האם למחוק הודעה מוכנה זו?')) return;
    try {
      const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        messages = messages.filter((m) => m.id !== id);
        const nextRes = await fetch(`${BASE}/next-index`);
        if (nextRes.ok) {
          const d = await nextRes.json();
          nextIndex = d.nextIndex ?? nextIndex;
          rmNextIndex.value = nextIndex;
        }
        renderList();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('שגיאה במחיקה: ' + (err.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה במחיקה.');
    }
  }

  function closePanel() {
    import('../../utils/mobileNavigation.js').then(({ isMobile, showContactsSidebar }) => {
      if (isMobile()) showContactsSidebar();
      const ca = document.querySelector('.chat-area');
      if (ca) {
        ca.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'chat-placeholder';
        placeholder.id = 'chatPlaceholder';
        placeholder.innerHTML = `
          <div class="placeholder-content">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h2>בחר איש קשר כדי להכניס תזכורות</h2>
            <p>התזכורות שלך יופיעו כאן</p>
          </div>
        `;
        ca.appendChild(placeholder);
      }
    });
  }

  header.querySelector('.close-ready-messages-btn').addEventListener('click', closePanel);
  const backBtn = header.querySelector('.panel-back-button');
  if (backBtn) backBtn.addEventListener('click', closePanel);

  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closePanel();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  await loadMessages();
  renderList();
  return panel;
}
