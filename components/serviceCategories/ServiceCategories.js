/**
 * Service Categories (קטגוריות שירות) - Component
 * Manages service categories for appointment booking: name, duration, buffer, max per hour.
 */

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : `${window.location.protocol}//${window.location.hostname}:5000`;

/**
 * Creates the Service Categories panel (קטגוריות שירות)
 */
export async function createServiceCategoriesPanel() {
  const chatArea = document.querySelector('.chat-area');
  if (!chatArea) {
    console.error('Chat area not found');
    return;
  }

  chatArea.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'service-categories-panel service-categories-panel-center';

  const { isMobile } = await import('../../utils/mobileNavigation.js');
  if (isMobile()) panel.classList.add('active');

  let categories = [];

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/service-categories`);
      if (res.ok) {
        const data = await res.json();
        categories = data.categories || [];
      }
    } catch (err) {
      console.warn('Could not load service categories:', err);
      categories = [];
    }
  };

  const header = document.createElement('div');
  header.className = 'service-categories-header';
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
      <h2>קטגוריות שירות</h2>
      <p class="service-categories-subtitle">הגדר שירותים כמו מספרה, ספא ועוד – לכל קטגוריה משך טיפול, מרווח ומגבלת פגישות בשעה</p>
    </div>
    <button type="button" class="close-service-categories-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const content = document.createElement('div');
  content.className = 'service-categories-content';

  const listWrap = document.createElement('div');
  listWrap.className = 'service-categories-list-wrap';
  listWrap.innerHTML = '<h3>רשימת קטגוריות</h3>';

  const list = document.createElement('div');
  list.className = 'service-categories-list';

  const addBtnWrap = document.createElement('div');
  addBtnWrap.className = 'service-categories-add-wrap';
  addBtnWrap.innerHTML = '<button type="button" class="service-categories-add-btn">+ הוסף קטגוריה</button>';

  content.appendChild(listWrap);
  listWrap.appendChild(list);
  content.appendChild(addBtnWrap);

  panel.appendChild(header);
  panel.appendChild(content);
  chatArea.appendChild(panel);

  function renderCategoryCard(cat) {
    const card = document.createElement('div');
    card.className = 'service-categories-card';
    card.dataset.id = cat.id;
    const treatments = cat.treatments || [];
    const treatmentsListHtml = treatments.length
      ? treatments.map((t) => renderTreatmentRow(cat.id, t)).join('')
      : '<div class="service-categories-treatments-empty">אין סוגי טיפולים. הוסף סוג טיפול להלן.</div>';
    card.innerHTML = `
      <div class="service-categories-card-header">
        <span class="service-categories-card-name">${escapeHtml(cat.name)}</span>
        <div class="service-categories-card-actions">
          <button type="button" class="service-categories-edit-btn" data-id="${cat.id}" title="עריכה">✏️</button>
          <button type="button" class="service-categories-delete-btn" data-id="${cat.id}" title="מחק">🗑️</button>
        </div>
      </div>
      <div class="service-categories-card-details">
        <span>משך טיפול: ${cat.durationMinutes} דק׳</span>
        <span>מרווח: ${cat.bufferMinutes} דק׳</span>
        <span>מקסימום בשעה: ${cat.maxPerHour}</span>
      </div>
      <div class="service-categories-treatments-wrap">
        <h4 class="service-categories-treatments-title">סוגי טיפולים</h4>
        <div class="service-categories-treatments-list">${treatmentsListHtml}</div>
        <button type="button" class="service-categories-add-treatment-btn" data-category-id="${cat.id}">+ הוסף סוג טיפול</button>
      </div>
    `;
    const addBtn = card.querySelector('.service-categories-add-treatment-btn');
    if (addBtn) addBtn.addEventListener('click', () => openTreatmentModal(cat.id, null));
    return card;
  }

  function renderTreatmentRow(categoryId, t) {
    return `
      <div class="service-categories-treatment-row" data-treatment-id="${t.id}">
        <span class="service-categories-treatment-name" title="לחץ לעריכת שם">${escapeHtml(t.name)}</span>
        <div class="service-categories-treatment-fields">
          <div class="service-categories-stepper-wrap">
            <span class="service-categories-stepper-label">משך (דק׳)</span>
            <div class="service-categories-stepper">
              <button type="button" class="service-categories-stepper-btn" data-dir="-1" data-field="durationMinutes" data-category-id="${categoryId}" data-treatment-id="${t.id}" aria-label="הפחת דקה">−</button>
              <input type="number" class="service-categories-stepper-input" data-field="durationMinutes" data-category-id="${categoryId}" data-treatment-id="${t.id}" value="${t.durationMinutes}" min="1" max="480" step="1" readonly />
              <button type="button" class="service-categories-stepper-btn" data-dir="1" data-field="durationMinutes" data-category-id="${categoryId}" data-treatment-id="${t.id}" aria-label="הוסף דקה">+</button>
            </div>
          </div>
          <div class="service-categories-stepper-wrap">
            <span class="service-categories-stepper-label">מרווח (דק׳)</span>
            <div class="service-categories-stepper">
              <button type="button" class="service-categories-stepper-btn" data-dir="-1" data-field="bufferMinutes" data-category-id="${categoryId}" data-treatment-id="${t.id}" aria-label="הפחת דקה">−</button>
              <input type="number" class="service-categories-stepper-input" data-field="bufferMinutes" data-category-id="${categoryId}" data-treatment-id="${t.id}" value="${t.bufferMinutes}" min="0" max="60" step="1" readonly />
              <button type="button" class="service-categories-stepper-btn" data-dir="1" data-field="bufferMinutes" data-category-id="${categoryId}" data-treatment-id="${t.id}" aria-label="הוסף דקה">+</button>
            </div>
          </div>
        </div>
        <div class="service-categories-treatment-actions">
          <button type="button" class="service-categories-treatment-edit-btn" data-category-id="${categoryId}" data-treatment-id="${t.id}" title="עריכת שם">✏️</button>
          <button type="button" class="service-categories-treatment-delete-btn" data-category-id="${categoryId}" data-treatment-id="${t.id}" title="מחק">🗑️</button>
        </div>
      </div>
    `;
  }

  function handleTreatmentListClick(e) {
    const card = e.target.closest('.service-categories-card');
    if (!card) return;
    const categoryId = card.dataset.id;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;

    const stepperBtn = e.target.closest('.service-categories-stepper-btn[data-category-id][data-treatment-id]');
    if (stepperBtn) {
      e.preventDefault();
      const treatmentId = stepperBtn.dataset.treatmentId;
      const treatment = (cat.treatments || []).find((tr) => tr.id === treatmentId);
      if (!treatment) return;
      const field = stepperBtn.dataset.field;
      const dir = parseInt(stepperBtn.dataset.dir, 10);
      const min = field === 'bufferMinutes' ? 0 : 1;
      const max = field === 'bufferMinutes' ? 60 : 480;
      let val = treatment[field] + dir;
      val = Math.max(min, Math.min(max, val));
      const row = stepperBtn.closest('.service-categories-treatment-row');
      updateTreatmentAndSync(categoryId, treatmentId, { [field]: val }, row, field, val);
      return;
    }

    const editBtn = e.target.closest('.service-categories-treatment-edit-btn');
    if (editBtn) {
      e.preventDefault();
      const treatment = (cat.treatments || []).find((tr) => tr.id === editBtn.dataset.treatmentId);
      if (treatment) openTreatmentModal(categoryId, treatment);
      return;
    }

    const deleteBtn = e.target.closest('.service-categories-treatment-delete-btn');
    if (deleteBtn) {
      e.preventDefault();
      deleteTreatmentConfirm(categoryId, deleteBtn.dataset.treatmentId);
      return;
    }

    const nameEl = e.target.closest('.service-categories-treatment-name');
    if (nameEl) {
      const row = nameEl.closest('.service-categories-treatment-row');
      const treatmentId = row?.dataset?.treatmentId;
      const treatment = (cat.treatments || []).find((tr) => tr.id === treatmentId);
      if (treatment) openTreatmentModal(categoryId, treatment);
    }
  }

  async function updateTreatmentAndSync(categoryId, treatmentId, updates, row, field, displayVal) {
    try {
      const res = await fetch(`${API_URL}/api/service-categories/${categoryId}/treatments/${treatmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        const cat = categories.find((c) => c.id === categoryId);
        if (cat && cat.treatments) {
          const idx = cat.treatments.findIndex((tr) => tr.id === treatmentId);
          if (idx >= 0) cat.treatments[idx] = updated;
        }
        const input = row.querySelector(`.service-categories-stepper-input[data-field="${field}"]`);
        if (input) input.value = displayVal;
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openTreatmentModal(categoryId, existing) {
    const isEdit = !!existing;
    const modal = document.createElement('div');
    modal.className = 'service-categories-modal-overlay service-categories-treatment-modal';
    modal.innerHTML = `
      <div class="service-categories-modal">
        <h3>${isEdit ? 'עריכת סוג טיפול' : 'הוספת סוג טיפול'}</h3>
        <form class="service-categories-form service-categories-treatment-form">
          <label>
            <span>שם סוג הטיפול</span>
            <input type="text" name="name" placeholder="למשל: תספורת גבר, צבע" value="${existing ? escapeHtml(existing.name) : ''}" required />
          </label>
          <label>
            <span>משך הטיפול (דקות)</span>
            <div class="service-categories-stepper service-categories-stepper-inline">
              <button type="button" class="service-categories-stepper-btn modal-duration-minus" aria-label="הפחת">−</button>
              <input type="number" name="durationMinutes" class="service-categories-stepper-input" value="${existing ? existing.durationMinutes : 30}" min="1" max="480" step="1" />
              <button type="button" class="service-categories-stepper-btn modal-duration-plus" aria-label="הוסף">+</button>
            </div>
          </label>
          <label>
            <span>מרווח ברירת מחדל (דקות)</span>
            <div class="service-categories-stepper service-categories-stepper-inline">
              <button type="button" class="service-categories-stepper-btn modal-buffer-minus" aria-label="הפחת">−</button>
              <input type="number" name="bufferMinutes" class="service-categories-stepper-input" value="${existing ? existing.bufferMinutes : 10}" min="0" max="60" step="1" />
              <button type="button" class="service-categories-stepper-btn modal-buffer-plus" aria-label="הוסף">+</button>
            </div>
          </label>
          <div class="service-categories-modal-actions">
            <button type="button" class="service-categories-modal-cancel treatment-modal-cancel">ביטול</button>
            <button type="submit" class="service-categories-modal-save">שמור</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('.service-categories-treatment-form');
    const durationInput = form.querySelector('input[name="durationMinutes"]');
    const bufferInput = form.querySelector('input[name="bufferMinutes"]');

    const stepInput = (input, delta) => {
      const min = parseInt(input.min, 10) || 0;
      const max = parseInt(input.max, 10) || 480;
      let v = (parseInt(input.value, 10) || 0) + delta;
      input.value = Math.max(min, Math.min(max, v));
    };
    modal.querySelector('.modal-duration-minus')?.addEventListener('click', () => stepInput(durationInput, -1));
    modal.querySelector('.modal-duration-plus')?.addEventListener('click', () => stepInput(durationInput, 1));
    modal.querySelector('.modal-buffer-minus')?.addEventListener('click', () => stepInput(bufferInput, -1));
    modal.querySelector('.modal-buffer-plus')?.addEventListener('click', () => stepInput(bufferInput, 1));

    const close = () => modal.remove();
    modal.querySelector('.treatment-modal-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (form.querySelector('input[name="name"]').value || '').trim() || 'טיפול';
      const durationMinutes = Math.max(1, Math.min(480, parseInt(durationInput.value, 10) || 30));
      const bufferMinutes = Math.max(0, Math.min(60, parseInt(bufferInput.value, 10) || 10));
      try {
        if (isEdit) {
          const res = await fetch(`${API_URL}/api/service-categories/${categoryId}/treatments/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, durationMinutes, bufferMinutes }),
          });
          if (res.ok) {
            const updated = await res.json();
            const cat = categories.find((c) => c.id === categoryId);
            if (cat && cat.treatments) {
              const idx = cat.treatments.findIndex((tr) => tr.id === existing.id);
              if (idx >= 0) cat.treatments[idx] = updated;
            }
            renderList();
            close();
          } else {
            const err = await res.json().catch(() => ({}));
            alert('שגיאה בעדכון: ' + (err.error || res.statusText));
          }
        } else {
          const res = await fetch(`${API_URL}/api/service-categories/${categoryId}/treatments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, durationMinutes, bufferMinutes }),
          });
          if (res.ok) {
            const created = await res.json();
            const cat = categories.find((c) => c.id === categoryId);
            if (cat) {
              if (!cat.treatments) cat.treatments = [];
              cat.treatments.push(created);
            }
            renderList();
            close();
          } else {
            const err = await res.json().catch(() => ({}));
            alert('שגיאה בהוספה: ' + (err.error || res.statusText));
          }
        }
      } catch (err) {
        console.error(err);
        alert('שגיאה בשמירה.');
      }
    });
  }

  async function deleteTreatmentConfirm(categoryId, treatmentId) {
    if (!confirm('למחוק סוג טיפול זה?')) return;
    try {
      const res = await fetch(`${API_URL}/api/service-categories/${categoryId}/treatments/${treatmentId}`, { method: 'DELETE' });
      if (res.ok) {
        const cat = categories.find((c) => c.id === categoryId);
        if (cat && cat.treatments) cat.treatments = cat.treatments.filter((t) => t.id !== treatmentId);
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderList() {
    list.innerHTML = '';
    if (categories.length === 0) {
      list.innerHTML = '<div class="service-categories-empty">אין קטגוריות. הוסף קטגוריה כדי לאפשר קביעת תורים לפי סוג שירות.</div>';
      return;
    }
    categories.forEach((cat) => list.appendChild(renderCategoryCard(cat)));
  }

  function openAddModal() {
    openCategoryModal(null);
  }

  function openEditModal(id) {
    const cat = categories.find((c) => c.id === id);
    if (cat) openCategoryModal(cat);
  }

  function openCategoryModal(existing) {
    const isEdit = !!existing;
    const modal = document.createElement('div');
    modal.className = 'service-categories-modal-overlay';
    modal.innerHTML = `
      <div class="service-categories-modal">
        <h3>${isEdit ? 'עריכת קטגוריה' : 'הוספת קטגוריה'}</h3>
        <form class="service-categories-form">
          <label>
            <span>שם הקטגוריה</span>
            <input type="text" name="name" placeholder="למשל: מספרה, ספא" value="${existing ? escapeHtml(existing.name) : ''}" required />
          </label>
          <label>
            <span>משך טיפול (דקות)</span>
            <input type="number" name="durationMinutes" min="5" max="480" step="1" value="${existing ? existing.durationMinutes : 30}" required />
          </label>
          <label>
            <span>מרווח בין פגישות (דקות)</span>
            <input type="number" name="bufferMinutes" min="0" max="60" step="5" value="${existing ? existing.bufferMinutes : 10}" />
          </label>
          <label>
            <span>מקסימום פגישות בשעה</span>
            <input type="number" name="maxPerHour" min="1" max="10" value="${existing ? existing.maxPerHour : 1}" required />
          </label>
          <div class="service-categories-modal-actions">
            <button type="button" class="service-categories-modal-cancel">ביטול</button>
            <button type="submit" class="service-categories-modal-save">שמור</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('.service-categories-form');
    const cancelBtn = modal.querySelector('.service-categories-modal-cancel');

    const close = () => {
      modal.remove();
    };

    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: fd.get('name')?.trim() || 'שירות',
        durationMinutes: Math.max(5, parseInt(fd.get('durationMinutes'), 10) || 30),
        bufferMinutes: Math.max(0, parseInt(fd.get('bufferMinutes'), 10) || 0),
        maxPerHour: Math.max(1, Math.min(10, parseInt(fd.get('maxPerHour'), 10) || 1)),
      };

      try {
        if (isEdit) {
          const res = await fetch(`${API_URL}/api/service-categories/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const updated = await res.json();
            const idx = categories.findIndex((c) => c.id === existing.id);
            if (idx >= 0) categories[idx] = updated;
            renderList();
            close();
          } else {
            const err = await res.json().catch(() => ({}));
            alert('שגיאה בעדכון: ' + (err.error || res.statusText));
          }
        } else {
          const res = await fetch(`${API_URL}/api/service-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const created = await res.json();
            categories.push(created);
            renderList();
            close();
          } else {
            const err = await res.json().catch(() => ({}));
            alert('שגיאה בהוספה: ' + (err.error || res.statusText));
          }
        }
      } catch (err) {
        console.error(err);
        alert('שגיאה בשמירה. בדוק את החיבור לשרת.');
      }
    });
  }

  async function deleteCategory(id) {
    if (!confirm('האם למחוק קטגוריה זו? תורים קיימים יישארו כפי שהם, אך לא ניתן יהיה לקבוע תורים חדשים לקטגוריה זו.')) return;
    try {
      const res = await fetch(`${API_URL}/api/service-categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        categories = categories.filter((c) => c.id !== id);
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

  list.addEventListener('click', (e) => {
    if (e.target.closest('.service-categories-treatments-wrap')) {
      handleTreatmentListClick(e);
      return;
    }
    const editBtn = e.target.closest('.service-categories-edit-btn');
    const deleteBtn = e.target.closest('.service-categories-delete-btn');
    if (editBtn) openEditModal(editBtn.dataset.id);
    if (deleteBtn) deleteCategory(deleteBtn.dataset.id);
  });

  addBtnWrap.querySelector('.service-categories-add-btn').addEventListener('click', openAddModal);

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

  header.querySelector('.close-service-categories-btn').addEventListener('click', closePanel);
  const backBtn = header.querySelector('.panel-back-button');
  if (backBtn) backBtn.addEventListener('click', closePanel);

  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closePanel();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  await loadCategories();
  renderList();
  return panel;
}
