// ====================================================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (MANDATORIO)
// ====================================================================
// ...existing code...
import { initializeApp as firebaseInitializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales de entorno (proporcionadas por el canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-pos-app-id';
let firebaseConfig = null;
try {
    if (typeof __firebase_config !== 'undefined') {
        firebaseConfig = JSON.parse(__firebase_config);
    } else if (typeof window !== 'undefined' && window.__firebase_config) {
        firebaseConfig = window.__firebase_config;
    } else if (typeof document !== 'undefined') {
        const meta = document.querySelector('meta[name="firebase-config"]')?.getAttribute('content');
        if (meta) firebaseConfig = JSON.parse(meta);
    }
} catch (e) {
    console.warn("Error parsing Firebase config:", e);
    firebaseConfig = null;
}
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db = null;
let auth = null;
let userId = 'anonymous';

/**
 Inicializa Firebase, maneja la autenticación y establece el listener de estado.
*/
window.initializeApp = async function () {
    if (!firebaseConfig) {
        // INFO en vez de ERROR: la app usa fallback a localStorage y funciona sin Firebase.
        console.info("Firebase no configurado: usando fallback local (localStorage). Para habilitar Firebase, define window.__firebase_config (objeto) o la variable __firebase_config (JSON string) antes de cargar app.js, o añade <meta name=\"firebase-config\" content='...json...'/>.");
        initializeDataListeners();
        return;
    }

    try {
        const app = firebaseInitializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                console.log("Usuario autenticado. ID:", userId);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Fallo la autenticación, continuando como anónimo si es posible.", error);
                }
            }
            initializeDataListeners();
        });
    } catch (error) {
        console.error("Error crítico al inicializar Firebase:", error);
        initializeDataListeners();
    }
};

// ====================================================================
// ESTADO DE LA APLICACIÓN
// ====================================================================
const state = {
    currentView: 'cart', // 'topup', 'payment', 'checkout', 'movements', 'cart'
    cart: [],
    commission: { type: 'percentage', value: 0, amount: 0 },
    subtotal: 0,
    total: 0,
    quickEntryValue: '0',
    quickEntryPrice: 0,
    quickEntryName: 'Artículo Rápido',
    topupSelectedOperator: null, // operador seleccionado
    topupSelectedPlan: null,     // plan seleccionado (se mostrará en confirmación)
    selectedService: null,       // servicio seleccionado en el menú de Servicios

    // --- Datos de ejemplo para Movimientos (puedes ajustar/añadir) ---
    movements: [
        { id: 1, date: '2025-11-06', time: '09:12', statusCode: 'OK-001', amount: 150.00 },
        { id: 2, date: '2025-11-06', time: '10:05', statusCode: 'OK-002', amount: 250.50 },
        { id: 3, date: '2025-11-06', time: '11:45', statusCode: 'ERR-01', amount: 0.00 }
    ],
    movementsPeriod: { from: '2025-11-06', to: '2025-11-06' }
};

const topUpOperators = [
    { name: "AT&T", icon: '<svg class="w-6 h-6 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="M5 7h14"/></svg>' },
    { name: "Bait", icon: '<svg class="w-6 h-6 text-pink-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/></svg>' },
    { name: "Movistar", icon: '<svg class="w-6 h-6 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12c4-8 8-8 10 0 2-8 6-8 8 0"/></svg>' },
    { name: "Telcel", icon: '<svg class="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8"/></svg>' },
    { name: "Telmex", icon: '<svg class="w-6 h-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>' },
    { name: "Unefon", icon: '<svg class="w-6 h-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><circle cx="12" cy="12" r="3"/></svg>' },
    { name: "Virgin Mobile", icon: '<svg class="w-6 h-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/><path d="M12 3v18"/></svg>' }
];

// ----------------------
// NUEVAS CATEGORÍAS DE SERVICIOS
// ----------------------
const serviceCategories = [
    { name: "Agua y drenaje", icon: '<svg class="w-6 h-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s-4 5-4 8a4 4 0 1 0 8 0c0-3-4-8-4-8z"/><path d="M12 12v6"/></svg>' },
    { name: "Catálogos", icon: '<svg class="w-6 h-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8"/></svg>' },
    { name: "Gas y electricidad", icon: '<svg class="w-6 h-6 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6"/><path d="M6 10h12l-6 12z"/></svg>' },
    { name: "Gobiernos", icon: '<svg class="w-6 h-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 4-3 2-6-3-6 3-3-2 9-4z"/><path d="M3 10v7a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-7"/></svg>' },
    { name: "Lotería", icon: '<svg class="w-6 h-6 text-pink-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/></svg>' },
    { name: "Movilidad", icon: '<svg class="w-6 h-6 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/><rect x="3" y="7" width="18" height="6" rx="2"/></svg>' },
    { name: "Servicios digitales", icon: '<svg class="w-6 h-6 text-teal-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M7 21h10"/></svg>' },
    { name: "TV e internet", icon: '<svg class="w-6 h-6 text-blue-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="M8 3l4 4 4-4"/></svg>' }
];

// ----------------------
// PROVEEDORES POR SERVICIO (ejemplos)
// ----------------------
const serviceProviders = {
    "Agua y drenaje": [
        { name: "Agua de Quintana Roo (AguaKan)", code: "AGUAKAN" },
        { name: "Agua de Salamanca (CMPAS)", code: "CMPAS" },
        { name: "Agua de Durango (AMD)", code: "AMD" },
        { name: "Agua de San Luis Potosí (Interapas)", code: "INTERAPAS" },
        { name: "Agua de Guadalajara (SIAPA)", code: "SIAPA" },
        { name: "Agua del Estado de México (AMIAC)", code: "AMIAC" }
    ],
    "Catálogos": [
        { name: "Price shoes", code: "CAT-A" },
        { name: "Avon", code: "CAT-B" },
        { name: "Tupperware", code: "CAT-C" },
        { name: "Calzado Andrea", code: "CAT-D" },
        { name: "Betterware", code: "CAT-E" },
        { name: "Jafra", code: "CAT-F" },
        { name: "Natura", code: "CAT-G" },
        { name: "YANBAL", code: "CAT-H" },
        { name: "Arabella", code: "CAT-I" },
        { name: "Fuller", code: "CAT-J" },
        { name: "L'BEL", code: "CAT-K" }
    ],
    "Gas y electricidad": [
        { name: "CFE", code: "CFE" },
        { name: "Gas Natural Fenosa", code: "GNF" },
        { name: "Gas LP", code: "GASLP" },
        { name: "Energía Eléctrica de Yucatán (ENEL)", code: "ENEL" },
        { name: "Comisión de Agua y Energía de Oaxaca (CAEO)", code: "CAEO" },
        { name: "Comisión Federal de Electricidad (CFE)", code: "CFE" },
    ],
    "Gobiernos": [
        { name: "Pago de Tenencia", code: "TENENCIA" },
        { name: "Pago de Predial", code: "PREDIAL" },
        { name: "Pago de Multas de Tránsito", code: "MULTAS" },
        { name: "Pago de Impuestos Estatales", code: "IMPUESTOS" },
        { name: "Pago de Derechos Vehiculares", code: "DERECHOS_VEHICULARES" },
        { name: "Pago de Licencias de Conducir", code: "LICENCIAS" },
    ],
    "Lotería": [
        { name: "Lotería Nacional", code: "LOTERIA_NACIONAL" },
        { name: "Pronósticos para la Asistencia Pública", code: "PRONOSTICOS" },
        { name: "Lotería Instantánea", code: "LOTERIA_INSTANTANEA" }
    ],
    "Movilidad": [
        { name: "Tarjeta de Transporte Público", code: "TARJETA_TP" },
        { name: "Pago de Peajes", code: "PEAJES" },
        { name: "Recarga de Tarjetas de Metro", code: "RECARGA_METRO" }
    ],
    "Servicios digitales": [
        { name: "Netflix", code: "NETFLIX" },
        { name: "Spotify", code: "SPOTIFY" },
        { name: "Amazon Prime Video", code: "AMAZON_PRIME" },
        { name: "HBO Max", code: "HBO_MAX" },
        { name: "Disney+", code: "DISNEY_PLUS" }
    ],
    "TV e internet": [
        { name: "Izzi", code: "IZZI" },
        { name: "Totalplay", code: "TOTALPLAY" },
        { name: "Megacable", code: "MEGACABLE" },
        { name: "Sky", code: "SKY" },
        { name: "Axtel", code: "AXTEL" }
    ]
    

    // agrega otras listas según necesites
};

function getProvidersForService(serviceName) {
    return serviceProviders[serviceName] ? [...serviceProviders[serviceName]] : [];
}

// Referencia del documento en Firestore (usando estructura por usuario)
function getPosDocRef() {
    // Si Firebase aún no está inicializado, devolver null para que la lógica superior lo maneje
    if (!db) return null;

    // Si el usuario está autenticado con UID, guardamos en la ruta por usuario
    if (userId && userId !== 'anonymous') {
        return doc(db, 'artifacts', appId, 'users', userId, 'pos_state', 'current_state');
    }

    // Fallback: si hay db pero sesión anónima, usamos un documento público por appId
    // Esto permite persistir estado incluso sin usuario autenticado
    return doc(db, 'artifacts', appId, 'public_pos_state', 'current_state');
}

function initializeDataListeners() {
    const posDocRef = getPosDocRef();
    if (posDocRef) {
        onSnapshot(posDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                Object.assign(state, data);
                if (!state.commission) state.commission = { type: 'percentage', value: 0, amount: 0 };
                console.log("Estado sincronizado desde Firestore:", state);
            } else {
                saveStateToFirestore();
            }
            window.renderApp();
        }, (error) => {
            console.error("Error al escuchar cambios en Firestore:", error);
        });
    } else {
        window.renderApp();
    }
}

function saveStateToFirestore() {
    const posDocRef = getPosDocRef();

    // Si no hay instancia de Firestore, fallback a localStorage
    if (!posDocRef) {
        try {
            const stateToSave = { ...state };
            delete stateToSave.quickEntryValue;
            delete stateToSave.quickEntryPrice;
            delete stateToSave.quickEntryName;
            localStorage.setItem(`syspago_state_${appId}`, JSON.stringify(stateToSave));
            console.info("Estado guardado en localStorage (Firebase no está listo).");
        } catch (e) {
            console.error("No se pudo guardar el estado en localStorage:", e);
        }
        return;
    }

    const stateToSave = { ...state };
    delete stateToSave.quickEntryValue;
    delete stateToSave.quickEntryPrice;
    delete stateToSave.quickEntryName;

    setDoc(posDocRef, stateToSave, { merge: true })
        .catch(error => console.error("Error guardando estado en Firestore:", error));
}

// ====================================================================
// LÓGICA PRINCIPAL
// ====================================================================
function calculateTotals() {
    state.subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const commissionValue = parseFloat(state.commission.value) || 0;
    if (state.commission.type === 'percentage') {
        state.commission.amount = state.subtotal * (commissionValue / 100);
    } else {
        state.commission.amount = commissionValue;
    }
    state.total = state.subtotal + state.commission.amount;

    state.subtotal = parseFloat(state.subtotal.toFixed(2));
    state.commission.amount = parseFloat((state.commission.amount || 0).toFixed(2));
    state.total = parseFloat((state.total || 0).toFixed(2));

    if (state.currentView === 'checkout') renderCheckoutView();
    saveStateToFirestore();
}

function addItemToCart(name, price, quantity = 1) {
    if (!name || price <= 0 || quantity <= 0) return;
    const existingItem = state.cart.find(item => item.name === name && item.price === price);
    if (existingItem) existingItem.quantity += quantity;
    else state.cart.push({ id: Date.now(), name, price: parseFloat(Number(price).toFixed(2)), quantity });

    calculateTotals();
    window.renderApp();
    window.showToast(`${name} agregado al carrito.`);
}

function updateItemQuantity(itemId, newQuantity) {
    const item = state.cart.find(i => i.id === itemId);
    if (!item) return;
    if (newQuantity <= 0) state.cart = state.cart.filter(i => i.id !== itemId);
    else item.quantity = newQuantity;
    calculateTotals();
    window.renderApp();
}

window.removeItem = function (itemId) {
    state.cart = state.cart.filter(item => item.id !== itemId);
    calculateTotals();
    window.renderApp();
    window.showToast("Artículo eliminado del carrito.");
}

window.processQuickEntry = function (key) {
    let currentValue = state.quickEntryValue || '0';
    if (key === 'AC') currentValue = '0';
    else if (key === 'DEL') currentValue = currentValue.length > 1 ? currentValue.slice(0, -1) : '0';
    else if (key === '.') {
        if (!currentValue.includes('.')) currentValue += '.';
    } else if (/^[0-9]$/.test(key)) {
        if (currentValue === '0') currentValue = key;
        else {
            if (currentValue.includes('.')) {
                const decimals = currentValue.split('.')[1];
                if (decimals && decimals.length >= 2) return;
            }
            currentValue += key;
        }
    }

    let newPrice = parseFloat(currentValue);
    if (isNaN(newPrice)) newPrice = 0;
    state.quickEntryValue = currentValue;
    state.quickEntryPrice = newPrice;
    renderCartView();
}

window.addQuickItem = function () {
    const price = state.quickEntryPrice;
    if (price > 0) {
        addItemToCart(state.quickEntryName, price, 1);
        state.quickEntryValue = '0';
        state.quickEntryPrice = 0;
    }
    renderCartView();
}

window.openCommissionModal = function () {
    const modal = document.getElementById('commission-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const selector = `input[name="commissionType"][value="${state.commission.type}"]`;
    const inputEl = document.querySelector(selector);
    if (inputEl) inputEl.checked = true;

    window.toggleCommissionInput(state.commission.type);

    if (state.commission.type === 'percentage') {
        const perc = document.getElementById('commission-percentage');
        if (perc) perc.value = state.commission.value;
    } else {
        const fixed = document.getElementById('commission-fixed');
        if (fixed) fixed.value = state.commission.value;
    }

    window.updateModalCommissionAmount();
}

window.closeCommissionModal = function () {
    const modal = document.getElementById('commission-modal');
    if (!modal) return;
    modal.classList.add('hidden');
}

window.toggleCommissionInput = function (type) {
    const percGroup = document.getElementById('commission-percentage-group');
    const fixedGroup = document.getElementById('commission-fixed-group');
    if (!percGroup || !fixedGroup) return;
    if (type === 'percentage') {
        percGroup.classList.remove('hidden');
        fixedGroup.classList.add('hidden');
    } else {
        percGroup.classList.add('hidden');
        fixedGroup.classList.remove('hidden');
    }
}

window.updateModalCommissionAmount = function () {
    const checked = document.querySelector('input[name="commissionType"]:checked');
    if (!checked) return;
    const type = checked.value;
    let value = 0;
    if (type === 'percentage') value = parseFloat(document.getElementById('commission-percentage')?.value) || 0;
    else value = parseFloat(document.getElementById('commission-fixed')?.value) || 0;

    let calculatedAmount = type === 'percentage' ? state.subtotal * (value / 100) : value;
    const el = document.getElementById('modal-commission-amount');
    if (el) el.textContent = window.formatCurrency(calculatedAmount);
}

window.applyCommission = function () {
    const checked = document.querySelector('input[name="commissionType"]:checked');
    if (!checked) return;
    const type = checked.value;
    const value = type === 'percentage' ? parseFloat(document.getElementById('commission-percentage')?.value) || 0 : parseFloat(document.getElementById('commission-fixed')?.value) || 0;

    state.commission.type = type;
    state.commission.value = value;

    calculateTotals();
    window.closeCommissionModal();
    window.showToast("Comisión aplicada correctamente.");
}

// Aceptar phoneNumber opcional (ahora los planes no requieren número)
window.addTopupToCart = function (operatorName, amount, phoneNumber) {
    if (!operatorName || isNaN(amount) || amount <= 0) {
        window.showToast("Datos de recarga inválidos.", 'error');
        return;
    }
    const label = phoneNumber ? `Recarga ${operatorName} (${phoneNumber})` : `Recarga ${operatorName}`;
    addItemToCart(label, parseFloat(amount), 1);
    window.showToast(`${window.formatCurrency(amount)} agregado al carrito.`, 'success');
    window.changeView('cart');
}

// Simulación de procesamiento de pago
window.processPayment = function (method) {
    if (state.total <= 0) {
        window.showToast("No hay un monto válido para procesar el pago.", 'error');
        return;
    }

    saveTransaction({
        date: serverTimestamp(),
        total: state.total,
        subtotal: state.subtotal,
        commission: state.commission,
        items: state.cart,
        paymentMethod: method,
        status: 'Completed'
    });

    window.showMessageBox('Pago Exitoso',
        `Transacción de ${window.formatCurrency(state.total)} procesada con éxito usando ${method}.`,
        () => {
            state.cart = [];
            state.commission = { type: 'percentage', value: 0, amount: 0 };
            calculateTotals();
            window.changeView('cart');
        }
    );
}

function saveTransaction(transactionData) {
    if (!db) return;
    const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    addDoc(collectionRef, transactionData)
        .then(() => console.log("Transacción guardada exitosamente."))
        .catch(error => console.error("Error guardando transacción:", error));
}

// ====================================================================
// RENDERS (uso de template literals, sin JSX)
// ====================================================================
function renderCartView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const cartItemsHtml = state.cart.length === 0
        ? `<p class="text-center text-gray-500 py-6">El carrito está vacío. Agrega artículos con el teclado.</p>`
        : state.cart.map(item => `
            <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border" data-id="${item.id}">
                <div class="flex-grow">
                    <p class="font-semibold text-gray-800">${item.name} x${item.quantity}</p>
                    <p class="text-sm text-gray-600">Precio unitario: ${window.formatCurrency(item.price)}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold">${window.formatCurrency(item.price * item.quantity)}</p>
                    <button data-action="remove-item" class="mt-2 text-sm text-red-600">Eliminar</button>
                </div>
            </div>
        `).join('');

    const cartHtml = `
        <div class="h-full flex flex-col">
            <h2 class="text-xl font-bold mb-4 text-gray-800">PV Venta | Carrito de Compras (${state.cart.length} Artículos)</h2>

            <div id="cart-list" class="flex-grow space-y-3 p-2 bg-gray-50 rounded-lg overflow-y-auto mb-4 border">
                ${cartItemsHtml}
            </div>

            <div class="p-3 bg-white border-t rounded-t-lg shadow-md flex justify-between items-center mt-2">
                <div class="text-sm">
                    <span class="text-gray-500">Subtotal:</span>
                    <span id="display-subtotal" class="font-medium text-gray-700">${window.formatCurrency(state.subtotal)}</span>
                </div>
                <div class="text-2xl font-extrabold">
                    <span class="text-gray-800">TOTAL:</span>
                    <span id="display-total" class="text-green-600">${window.formatCurrency(state.total)}</span>
                </div>
            </div>

            <div class="p-4 bg-gray-100 rounded-lg shadow-inner mt-2">
                <div class="flex items-center justify-between mb-3 p-3 bg-white rounded-lg border shadow-md">
                    <span class="text-gray-500 text-sm">${state.quickEntryName}</span>
                    <span class="text-3xl font-mono font-extrabold text-gray-900">${window.formatCurrency(state.quickEntryPrice)}</span>
                </div>
                <div class="grid grid-cols-4 gap-2">
                    <button class="keypad-button" data-key="7">7</button>
                    <button class="keypad-button" data-key="8">8</button>
                    <button class="keypad-button" data-key="9">9</button>
                    <button class="keypad-button bg-red-400 text-white hover:bg-red-500" data-key="AC">AC</button>

                    <button class="keypad-button" data-key="4">4</button>
                    <button class="keypad-button" data-key="5">5</button>
                    <button class="keypad-button" data-key="6">6</button>
                    <button class="keypad-button bg-yellow-400 hover:bg-yellow-500" data-key="DEL">DEL</button>

                    <button class="keypad-button" data-key="1">1</button>
                    <button class="keypad-button" data-key="2">2</button>
                    <button class="keypad-button" data-key="3">3</button>
                    <button class="keypad-button bg-green-500 text-white hover:bg-green-600 row-span-2" data-action="add-quick-item">Agregar</button>

                    <button class="keypad-button" data-key="0">0</button>
                    <button class="keypad-button col-span-2" data-key=".">.</button>
                </div>
            </div>
        </div>
    `;
    mainContent.innerHTML = cartHtml;
}

function renderTopupView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const operatorsHtml = topUpOperators.map(op => `
        <button class="operator-button flex items-center space-x-3 p-3 w-full text-left bg-white rounded-lg border hover:bg-gray-50"
            data-action="select-operator"
            data-operator-name="${op.name}">
            <div class="w-6 h-6 flex-shrink-0">${op.icon}</div>
            <span class="flex-grow text-sm font-medium">${op.name}</span>
        </button>
    `).join('');

    const topupHtml = `
        <h2 class="text-xl font-bold mb-4 text-gray-800">Seleccionar plan y operador</h2>
        <div class="grid gap-3">
            ${operatorsHtml}
        </div>
    `;
    mainContent.innerHTML = topupHtml;
}

function renderTopupFormView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const operator = state.topupSelectedOperator || '';
    const formHtml = `
        <h2 class="text-xl font-bold mb-4 text-gray-800">Recarga — ${operator}</h2>

        <div class="bg-white p-4 rounded-xl shadow border space-y-4">
            <div>
                <label for="topup-phone" class="block text-sm font-medium text-gray-700 mb-2">Número de Teléfono</label>
                <input id="topup-phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10 dígitos (Ej: 5512345678)" class="w-full p-3 border border-gray-300 rounded-lg text-lg">
            </div>

            <div>
                <label for="topup-phone-confirm" class="block text-sm font-medium text-gray-700 mb-2">Confirmar Número</label>
                <input id="topup-phone-confirm" type="tel" inputmode="numeric" maxlength="10" placeholder="Reingresa el número" class="w-full p-3 border border-gray-300 rounded-lg text-lg">
            </div>

            <div class="flex justify-between items-center space-x-3">
                <button data-action="back-to-topup" class="w-1/3 bg-gray-100 text-gray-800 py-3 rounded-lg">Volver</button>
                <button data-action="confirm-topup-phone" class="w-2/3 bg-blue-600 text-white py-3 rounded-lg font-bold">Continuar</button>
            </div>
        </div>
    `;
    mainContent.innerHTML = formHtml;
}

window.openTopupForm = function (operatorName) {
    if (!operatorName) return;
    state.topupSelectedOperator = operatorName;
    window.changeView('topup-form');
}

function renderTopupPlansView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    const operator = state.topupSelectedOperator || '';

    // Ejemplo de planes con descripción (puedes extender/ajustar)
    const plans = [
        { amount: 20, title: '$20.00', desc: '200 MB para navegar — 1 día' },
        { amount: 30, title: '$30.00', desc: '300 MB para navegar — 3 días' },
        { amount: 50, title: '$50.00', desc: '500 MB para navegar — 5 días' },
        { amount: 80, title: '$80.00', desc: '1 GB para navegar — 7 días' },
        { amount: 150, title: '$150.00', desc: '3 GB para navegar — 30 días' }
    ];

    const operatorHtml = `
        <div class="bg-white p-3 rounded-lg shadow-sm border flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100">
                ${topUpOperators.find(o => o.name === operator)?.icon || ''}
            </div>
            <div>
                <div class="text-sm text-gray-500">Operador</div>
                <div class="font-semibold text-lg">${operator}</div>
            </div>
        </div>
    `;

    const plansHtml = plans.map((plan, idx) => `
        <button data-action="select-plan"
            data-plan-index="${idx}"
            data-plan-amount="${plan.amount}"
            data-plan-title="${encodeURIComponent(plan.title)}"
            data-plan-desc="${encodeURIComponent(plan.desc)}"
            data-operator="${operator}"
            class="w-full text-left p-4 bg-white border rounded-lg shadow-sm hover:bg-blue-50 flex justify-between items-start space-x-4">
            <div>
                <div class="text-xl font-extrabold text-blue-600">${plan.title}</div>
                <div class="text-sm text-gray-600 mt-1">${plan.desc}</div>
            </div>
            <div class="text-right">
                <div class="text-sm text-gray-500">Seleccionar</div>
            </div>
        </button>
    `).join('');

    const html = `
        <h2 class="text-xl font-bold mb-2 text-gray-800">1. Seleccionar plan y operador</h2>
        ${operatorHtml}
        <h3 class="text-sm text-gray-600 mb-2">2. Selecciona el monto a cargar</h3>
        <div class="grid gap-3">
            ${plansHtml}
        </div>
    `;
    mainContent.innerHTML = html;
}

function renderTopupPlanConfirmView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const operator = state.topupSelectedOperator || '';
    const plan = state.topupSelectedPlan || { amount: 0, title: '', desc: '' };

    const html = `
        <h2 class="text-xl font-bold mb-2 text-gray-800">1. Seleccionar plan y operador</h2>

        <div class="bg-white p-3 rounded-lg shadow-sm border flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100">
                ${topUpOperators.find(o => o.name === operator)?.icon || ''}
            </div>
            <div>
                <div class="text-sm text-gray-500">Operador</div>
                <div class="font-semibold text-lg">${operator}</div>
            </div>
        </div>

        <h3 class="text-sm text-gray-600 mb-2">2. Selecciona el monto a cargar</h3>
        <div class="bg-white p-4 rounded-lg shadow border mb-4">
            <div class="text-xl font-extrabold text-blue-600">${plan.title}</div>
            <div class="text-sm text-gray-600 mt-1">${plan.desc}</div>
        </div>

        <h3 class="text-sm text-gray-600 mb-2">3. Ingresa el número de teléfono</h3>
        <div class="bg-white p-4 rounded-lg shadow border space-y-3">
            <div>
                <input id="confirm-topup-phone" type="tel" inputmode="numeric" maxlength="10" placeholder="Número telefónico" class="w-full p-3 border border-gray-300 rounded-lg text-lg">
            </div>
            <div>
                <input id="confirm-topup-phone-repeat" type="tel" inputmode="numeric" maxlength="10" placeholder="Confirmar número de teléfono" class="w-full p-3 border border-gray-300 rounded-lg text-lg">
            </div>

            <div class="flex gap-3">
                
                <button data-action="confirm-topup-payment" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold">Pagar</button>
            </div>
        </div>
    `;
    mainContent.innerHTML = html;
}

// RENDER: listado de proveedores para el servicio seleccionado
function renderServiceProvidersView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const svc = state.selectedService || 'Servicios';
    const icon = (serviceCategories.find(s => s.name === svc)?.icon) || '<svg class="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/></svg>';
    const providers = getProvidersForService(svc);

    const providersHtml = providers.map(p => `
        <button data-action="select-provider" data-provider-name="${p.name}" data-provider-code="${p.code}"
            class="w-full text-left p-3 bg-white border rounded-lg shadow-sm hover:bg-gray-50 flex items-center justify-between">
            <div>
                <div class="text-sm font-medium text-gray-800">${p.name}</div>
                <div class="text-xs text-gray-500">${p.code}</div>
            </div>
            <div class="text-sm text-gray-400">Seleccionar</div>
        </button>
    `).join('');

    const html = `
        <div>
            <h2 class="text-xl font-bold mb-4 flex items-center justify-between">
                <span class="flex items-center"><span class="mr-3">${icon}</span>${svc}</span>
            </h2>

            <div class="mb-4">
                <div class="relative">
                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>
                    </span>
                    <input id="service-search" type="text" placeholder="Buscar" class="w-full pl-10 pr-3 py-3 border rounded-lg" />
                </div>
            </div>

            <div id="service-providers-list" class="grid gap-3">
                ${providersHtml || `<p class="text-gray-500 text-center py-6">No hay proveedores configurados para este servicio.</p>`}
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // lógica de filtrado local (añadida después de renderizar)
    const input = document.getElementById('service-search');
    const listEl = document.getElementById('service-providers-list');
    if (!input || !listEl) return;

    input.addEventListener('input', (ev) => {
        const q = (ev.target.value || '').trim().toLowerCase();
        const filtered = providers.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
        listEl.innerHTML = filtered.map(p => `
            <button data-action="select-provider" data-provider-name="${p.name}" data-provider-code="${p.code}"
                class="w-full text-left p-3 bg-white border rounded-lg shadow-sm hover:bg-gray-50 flex items-center justify-between">
                <div>
                    <div class="text-sm font-medium text-gray-800">${p.name}</div>
                    <div class="text-xs text-gray-500">${p.code}</div>
                </div>
                <div class="text-sm text-gray-400">Seleccionar</div>
            </button>
        `).join('') || `<p class="text-gray-500 text-center py-6">No hay coincidencias.</p>`;
    });
}

window.openTopupPlans = function (operatorName) {
    if (!operatorName) return;
    state.topupSelectedOperator = operatorName;
    window.changeView('topup-plans');
}

window.openTopupPlanSelection = function (operatorName, phoneNumber) {
    // phoneNumber puede venir desde confirmación del formulario
    const phone = phoneNumber || '';
    if (!/^\d{10}$/.test(phone)) {
        window.showToast("Número inválido o no provisto.", 'error');
        return;
    }

    const plans = [50, 80, 100, 150, 200, 300].map(amount => ({ amount, details: `${amount} pesos` }));
    const plansHtml = `
        <h3 class="text-xl font-bold mb-3 text-blue-700">2. Planes para ${operatorName} — ${phone}</h3>
        <div class="grid grid-cols-3 gap-3">
            ${plans.map(plan => `
                <button class="p-4 bg-white border border-blue-200 rounded-lg shadow hover:bg-blue-100 transition"
                    data-action="add-topup-to-cart"
                    data-operator="${operatorName}"
                    data-amount="${plan.amount}"
                    data-phone="${phone}">
                    <span class="text-xl font-extrabold text-blue-600">${window.formatCurrency(plan.amount)}</span>
                    <div class="text-sm text-gray-600">${plan.details}</div>
                </button>
            `).join('')}
        </div>
    `;
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.innerHTML = plansHtml;
    window.showToast(`Planes cargados para ${operatorName}.`, 'success');
}

// RENDER: listado de servicios (vista principal de "Servicios")
function renderPaymentView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const servicesHtml = serviceCategories.map(s => `
        <button data-action="select-service" data-service-name="${s.name}"
            class="w-full text-left p-3 bg-white border rounded-lg shadow-sm hover:bg-gray-50 flex items-center space-x-3">
            <div class="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full">${s.icon}</div>
            <div class="flex-grow">
                <div class="text-sm font-medium text-gray-800">${s.name}</div>
                <div class="text-xs text-gray-500">Pagar / Consultar ${s.name.toLowerCase()}</div>
            </div>
            <div class="text-sm text-gray-400">Seleccionar</div>
        </button>
    `).join('');

    const html = `
        <div>
            <h2 class="text-xl font-bold mb-4 flex items-center"><span class="mr-3">${/* icon placeholder */''}</span>Servicios</h2>
            <div class="grid gap-3">
                ${servicesHtml}
            </div>
        </div>
    `;
    mainContent.innerHTML = html;
}


function renderPaymentFormView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const svc = state.selectedService || 'Servicios';
    const provider = state.selectedProvider ? `${state.selectedProvider.name}` : null;
    const providerCode = state.selectedProvider ? `${state.selectedProvider.code}` : '';
    const icon = (serviceCategories.find(s => s.name === svc)?.icon) || '<svg class="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg>';

    const extraCharge = 12.00;

    const paymentHtml = `
        <div>
            <h2 class="text-2xl font-bold mb-4 text-blue-700 flex items-center">
                <span class="mr-3">${icon}</span>
                ${provider || svc}
            </h2>

            <div class="bg-white p-6 rounded-xl shadow-lg border space-y-4">
                <div>
                    <label class="block text-sm text-gray-600 mb-2">Referencia</label>
                    <div class="relative">
                        <input id="service-reference" type="text" placeholder="Referencia" class="w-full pl-4 pr-12 py-3 border rounded-lg" />
                        <button id="service-ref-camera" data-action="open-camera" title="Abrir cámara" class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-gray-600 hover:bg-gray-100">
                            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7h2l2-3h8l2 3h2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </button>
                    </div>
                    <div class="mt-2 text-sm">
                        <a id="help-pay-link" href="#" class="text-blue-600 underline">¿Tienes duda de como pagar?</a>
                    </div>
                </div>

                <div>
                    <label class="block text-sm text-gray-600 mb-2">Monto a pagar</label>
                    <input id="service-amount" type="number" min="0.01" step="0.01" placeholder="$ Monto a pagar" class="w-full p-3 border rounded-lg text-lg" />
                </div>

                <div class="text-sm text-gray-700">
                    <div class="flex justify-between items-center">
                        <span>Cobro extra:</span>
                        <span id="service-extra-charge" class="font-medium text-gray-800">${window.formatCurrency(extraCharge)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-2 text-lg font-semibold">
                        <span>Total:</span>
                        <span id="service-total" class="text-green-600">${window.formatCurrency(0)}</span>
                    </div>
                </div>

                <div class="pt-2">
                    <button data-action="process-service-payment" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Pagar</button>
                </div>
            </div>
        </div>
    `;
    mainContent.innerHTML = paymentHtml;

    // Helper: actualizar total cuando cambie el monto
    const amtEl = document.getElementById('service-amount');
    const totalEl = document.getElementById('service-total');
    const extraEl = document.getElementById('service-extra-charge');

    function updateTotal() {
        const v = parseFloat(amtEl?.value) || 0;
        const total = parseFloat((v + extraCharge).toFixed(2));
        if (totalEl) totalEl.textContent = window.formatCurrency(total);
        if (extraEl) extraEl.textContent = window.formatCurrency(extraCharge);
    }

    if (amtEl) {
        amtEl.addEventListener('input', updateTotal);
        // si ya hay un monto en state (por ejemplo prefijado), cargarlo
        if (state.prefillAmount) {
            amtEl.value = String(state.prefillAmount);
            updateTotal();
        }
    }
}

function renderCheckoutView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const commissionLabel = state.commission.type === 'percentage' ? `Comisión (${state.commission.value}%)` : `Comisión (Fija)`;

    const checkoutHtml = `
        <h2 class="text-2xl font-bold mb-4 text-blue-700">Syspago | Generar Cobro</h2>
        <div class="bg-white p-6 rounded-xl shadow-lg border space-y-4">
            <div class="space-y-2 border-b pb-4">
                <div class="flex justify-between text-lg text-gray-700">
                    <span>Subtotal de Artículos:</span>
                    <span class="font-semibold">${window.formatCurrency(state.subtotal)}</span>
                </div>
                <div class="flex justify-between text-lg text-red-600">
                    <span>${commissionLabel}:</span>
                    <span class="font-semibold">${window.formatCurrency(state.commission.amount)}</span>
                </div>
            </div>
            <div class="flex justify-between items-center text-3xl font-extrabold text-green-700">
                <span>TOTAL A COBRAR:</span>
                <span>${window.formatCurrency(state.total)}</span>
            </div>
            <button data-action="open-commission-modal" class="w-full bg-yellow-100 text-yellow-800 py-3 rounded-lg font-bold">Aplicar Comisión</button>
            <div class="pt-4 space-y-3">
                <button data-action="process-payment" data-method="Efectivo" class="w-full bg-green-600 text-white py-4 rounded-lg font-extrabold text-xl">COBRAR EN EFECTIVO</button>
                <button data-action="process-payment" data-method="Tarjeta" class="w-full bg-purple-600 text-white py-4 rounded-lg font-extrabold text-xl">COBRAR CON TARJETA</button>
            </div>
            ${state.cart.length === 0 ? '<p class="text-center text-red-500 mt-4">No hay artículos para cobrar.</p>' : ''}
        </div>
    `;
    mainContent.innerHTML = checkoutHtml;
}

function renderMovementsView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const movements = Array.isArray(state.movements) ? state.movements : [];
    const count = movements.length;
    const periodFrom = (state.movementsPeriod && state.movementsPeriod.from) || new Date().toISOString().slice(0, 10);
    const periodTo = (state.movementsPeriod && state.movementsPeriod.to) || new Date().toISOString().slice(0, 10);

    const rowsHtml = movements.length ? movements.map(m => `
        <div class="grid grid-cols-6 gap-2 items-center p-3 border-b">
            <div class="col-span-1 text-sm text-gray-700">${m.date || '-'}</div>
            <div class="col-span-1 text-sm text-gray-700">${m.time || '-'}</div>
            <div class="col-span-2 text-sm text-gray-700">${m.statusCode || '-'}</div>
            <div class="col-span-1 text-right font-semibold text-gray-800">${window.formatCurrency(m.amount || 0)}</div>
            <div class="col-span-1 text-right">
                <button data-action="print-move" data-move-id="${m.id || ''}" class="text-sm text-blue-600 hover:underline">Imprimir</button>
            </div>
        </div>
    `).join('') : `<div class="p-8 text-center text-gray-500">No hay movimientos para el periodo seleccionado.</div>`;

    const html = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div class="text-sm text-gray-600">Periodo: (${periodFrom})-(${periodTo})</div>
                <div class="text-sm text-blue-600"><a href="#" data-action="movements-count">${count} movimientos</a></div>
            </div>

            <div class="flex gap-3">
                <button data-action="send-report" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">ENVIAR REPORTE POR CORREO</button>
                <button data-action="show-summary" class="flex-1 bg-white border border-gray-300 py-2 rounded-lg font-semibold">RESUMEN</button>
            </div>

            <div>
                <button data-action="reportes-pv" class="w-full bg-blue-700 text-white py-3 rounded-lg font-bold">REPORTES PV</button>
            </div>

            <div class="bg-white mt-2 rounded-lg shadow-sm border overflow-hidden">
                <div class="grid grid-cols-6 gap-2 p-3 bg-gray-50 border-b text-xs uppercase text-gray-500 font-medium">
                    <div>Fecha</div>
                    <div>Hora</div>
                    <div class="col-span-2">Codigo de estatus</div>
                    <div class="text-right">Monto</div>
                    <div class="text-right">Imprimir</div>
                </div>

                <div id="movements-list">
                    ${rowsHtml}
                </div>
            </div>
        </div>
    `;
    mainContent.innerHTML = html;
}


// ------------------------------------------------------------------
// Navegación y historial simple
// ------------------------------------------------------------------
window.goBack = function () {
    const hist = window.__syspago_view_history || [];
    const prev = hist.pop();
    window.__syspago_view_history = hist;
    if (prev) {
        // cambiar directamente sin agregar al historial
        state.currentView = prev;
        window.renderApp();
    } else {
        // fallback al inicio
        state.currentView = 'cart';
        window.renderApp();
    }
};



// =====================
// BOTTOM-SHEET: Confirmación de cobro para recargas
// =====================
window.createTopupChargeModal = function () {
    if (document.getElementById('topup-charge-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'topup-charge-modal';
    modal.className = 'fixed inset-0 z-[70] pointer-events-none';

    modal.innerHTML = `
        <div id="topup-charge-overlay" class="absolute inset-0 bg-black bg-opacity-40 opacity-0 transition-opacity duration-200"></div>

        <div id="topup-charge-sheet" class="absolute left-0 right-0 bottom-0 transform translate-y-full transition-transform duration-300 pointer-events-auto">
            <div class="mx-auto w-full max-w-md bg-white rounded-t-xl shadow-xl p-4 border-t">
                <div class="flex justify-between items-start">
                    <div class="text-sm text-gray-500">Confirmación de Recarga</div>
                    <button data-action="cancel-topup-charge" class="text-gray-500 hover:text-gray-700" title="Cancelar">&times;</button>
                </div>

                <!-- Contenedor del cuerpo del modal que se actualizará según estado -->
                <div id="topup-charge-body" class="mt-3 space-y-3">
                    <div class="text-sm text-gray-600">Total:</div>
                    <div id="topup-charge-amount" class="text-2xl font-extrabold text-green-600">$0.00</div>

                    <div class="bg-yellow-50 border-l-4 border-yellow-300 p-3 text-sm text-yellow-800 rounded">
                        ¡Cobrar antes de ejecutar!
                    </div>

                    <div class="mt-4">
                        <button data-action="confirm-topup-charge" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Pagar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Siempre anexar al body para evitar que renderizaciones locales eliminen el modal
    document.body.appendChild(modal);
};

window.showTopupChargeModal = async function ({ operator, amount, phone }) {
    window.createTopupChargeModal();

    // función helper para esperar elemento
    const waitForEl = (id, attempts = 6, delay = 40) => new Promise((resolve, reject) => {
        let tries = 0;
        const tick = () => {
            const el = document.getElementById(id);
            if (el) return resolve(el);
            tries++;
            if (tries >= attempts) return reject(new Error('Elemento no encontrado: ' + id));
            setTimeout(tick, delay);
        };
        tick();
    });

    let modal;
    try {
        modal = await waitForEl('topup-charge-modal');
    } catch (e) {
        console.error("No se pudo mostrar modal de cobro:", e);
        window.showToast("Error mostrando modal de confirmación.", 'error');
        return;
    }

    // ahora los sub-elementos deben existir
    const amountEl = document.getElementById('topup-charge-amount');
    const overlay = document.getElementById('topup-charge-overlay');
    const sheet = document.getElementById('topup-charge-sheet');

    if (amountEl) amountEl.textContent = window.formatCurrency(amount || 0);
    modal.dataset.operator = operator || '';
    modal.dataset.amount = String(amount || 0);
    modal.dataset.phone = phone || '';

    // mostrar overlay + sheet (animación)
    if (overlay) { overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100'); }
    if (sheet) { sheet.classList.remove('translate-y-full'); sheet.classList.add('translate-y-0'); }

    modal.classList.remove('pointer-events-none');
    modal.classList.add('pointer-events-auto');
};

window.hideTopupChargeModal = function () {
    const modal = document.getElementById('topup-charge-modal');
    if (!modal) return;
    const overlay = document.getElementById('topup-charge-overlay');
    const sheet = document.getElementById('topup-charge-sheet');
    overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0');
    sheet.classList.remove('translate-y-0'); sheet.classList.add('translate-y-full');

    // esperar la transición antes de quitar interacción
    setTimeout(() => {
        modal.classList.remove('pointer-events-auto');
        modal.classList.add('pointer-events-none');
    }, 300);
};

// ====================================================================
// UTILIDADES UI
// ====================================================================
window.changeView = function (viewName, pushHistory = true) {
    if (!window.__syspago_view_history) window.__syspago_view_history = [];
    const prev = state.currentView;
    if (pushHistory && prev && prev !== viewName) {
        window.__syspago_view_history.push(prev);
        // limitar tamaño de historial para evitar crecimiento ilimitado
        if (window.__syspago_view_history.length > 50) window.__syspago_view_history.shift();
    }
    state.currentView = viewName;
    document.querySelectorAll('[data-view]').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    window.renderApp();
};

// ====================================================================
// HEADER DINÁMICO (logo + nombre del menú actual)
// ====================================================================
function getMenuTitle(viewName) {
    switch (viewName) {
        case 'topup': return 'Recargas';
        case 'topup-plans': return 'Recargas';
        case 'topup-form': return 'Recargas';
        case 'topup-plan-confirm': return 'Recargas';
        case 'payment': return 'Servicios';
        case 'service-providers': return state.selectedService || 'Servicios';
        case 'checkout': return 'Cobrar';
        case 'movements': return 'Movimientos';
        case 'cart': return 'PV Venta';
        default: return 'Syspago';
    }
}
// ------------------------------------------------------------------
// HEADER DINÁMICO (logo + nombre del menú actual) con botón atrás
// ------------------------------------------------------------------
window.renderHeader = function () {
    const header = document.getElementById('app-header');
    if (!header) return;

    const title = getMenuTitle(state.currentView);
    const companyLogo = `<svg class="w-8 h-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>`;

    // Mostrar botón atrás solo en vistas internas (detalles / formularios)
    const internalViews = new Set(['topup-plans', 'topup-plan-confirm', 'topup-form', 'service-providers', 'payment-form', 'checkout', 'movements']);
    const showBack = internalViews.has(state.currentView);

    header.innerHTML = `
        <div class="w-full flex justify-center relative">
            <div class="w-4/5 bg-white rounded-md shadow-sm px-4 py-3 flex items-center justify-center space-x-3 relative">
                ${showBack ? `<button data-action="go-back" aria-label="Atrás" title="Atrás" class="absolute left-3 top-1/2 transform -translate-y-1/2 p-2 rounded-md text-gray-600 hover:bg-gray-100">
                    <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                </button>` : ''}
                <div class="flex-shrink-0">${companyLogo}</div>
                <div class="text-center">
                    <div class="text-xs text-gray-500">[Empresa]</div>
                    <div class="text-2xl font-semibold text-gray-800">${title}</div>
                </div>
            </div>
        </div>
    `;
};

// INCLUIR RENDER DEL HEADER ANTES DE CARGAR LA VISTA
window.renderApp = function () {
    // render header en todas las vistas
    window.renderHeader && window.renderHeader();

    switch (state.currentView) {
        case 'topup': renderTopupView(); break;
        case 'topup-plans': renderTopupPlansView(); break;
        case 'topup-plan-confirm': renderTopupPlanConfirmView(); break;
        case 'topup-form': renderTopupFormView(); break;
        case 'payment': renderPaymentView(); break;          // listado de servicios
        case 'service-providers': renderServiceProvidersView(); break; // listado de proveedores por servicio
        case 'payment-form': renderPaymentFormView(); break;  // formulario de servicio seleccionado
        case 'checkout': renderCheckoutView(); break;
        case 'movements': renderMovementsView(); break;
        case 'cart':
        default: renderCartView(); break;
    }
    calculateTotals();
}

window.formatCurrency = function (amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(amount || 0);
}

window.showToast = function (message, type = 'success') {
    const toastId = 'app-toast';
    let toast = document.getElementById(toastId);
    if (!toast) {
        toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 p-3 rounded-lg shadow-xl text-white font-semibold transition-opacity duration-300 opacity-0 z-50';
        document.body.appendChild(toast);
    }
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    toast.className = toast.className.split(' ').filter(Boolean).join(' ') + ' ' + bgColor;
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 3000);
}

window.showMessageBox = function (title, content, onConfirm = () => { }) {
    const modalId = 'message-box-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] hidden flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                <h2 id="msg-box-title" class="text-2xl font-bold mb-4 text-gray-800"></h2>
                <p id="msg-box-content" class="mb-6 text-gray-700"></p>
                <div class="flex justify-end">
                    <button id="msg-box-ok" class="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('msg-box-title').textContent = title;
    document.getElementById('msg-box-content').textContent = content;
    modal.classList.remove('hidden');
    document.getElementById('msg-box-ok').onclick = () => { modal.classList.add('hidden'); onConfirm(); };
}

// ====================================================================
// EVENTOS GLOBALES (delegación)
// ====================================================================
function setupEventListeners() {
    // evitar registros duplicados
    if (window.__syspago_listeners_installed) return;
    window.__syspago_listeners_installed = true;

    // delegar en document para capturar todos los clicks (incluido modal en body)
    document.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action], [data-view], [data-key]');
        if (!target) return;

        const action = target.getAttribute('data-action');
        const view = target.getAttribute('data-view');
        const key = target.getAttribute('data-key');

        // DEBUG: descomentar si necesitas traza en consola
        // console.debug('Delegated click -> action:', action, 'view:', view, 'key:', key);

        if (view) { window.changeView(view); return; }

        switch (action) {

            case 'process-payment': {
                const method = target.getAttribute('data-method') || 'Efectivo';
                window.processPayment(method);
                break;
            }

            // Enviar reporte por correo (movimientos)
            case 'send-report': {
                // mostrar modal de envío exitoso
                window.showMessageBox('Envío exitoso', 'El reporte fue enviado por correo correctamente.', () => {
                    window.showToast('Reporte enviado por correo.', 'success');
                });
                break;
            }

            case 'process-service-payment': {
                // Mostrar modal de confirmación (bottom-sheet) con total calculado.
                const providerName = state.selectedProvider?.name || state.selectedService || 'Servicio';
                const ref = document.getElementById('service-reference')?.value?.trim() || '';
                const amt = parseFloat(document.getElementById('service-amount')?.value) || 0;
                const extra = 12.00;

                if (!amt || amt <= 0) {
                    window.showToast("Ingresa un monto válido.", 'error');
                    return;
                }

                const total = parseFloat((amt + extra).toFixed(2));
                // Solo mostrar modal; la lógica aleatoria permanece en confirm-topup-charge
                window.showTopupChargeModal({ operator: providerName, amount: total, phone: ref });
                break;
            }


            case 'add-quick-item': {
                window.addQuickItem && window.addQuickItem();
                break;
            }

            case 'go-back': {
                // delegación del botón atrás en el header
                window.goBack && window.goBack();
                break;
            }

            case 'select-service': {
                const serviceName = target.getAttribute('data-service-name');
                if (serviceName) {
                    state.selectedService = serviceName;
                    // abrir listado de proveedores para el servicio seleccionado
                    window.changeView('service-providers');
                }
                break;
            }

            case 'select-provider': {
                const providerName = target.getAttribute('data-provider-name');
                const providerCode = target.getAttribute('data-provider-code');
                if (providerName) {
                    state.selectedProvider = { name: providerName, code: providerCode };
                    // abrir formulario para completar pago de este proveedor
                    window.changeView('payment-form');
                }
                break;
            }
            case 'back-to-services': {
                state.selectedService = null;
                window.changeView('payment');
                break;
            }
            case 'select-operator': {
                const operatorName = target.getAttribute('data-operator-name');
                if (operatorName) {
                    state.topupSelectedOperator = operatorName;
                    window.changeView('topup-plans');
                }
                break;
            }
            case 'select-plan': {
                const operator = target.getAttribute('data-operator') || state.topupSelectedOperator;
                const amount = parseFloat(target.getAttribute('data-plan-amount')) || 0;
                const title = decodeURIComponent(target.getAttribute('data-plan-title') || '');
                const desc = decodeURIComponent(target.getAttribute('data-plan-desc') || '');
                state.topupSelectedOperator = operator;
                state.topupSelectedPlan = { amount, title, desc };
                window.changeView('topup-plan-confirm');
                break;
            }
            case 'confirm-topup-payment': {
                const operator = state.topupSelectedOperator;
                const plan = state.topupSelectedPlan;
                const phone = document.getElementById('confirm-topup-phone')?.value.trim() || '';
                const confirm = document.getElementById('confirm-topup-phone-repeat')?.value.trim() || '';

                if (!/^\d{10}$/.test(phone)) {
                    window.showToast("Número inválido. Debe tener 10 dígitos.", 'error');
                    return;
                }
                if (phone !== confirm) {
                    window.showToast("Los números no coinciden.", 'error');
                    return;
                }

                window.showTopupChargeModal({ operator, amount: plan.amount, phone });
                break;
            }
            case 'cancel-topup-charge': {
                window.hideTopupChargeModal && window.hideTopupChargeModal();
                break;
            }
            case 'confirm-topup-charge': {
                // Mostrar resultado aleatorio dentro del modal (no ejecutar cobro automático)
                const modal = document.getElementById('topup-charge-modal');
                if (!modal) return;
                const amount = parseFloat(modal.dataset.amount || String(state.topupSelectedPlan?.amount || 0)) || 0;
                const body = document.getElementById('topup-charge-body');
                if (!body) return;

                const success = Math.random() < 0.5; // 50% chance

                if (success) {
                    body.innerHTML = `
                        <div class="text-center">
                            <div class="text-2xl font-extrabold text-green-600 mb-2">Cobro exitoso</div>
                            <div class="text-sm text-gray-600 mb-4">La recarga de ${window.formatCurrency(amount)} se realizó correctamente.</div>
                            <div class="mt-2">
                                <button data-action="return-to-topup" class="w-full bg-gray-800 text-white py-3 rounded-lg font-bold">Ir a recargas y servicios</button>
                            </div>
                        </div>
                    `;
                } else {
                    body.innerHTML = `
                        <div class="text-center">
                            <div class="text-2xl font-extrabold text-red-600 mb-2">Saldo insuficiente</div>
                            <div class="text-sm text-gray-600 mb-4">No fue posible procesar la recarga de ${window.formatCurrency(amount)}.</div>
                            <div class="mt-2">
                                <button data-action="return-to-topup" class="w-full bg-gray-800 text-white py-3 rounded-lg font-bold">Ir a recargas y servicios</button>
                            </div>
                        </div>
                    `;
                }
                break;
            }
            case 'return-to-topup': {
                window.hideTopupChargeModal && window.hideTopupChargeModal();
                state.topupSelectedOperator = null;
                state.topupSelectedPlan = null;
                window.changeView('topup');
                break;
            }
            case 'add-topup-to-cart': {
                const op = target.getAttribute('data-operator');
                const amt = parseFloat(target.getAttribute('data-amount'));
                const phone = target.getAttribute('data-phone') || '';
                if (op && !isNaN(amt)) window.addTopupToCart(op, amt, phone);
                break;
            }
            case 'remove-item': {
                const itemEl = target.closest('[data-id]');
                const id = itemEl?.getAttribute('data-id');
                if (id) window.removeItem(Number(id));
                break;
            }
            case 'process-payment': {
                const method = target.getAttribute('data-method') || 'Efectivo';
                window.processPayment(method);
                break;
            }
            case 'add-quick-item': {
                window.addQuickItem && window.addQuickItem();
                break;
            }
            // fallback: teclado numérico
            default:
                if (key) window.processQuickEntry && window.processQuickEntry(key);
                break;
        }
    });

    // listeners adicionales
    const perc = document.getElementById('commission-percentage');
    const fixed = document.getElementById('commission-fixed');
    if (perc) perc.addEventListener('input', window.updateModalCommissionAmount);
    if (fixed) fixed.addEventListener('input', window.updateModalCommissionAmount);
}

// asegurar inicialización (llamarlo al final del archivo si no está siendo llamado)
if (typeof window !== 'undefined') {
    // llamar en next tick para asegurar DOM listo si el archivo se carga en head
    setTimeout(() => { try { setupEventListeners(); } catch (e) { console.error('setupEventListeners error', e); } }, 0);
}

// ====================================================================
// INICIALIZACIÓN
// ====================================================================
window.addEventListener('DOMContentLoaded', () => {
    window.renderApp();
    setupEventListeners();
    window.initializeApp();
});