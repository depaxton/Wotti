// QR Code Display Component
// Displays WhatsApp QR code for authentication

/**
 * Creates and returns the QR code display element
 * @returns {HTMLElement} QR code container element
 */
export function createQRCodeDisplay() {
  const container = document.createElement('div');
  container.className = 'qr-code-container';
  container.id = 'qrCodeContainer';
  
  container.innerHTML = `
    <div class="qr-code-content">
      <div class="qr-code-header">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="5" height="5"/>
          <rect x="16" y="3" width="5" height="5"/>
          <rect x="3" y="16" width="5" height="5"/>
          <line x1="8" y1="8" x2="16" y2="8"/>
          <line x1="8" y1="16" x2="16" y2="16"/>
          <line x1="8" y1="8" x2="8" y2="16"/>
          <line x1="16" y1="8" x2="16" y2="16"/>
        </svg>
        <h2>התחברות לוואטסאפ</h2>
        <p>סרוק את קוד ה-QR באמצעות הטלפון כדי להתחבר</p>
      </div>
      <div class="qr-code-wrapper">
        <div class="qr-code-loader" id="qrCodeLoader">
          <div class="loader-spinner"></div>
          <p>מייצר קוד QR...</p>
        </div>
        <canvas id="qrCodeCanvas" style="display: none;"></canvas>
        <img id="qrCodeImage" style="display: none;" alt="QR Code" />
      </div>
      <div class="qr-code-status" id="qrCodeStatus"></div>
    </div>
  `;

  return container;
}

// QR code library loader
let QRCodeLib = null;

/**
 * Loads the QR code library
 * @returns {Promise} Promise that resolves when library is loaded
 */
async function loadQRCodeLibrary() {
  if (QRCodeLib) {
    return QRCodeLib;
  }

  return new Promise((resolve, reject) => {
    // Check if QRCode is already available globally
    if (window.QRCode) {
      QRCodeLib = window.QRCode;
      console.log('QRCode library found globally');
      resolve(QRCodeLib);
      return;
    }

    // Load from CDN - try multiple CDNs for reliability
    console.log('Loading QRCode library from CDN...');
    
    function tryAlternativeCDN() {
      console.log('Trying alternative CDN (unpkg with different path)...');
      const altScript = document.createElement('script');
      // Try different URL format
      altScript.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
      
      altScript.onload = () => {
        if (window.QRCode) {
          QRCodeLib = window.QRCode;
          console.log('QRCode library loaded successfully from jsdelivr');
          resolve(QRCodeLib);
        } else {
          reject(new Error('QRCode library loaded but not available on window object'));
        }
      };
      
      altScript.onerror = (error) => {
        console.error('Failed to load QR code library from all CDNs:', error);
        reject(new Error('Failed to load QR code library from CDN. Please check your internet connection.'));
      };
      
      document.head.appendChild(altScript);
    }
    
    // Try jsdelivr CDN first
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    
    script.onload = () => {
      if (window.QRCode) {
        QRCodeLib = window.QRCode;
        console.log('QRCode library loaded successfully from cdnjs');
        resolve(QRCodeLib);
      } else {
        // Try alternative CDN
        tryAlternativeCDN();
      }
    };
    
    script.onerror = (error) => {
      console.warn('Failed to load from cdnjs, trying alternative CDN...', error);
      tryAlternativeCDN();
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Updates the QR code display with new QR data
 * @param {string} qrData - QR code data string
 */
export async function updateQRCode(qrData) {
  const canvas = document.getElementById('qrCodeCanvas');
  const loader = document.getElementById('qrCodeLoader');
  const status = document.getElementById('qrCodeStatus');
  
  if (!canvas || !loader) {
    console.error('QR code elements not found');
    return;
  }

  if (!qrData) {
    console.warn('No QR code data provided');
    return;
  }

  try {
    console.log('Loading QR code library...');
    // Load QR code library if needed
    await loadQRCodeLibrary();
    console.log('QR code library loaded');

    // Generate QR code
    // whatsapp-web.js returns QR code as comma-separated base64 string
    // The qrcode library can handle this format directly
    console.log('Generating QR code from data:', qrData.substring(0, 50) + '...');
    console.log('QR data length:', qrData.length);
    console.log('QR data type:', typeof qrData);
    
    const qrImage = document.getElementById('qrCodeImage');
    
    try {
      // Try canvas first
      await QRCodeLib.toCanvas(canvas, qrData, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      
      console.log('QR code generated successfully on canvas');
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

      // Hide loader and show canvas
      if (loader) loader.style.display = 'none';
      if (qrImage) qrImage.style.display = 'none';
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
      }
    } catch (qrError) {
      console.error('QRCode.toCanvas error:', qrError);
      console.log('Trying alternative: generating QR code as image...');
      
      try {
        // Try generating as data URL image instead
        const dataUrl = await QRCodeLib.toDataURL(qrData, {
          width: 280,
          margin: 2,
          color: {
            dark: '#1a1a1a',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        
        console.log('QR code generated as image successfully');
        
        // Hide loader and show image
        if (loader) loader.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (qrImage) {
          qrImage.src = dataUrl;
          qrImage.style.display = 'block';
          qrImage.style.visibility = 'visible';
          qrImage.style.opacity = '1';
        }
      } catch (imgError) {
        console.error('QRCode.toDataURL error:', imgError);
        throw imgError; // Re-throw to be caught by outer catch
      }
    }
    
    // Update status
    if (status) {
      status.textContent = 'הקוד מוכן. סרוק עם וואטסאפ.';
      status.className = 'qr-code-status ready';
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    if (status) {
      status.textContent = `שגיאה ביצירת הקוד: ${error.message}`;
      status.className = 'qr-code-status error';
    }
  }
}

/**
 * Updates the QR code display with an image data URL
 * @param {string} imageDataUrl - QR code image as data URL
 */
export async function updateQRCodeFromImage(imageDataUrl) {
  const canvas = document.getElementById('qrCodeCanvas');
  const loader = document.getElementById('qrCodeLoader');
  const qrImage = document.getElementById('qrCodeImage');
  const status = document.getElementById('qrCodeStatus');
  
  if (!loader) {
    console.error('QR code loader not found');
    return;
  }

  if (!imageDataUrl) {
    console.warn('No QR code image data provided');
    return;
  }

  try {
    console.log('Displaying QR code from image data URL...');

    // Hide loader and show image
    if (loader) loader.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (qrImage) {
      qrImage.src = imageDataUrl;
      qrImage.style.display = 'block';
      qrImage.style.visibility = 'visible';
      qrImage.style.opacity = '1';
    }
    
    // Update status
    if (status) {
      status.textContent = 'הקוד מוכן. סרוק עם וואטסאפ.';
      status.className = 'qr-code-status ready';
    }
    
    console.log('QR code image displayed successfully');
  } catch (error) {
    console.error('Error displaying QR code image:', error);
    if (status) {
      status.textContent = `שגיאה בהצגת הקוד: ${error.message}`;
      status.className = 'qr-code-status error';
    }
  }
}

/**
 * Shows loading state
 */
export function showQRCodeLoading() {
  const container = document.getElementById('qrCodeContainer');
  const loader = document.getElementById('qrCodeLoader');
  const canvas = document.getElementById('qrCodeCanvas');
  const qrImage = document.getElementById('qrCodeImage');
  const status = document.getElementById('qrCodeStatus');
  
  // Make sure container is visible when loading (in case it was hidden after authentication)
  if (container) {
    container.style.display = 'block';
  }
  
  if (loader) loader.style.display = 'flex';
  if (canvas) canvas.style.display = 'none';
  if (qrImage) qrImage.style.display = 'none';
  if (status) {
    status.textContent = 'מייצר קוד QR...';
    status.className = 'qr-code-status';
  }
}

/**
 * Shows authenticated state
 */
export function showQRCodeAuthenticated() {
  const container = document.getElementById('qrCodeContainer');
  const status = document.getElementById('qrCodeStatus');
  
  if (status) {
    status.textContent = '✓ מחובר בהצלחה!';
    status.className = 'qr-code-status authenticated';
  }
  
  // Hide QR code after a delay
  if (container) {
    setTimeout(() => {
      container.style.display = 'none';
    }, 2000);
  }
}

/**
 * Shows error state
 * @param {string} message - Error message
 */
export function showQRCodeError(message) {
  const status = document.getElementById('qrCodeStatus');
  if (status) {
    status.textContent = message || 'אירעה שגיאת התחברות';
    status.className = 'qr-code-status error';
  }
}
