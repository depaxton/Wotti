// Contact Action Choice - Shows when user selects a contact
// Two options: קביעת תזכורת (default) | תשלום מהיר (only when connected to payment system)

import { createChatArea } from '../chat/ChatArea.js';
import { createQuickPaymentPanel } from '../payment/QuickPaymentPanel.js';
import { isMobile, createMobileBackButton, showContactsSidebar } from '../../utils/mobileNavigation.js';

const API_BASE = '/api';

async function fetchGrowStatus() {
  try {
    const res = await fetch(`${API_BASE}/grow/status`);
    if (!res.ok) return { isConnected: false };
    const data = await res.json();
    return data;
  } catch {
    return { isConnected: false };
  }
}

/**
 * Creates the full contact action view: 2 tab buttons + content area
 * Default: קביעת תזכורת (reminder interface)
 * תשלום מהיר shown only when user is connected to GROW payment system
 * @param {Object} contact - Contact object
 * @param {HTMLElement} [parentElement] - If provided, append to DOM first so getElementById works
 * @returns {Promise<HTMLElement>} The main container
 */
export async function createContactActionChoice(contact, parentElement) {
  const container = document.createElement('div');
  container.className = 'contact-action-container';

  const contentArea = document.createElement('div');
  contentArea.className = 'contact-action-content';

  const growStatus = await fetchGrowStatus();
  const isPaymentConnected = growStatus.isConnected === true;

  const paymentTabHtml = isPaymentConnected
    ? `
      <button type="button" class="contact-action-tab" data-action="payment">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
        <span>תשלום מהיר</span>
      </button>
    `
    : '';

  container.innerHTML = `
    <div class="contact-action-tabs">
      <button type="button" class="contact-action-tab selected" data-action="reminder">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>קביעת תזכורת</span>
      </button>
      ${paymentTabHtml}
    </div>
  `;

  container.appendChild(contentArea);

  // Append to DOM first so createChatArea's getElementById finds elements (fixes default not showing)
  if (parentElement) {
    parentElement.appendChild(container);
  }

  // Add mobile back button
  if (isMobile()) {
    const backButton = createMobileBackButton(() => {
      const chatArea = document.querySelector('.chat-area');
      if (chatArea) {
        chatArea.innerHTML = `
          <div class="chat-placeholder" id="chatPlaceholder">
            <div class="placeholder-content">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h2>בחר איש קשר כדי להכניס תזכורות</h2>
              <p>התזכורות שלך יופיעו כאן</p>
            </div>
          </div>
        `;
        chatArea.classList.remove('active');
        showContactsSidebar();
      }
    });
    container.insertBefore(backButton, container.firstChild);
  }

  const tabs = container.querySelectorAll('.contact-action-tab');

  async function showReminder() {
    contentArea.innerHTML = '<div class="contact-action-loading">טוען...</div>';
    await createChatArea(contact, { target: contentArea, hideBackButton: true });
  }

  async function showPayment() {
    contentArea.innerHTML = '<div class="contact-action-loading">טוען...</div>';
    const paymentPanel = createQuickPaymentPanel(contact);
    contentArea.innerHTML = '';
    contentArea.appendChild(paymentPanel);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      tabs.forEach((t) => t.classList.remove('selected'));
      tab.classList.add('selected');
      const action = tab.dataset.action;
      if (action === 'reminder') {
        await showReminder();
      } else if (action === 'payment') {
        await showPayment();
      }
    });
  });

  // Default: show reminder
  await showReminder();

  return container;
}
