/**
 * Omnia Scanner 3.0
 * Sistema de validación de cupones
 */

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
    // n8n Webhook URLs - CONFIGURA TUS URLS
    N8N_CHECK_URL: 'https://TU-N8N.com/webhook/check-status',
    N8N_COMMIT_URL: 'https://TU-N8N.com/webhook/commit-validation',

    // LocalStorage Keys
    STORAGE_PIN_KEY: 'omnia_store_pin',

    // QR Scanner Config
    QR_FPS: 10,
    QR_BOX_SIZE: 250,

    // Timeouts
    FEEDBACK_DURATION: 3000,
    REQUEST_TIMEOUT: 15000
};

// ========================================
// STATE
// ========================================
let state = {
    storePin: null,
    currentSession: null,
    couponData: null,
    html5QrCode: null,
    isScanning: false
};

// ========================================
// DOM ELEMENTS
// ========================================
const DOM = {
    // PIN Modal
    pinModal: document.getElementById('pin-modal'),
    pinInput: document.getElementById('pin-input'),
    pinSubmit: document.getElementById('pin-submit'),

    // Scanner View
    scannerView: document.getElementById('scanner-view'),
    qrReader: document.getElementById('qr-reader'),
    logoutBtn: document.getElementById('logout-btn'),

    // Coupon Card
    couponCard: document.getElementById('coupon-card'),
    couponTitle: document.getElementById('coupon-title'),
    couponValue: document.getElementById('coupon-value'),
    couponSession: document.getElementById('coupon-session'),
    moneySpent: document.getElementById('money-spent'),
    spendStatus: document.getElementById('spend-status'),
    cancelBtn: document.getElementById('cancel-btn'),
    validateBtn: document.getElementById('validate-btn'),

    // Feedback
    feedbackOverlay: document.getElementById('feedback-overlay'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackMessage: document.getElementById('feedback-message'),
    feedbackClose: document.getElementById('feedback-close'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Check for saved PIN
    const savedPin = localStorage.getItem(CONFIG.STORAGE_PIN_KEY);

    if (savedPin) {
        state.storePin = savedPin;
        showScannerView();
    } else {
        showPinModal();
    }

    // Bind events
    bindEvents();
}

function bindEvents() {
    // PIN Modal
    DOM.pinSubmit.addEventListener('click', handlePinSubmit);
    DOM.pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePinSubmit();
    });

    // Scanner View
    DOM.logoutBtn.addEventListener('click', handleLogout);
    DOM.cancelBtn.addEventListener('click', handleCancel);
    DOM.validateBtn.addEventListener('click', handleValidation);

    // Real-time spend validation
    DOM.moneySpent.addEventListener('input', validateSpendAmount);

    // Feedback
    DOM.feedbackClose.addEventListener('click', closeFeedback);
}

// ========================================
// PIN SYSTEM
// ========================================
function showPinModal() {
    DOM.pinModal.classList.remove('hidden');
    DOM.scannerView.classList.add('hidden');
    DOM.pinInput.focus();
}

function handlePinSubmit() {
    const pin = DOM.pinInput.value.trim();

    if (!pin || pin.length < 4) {
        shakeElement(DOM.pinInput);
        return;
    }

    // Validate PIN against n8n
    showLoading('Verificando PIN...');

    fetch('https://TU-N8N.com/webhook/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
    })
        .then(res => res.json())
        .then(data => {
            hideLoading();

            if (data.valid) {
                // Save PIN
                state.storePin = pin;
                localStorage.setItem(CONFIG.STORAGE_PIN_KEY, pin);
                showScannerView();
            } else {
                shakeElement(DOM.pinInput);
                showFeedback('error', 'PIN Inválido', data.message || 'El PIN no existe o está desactivado');
                DOM.pinInput.value = '';
            }
        })
        .catch(err => {
            hideLoading();
            console.error('PIN validation error:', err);
            shakeElement(DOM.pinInput);
            showFeedback('error', 'Error', 'No se pudo verificar el PIN');
        });
}

function handleLogout() {
    // Clear state and storage
    state.storePin = null;
    state.currentSession = null;
    state.couponData = null;
    localStorage.removeItem(CONFIG.STORAGE_PIN_KEY);

    // Stop scanner
    stopScanner();

    // Reset UI
    DOM.pinInput.value = '';
    DOM.couponCard.classList.add('hidden');

    // Show PIN modal
    showPinModal();
}

function shakeElement(element) {
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
}

// ========================================
// SCANNER VIEW
// ========================================
function showScannerView() {
    DOM.pinModal.classList.add('hidden');
    DOM.scannerView.classList.remove('hidden');

    // Initialize QR Scanner
    initQRScanner();
}

async function initQRScanner() {
    if (state.html5QrCode) {
        return;
    }

    state.html5QrCode = new Html5Qrcode('qr-reader');

    try {
        await state.html5QrCode.start(
            { facingMode: 'environment' },
            {
                fps: CONFIG.QR_FPS,
                qrbox: { width: CONFIG.QR_BOX_SIZE, height: CONFIG.QR_BOX_SIZE }
            },
            onQRCodeScanned,
            onQRCodeError
        );
        state.isScanning = true;
    } catch (err) {
        console.error('Error starting scanner:', err);
        showFeedback('error', 'Error de Cámara', 'No se pudo acceder a la cámara. Por favor, permite el acceso.');
    }
}

function stopScanner() {
    if (state.html5QrCode && state.isScanning) {
        state.html5QrCode.stop().then(() => {
            state.isScanning = false;
        }).catch(console.error);
    }
}

function pauseScanner() {
    if (state.html5QrCode && state.isScanning) {
        state.html5QrCode.pause(true);
    }
}

function resumeScanner() {
    if (state.html5QrCode) {
        state.html5QrCode.resume();
    }
}

// ========================================
// QR CODE HANDLING
// ========================================
function onQRCodeScanned(decodedText) {
    // Prevent multiple scans
    if (state.currentSession) return;

    console.log('QR Scanned:', decodedText);

    // Extract couponsession from URL or direct value
    const sessionId = parseCouponSession(decodedText);

    if (!sessionId) {
        showFeedback('error', 'QR Inválido', 'El código escaneado no contiene un cupón válido.');
        return;
    }

    // Pause scanner and check status
    pauseScanner();
    state.currentSession = sessionId;
    checkCouponStatus(sessionId);
}

function onQRCodeError(error) {
    // Silently ignore - this fires constantly when no QR is visible
}

function parseCouponSession(text) {
    // Try to extract couponsession parameter from URL
    try {
        // If it's a URL
        if (text.includes('http')) {
            const url = new URL(text);

            // Check for couponsession parameter
            const session = url.searchParams.get('couponsession') ||
                url.searchParams.get('session') ||
                url.searchParams.get('cs');

            if (session) return session;

            // Coupontools format: /qrval/campaign_code/session_id
            const qrvalMatch = url.pathname.match(/\/qrval\/[^\/]+\/([a-zA-Z0-9]+)/);
            if (qrvalMatch) return qrvalMatch[1];

            // Alternative: /c/SESSION_ID
            const pathMatch = url.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
            if (pathMatch) return pathMatch[1];

            // Last path segment as fallback
            const segments = url.pathname.split('/').filter(s => s);
            if (segments.length > 0) {
                const lastSegment = segments[segments.length - 1];
                if (/^[a-zA-Z0-9]{8,}$/.test(lastSegment)) {
                    return lastSegment;
                }
            }
        }

        // If it looks like a session ID directly (alphanumeric with dashes)
        if (/^[a-zA-Z0-9-]{8,}$/.test(text)) {
            return text;
        }

        return null;
    } catch (e) {
        // If it's not a valid URL, try as direct session ID
        if (/^[a-zA-Z0-9-]{8,}$/.test(text)) {
            return text;
        }
        return null;
    }
}

// ========================================
// API CALLS
// ========================================
async function checkCouponStatus(sessionId) {
    showLoading('Verificando cupón...');

    try {
        const response = await fetchWithTimeout(CONFIG.N8N_CHECK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                couponsession: sessionId,
                storePin: state.storePin
            })
        });

        hideLoading();

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            handleCheckError(response.status, errorData);
            return;
        }

        const data = await response.json();
        state.couponData = data;

        // Show coupon info
        showCouponCard(data);

    } catch (error) {
        hideLoading();
        console.error('Check error:', error);
        showFeedback('error', 'Error de Conexión', 'No se pudo conectar con el servidor. Verifica tu conexión.');
        resetState();
    }
}

async function handleValidation() {
    if (!state.currentSession || !state.couponData) {
        return;
    }

    showLoading('Validando cupón...');

    const moneySpent = DOM.moneySpent.value ? parseFloat(DOM.moneySpent.value) : null;

    try {
        const response = await fetchWithTimeout(CONFIG.N8N_COMMIT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                couponsession: state.currentSession,
                money_spent: moneySpent,
                storePin: state.storePin
            })
        });

        hideLoading();

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            handleCommitError(response.status, errorData);
            return;
        }

        // Success!
        showFeedback(
            'success',
            '¡Cupón Validado!',
            `Se ha canjeado correctamente: ${state.couponData.title || 'Cupón'}`
        );

        resetState();

    } catch (error) {
        hideLoading();
        console.error('Validation error:', error);
        showFeedback('error', 'Error de Conexión', 'No se pudo completar la validación. Inténtalo de nuevo.');
    }
}

function handleCheckError(status, data) {
    resetState();

    switch (status) {
        case 401:
            showFeedback('error', 'PIN Incorrecto', 'El PIN de tienda no es válido. Contacta con tu administrador.');
            handleLogout();
            break;
        case 403:
            showFeedback('error', 'FUERA DE HORARIO', data.message || 'No es posible validar cupones fuera del horario de atención.');
            break;
        case 404:
            showFeedback('error', 'Cupón No Encontrado', 'El cupón escaneado no existe en el sistema.');
            break;
        case 409:
            showFeedback('error', 'Cupón Ya Utilizado', 'Este cupón ya fue canjeado anteriormente.');
            break;
        case 410:
            showFeedback('error', 'Cupón Expirado', data.message || 'Este cupón ha superado su fecha de validez.');
            break;
        case 425:
            showFeedback('error', 'CUPÓN NO VÁLIDO AÚN', data.message || 'Este cupón será válido a partir de mañana.');
            break;
        default:
            showFeedback('error', 'Error', data.message || 'Ocurrió un error al verificar el cupón.');
    }
}

function handleCommitError(status, data) {
    switch (status) {
        case 401:
            showFeedback('error', 'PIN Incorrecto', 'La sesión ha expirado. Vuelve a iniciar sesión.');
            handleLogout();
            break;
        case 402:
            // Min spend not met
            showFeedback('error', 'GASTO MÍNIMO NO ALCANZADO', data.message || 'El importe del ticket no cumple el mínimo requerido.');
            // Don't reset - let them try again with correct amount
            break;
        case 403:
            showFeedback('error', 'FUERA DE HORARIO', data.message || 'El horario de validación ha terminado.');
            resetState();
            break;
        case 409:
            showFeedback('error', 'Cupón Ya Utilizado', 'Este cupón fue canjeado mientras intentabas validarlo.');
            resetState();
            break;
        case 410:
            showFeedback('error', 'Cupón Expirado', data.message || 'Este cupón ha expirado.');
            resetState();
            break;
        default:
            showFeedback('error', 'Error de Validación', data.message || 'No se pudo validar el cupón. Inténtalo de nuevo.');
    }
}

function fetchWithTimeout(url, options = {}) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), CONFIG.REQUEST_TIMEOUT)
        )
    ]);
}

// ========================================
// UI UPDATES
// ========================================
function showCouponCard(data) {
    DOM.couponTitle.textContent = data.title || 'Cupón';
    DOM.couponValue.textContent = data.value || data.discount || '---';
    DOM.couponSession.textContent = `ID: ${state.currentSession}`;
    DOM.moneySpent.value = '';

    // Show min spend requirement if exists
    const minSpend = data.min_spend_required || 0;
    state.couponData.min_spend = minSpend;

    // Update money_spent input placeholder and label
    const moneyLabel = DOM.moneySpent.parentElement.parentElement.querySelector('label');
    if (minSpend > 0) {
        moneyLabel.innerHTML = `Importe del ticket <strong style="color: var(--color-warning);">(Mínimo: ${minSpend}€)</strong>`;
        DOM.moneySpent.placeholder = `Mínimo ${minSpend}€`;
        DOM.moneySpent.required = true;
        // Hide validate button until amount is valid
        DOM.validateBtn.classList.add('hidden');
    } else {
        moneyLabel.textContent = 'Importe del ticket (opcional)';
        DOM.moneySpent.placeholder = '0.00';
        DOM.moneySpent.required = false;
        // Show validate button if no minimum
        DOM.validateBtn.classList.remove('hidden');
    }

    // Reset validation state
    DOM.moneySpent.classList.remove('valid', 'invalid');
    DOM.spendStatus.classList.remove('show', 'valid', 'invalid');
    DOM.spendStatus.textContent = '';

    DOM.couponCard.classList.remove('hidden');
}

function hideCouponCard() {
    DOM.couponCard.classList.add('hidden');
}

function handleCancel() {
    resetState();
}

function resetState() {
    state.currentSession = null;
    state.couponData = null;
    DOM.moneySpent.value = '';
    DOM.moneySpent.classList.remove('valid', 'invalid');
    DOM.spendStatus.classList.remove('show', 'valid', 'invalid');
    DOM.spendStatus.textContent = '';
    DOM.validateBtn.classList.remove('hidden');
    hideCouponCard();
    resumeScanner();
}

// ========================================
// SPEND VALIDATION
// ========================================
function validateSpendAmount() {
    const minSpend = state.couponData?.min_spend || 0;

    // If no minimum required, always valid
    if (minSpend <= 0) {
        DOM.moneySpent.classList.remove('valid', 'invalid');
        DOM.spendStatus.classList.remove('show');
        DOM.validateBtn.classList.remove('hidden');
        return;
    }

    const currentValue = parseFloat(DOM.moneySpent.value) || 0;
    const difference = minSpend - currentValue;

    if (currentValue >= minSpend) {
        // Valid - green state
        DOM.moneySpent.classList.remove('invalid');
        DOM.moneySpent.classList.add('valid');
        DOM.spendStatus.classList.remove('invalid');
        DOM.spendStatus.classList.add('show', 'valid');
        DOM.spendStatus.textContent = '✅ Importe válido';
        DOM.validateBtn.classList.remove('hidden');
    } else {
        // Invalid - red state
        DOM.moneySpent.classList.remove('valid');
        DOM.moneySpent.classList.add('invalid');
        DOM.spendStatus.classList.remove('valid');
        DOM.spendStatus.classList.add('show', 'invalid');
        DOM.spendStatus.textContent = `❌ Faltan ${difference.toFixed(2)}€ para el mínimo`;
        DOM.validateBtn.classList.add('hidden');
    }
}

// ========================================
// FEEDBACK SYSTEM
// ========================================
function showFeedback(type, title, message) {
    // Set icon
    DOM.feedbackIcon.textContent = type === 'success' ? '✅' : '❌';

    // Set text
    DOM.feedbackTitle.textContent = title;
    DOM.feedbackMessage.textContent = message;

    // Set color class
    DOM.feedbackOverlay.className = 'feedback-overlay ' + type;
    DOM.feedbackOverlay.classList.remove('hidden');

    // Vibrate on mobile (if supported)
    if (navigator.vibrate) {
        navigator.vibrate(type === 'success' ? [100, 50, 100] : [200, 100, 200]);
    }
}

function closeFeedback() {
    DOM.feedbackOverlay.classList.add('hidden');
    resumeScanner();
}

// ========================================
// LOADING SYSTEM
// ========================================
function showLoading(text = 'Cargando...') {
    DOM.loadingText.textContent = text;
    DOM.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    DOM.loadingOverlay.classList.add('hidden');
}

// ========================================
// SERVICE WORKER (Optional PWA)
// ========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment if you add a service-worker.js
        // navigator.serviceWorker.register('/service-worker.js');
    });
}

// ========================================
// ADD SHAKE ANIMATION CSS
// ========================================
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-10px); }
        40%, 80% { transform: translateX(10px); }
    }
    .shake {
        animation: shake 0.5s ease-in-out;
    }
`;
document.head.appendChild(style);
