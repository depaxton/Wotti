// Quick Payment Panel - תשלום מהיר
// Form for creating quick payments, adapted to Wotti styling

/**
 * Creates the Quick Payment form panel
 * @param {Object} contact - Contact object (name, phone, etc.)
 * @returns {HTMLElement} The payment panel
 */
export function createQuickPaymentPanel(contact) {
  const panel = document.createElement('div');
  panel.className = 'quick-payment-panel';

  const contactName = contact.name || contact.phone || 'לקוח';
  const contactPhone = contact.phone || '';

  panel.innerHTML = `
    <div class="quick-payment-header">
      <h2>תשלום מהיר</h2>
      <p>יצירת תשלום עבור <strong>${escapeHtml(contactName)}</strong></p>
    </div>

    <div class="quick-payment-section">
      <div class="quick-payment-label">סוג התשלום</div>
      <div class="quick-payment-type-selector">
        <button type="button" class="quick-payment-type-btn" data-type="recurring">הוראת קבע</button>
        <button type="button" class="quick-payment-type-btn selected" data-type="regular">רגיל</button>
      </div>
    </div>

    <div class="quick-payment-section">
      <div class="quick-payment-label">גובה התשלום</div>
      <div class="quick-payment-amount-selector">
        <button type="button" class="quick-payment-amount-btn selected" data-mode="amount">לפי סכום</button>
        <button type="button" class="quick-payment-amount-btn" data-mode="product">לפי מוצר / שירות</button>
      </div>
      <div class="quick-payment-amount-fields" id="amountFields">
        <div class="quick-payment-field-row">
          <label>הסכום (חובה)</label>
          <div class="quick-payment-input-with-prefix">
            <span class="prefix">₪</span>
            <input type="text" id="paymentAmount" placeholder="0" inputmode="decimal" />
          </div>
        </div>
        <div class="quick-payment-field-row">
          <label>עבור מה</label>
          <input type="text" id="paymentFor" placeholder="תיאור התשלום" />
        </div>
      </div>
      <div class="quick-payment-package-link hidden" id="packageLink">
        <button type="button" class="quick-payment-link-btn">
          <span class="link-dots">⋯</span>
          בחירת חבילה
          <span class="link-dots">⋯</span>
        </button>
      </div>
    </div>

    <div class="quick-payment-section">
      <div class="quick-payment-label">מי משלם?</div>
      <div class="quick-payment-payer-selector">
        <button type="button" class="quick-payment-payer-btn selected" data-payer="existing">לקוח קיים</button>
        <button type="button" class="quick-payment-payer-btn" data-payer="guest">לקוח מזדמן</button>
      </div>
      <div class="quick-payment-payer-fields">
        <div class="quick-payment-field-row guest-only hidden">
          <label>שם מלא (חובה)</label>
          <input type="text" id="payerName" placeholder="שם מלא" />
        </div>
        <div class="quick-payment-field-row">
          <label>טלפון (חובה)</label>
          <input type="tel" id="payerPhone" placeholder="מספר טלפון" value="${escapeHtml(contactPhone)}" />
        </div>
        <div class="quick-payment-field-row">
          <label>מייל</label>
          <input type="email" id="payerEmail" placeholder="דוא״ל" />
        </div>
        <div class="quick-payment-checkboxes">
          <label class="quick-payment-checkbox">
            <input type="checkbox" id="invoiceOtherName" />
            <span>החשבונית על שם אחר</span>
          </label>
          <label class="quick-payment-checkbox">
            <input type="checkbox" id="addBusinessId" />
            <span>הוספת מספר עוסק / ח"פ</span>
          </label>
        </div>
      </div>
    </div>

    <div class="quick-payment-section">
      <div class="quick-payment-label">כמה פעמים לחייב?</div>
      <div class="quick-payment-field-row">
        <label>מספר תשלומים (חובה)</label>
        <select id="paymentCount">
          <option value="1" selected>1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="12">12</option>
        </select>
      </div>
      <label class="quick-payment-checkbox">
        <input type="checkbox" id="authOnly" />
        <span>תפיסת מסגרת בלבד (J5)</span>
      </label>
    </div>

    <div class="quick-payment-section">
      <div class="quick-payment-label">איך לחייב?</div>
      <div class="quick-payment-methods">
        <button type="button" class="quick-payment-method-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span>כרטיס אשראי</span>
        </button>
        <button type="button" class="quick-payment-method-btn">
          <span>bit</span>
          <span>ביט</span>
        </button>
        <button type="button" class="quick-payment-method-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span>יצירת לינק חד-פעמי</span>
        </button>
        <button type="button" class="quick-payment-method-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          </svg>
          <span>מסוף</span>
        </button>
      </div>
    </div>
  `;

  // Type selector (הוראת קבע | רגיל)
  const typeBtns = panel.querySelectorAll('.quick-payment-type-btn');
  typeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      typeBtns.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Amount mode (לפי סכום | לפי מוצר)
  const amountBtns = panel.querySelectorAll('.quick-payment-amount-btn');
  const amountFields = panel.querySelector('#amountFields');
  const packageLink = panel.querySelector('#packageLink');
  amountBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      amountBtns.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      const isAmount = btn.dataset.mode === 'amount';
      amountFields?.classList.toggle('hidden', !isAmount);
      packageLink?.classList.toggle('hidden', isAmount);
    });
  });

  // Payer type (לקוח קיים | לקוח מזדמן)
  const payerBtns = panel.querySelectorAll('.quick-payment-payer-btn');
  const guestFields = panel.querySelectorAll('.guest-only');
  payerBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      payerBtns.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      const isGuest = btn.dataset.payer === 'guest';
      guestFields.forEach((el) => el.classList.toggle('hidden', !isGuest));
    });
  });

  // Method buttons - visual feedback
  panel.querySelectorAll('.quick-payment-method-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.quick-payment-method-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  return panel;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}
