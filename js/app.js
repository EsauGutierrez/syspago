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
    // Estado para el teclado de cobro directo (Syspago)
    directPayAmount: 0,
    directPayCommission: { type: 'percentage', value: 0 },
    directPayDisplay: '0.0',
    activeInput: 'display', // 'display' o 'commission'
    topupSelectedOperator: null, // operador seleccionado
    topupSelectedPlan: null,     // plan seleccionado (se mostrará en confirmación)
    selectedService: null,       // servicio seleccionado en el menú de Servicios
    activeCartTab: 'quick',

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
    { name: "Movistar", icon: '<img src="icons/recargas/MOVISTAR.svg" class="w-6 h-6" alt="Movistar">' },
    { name: "Telcel", icon: '<img src="icons/recargas/LOGO TELCEL.svg" class="w-6 h-6" alt="Telcel">' },
    { name: "Telmex", icon: '<svg class="w-6 h-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>' },
    { name: "Unefon", icon: '<img src="icons/recargas/UNEFON.svg" class="w-6 h-6" alt="Unefon">' },
    { name: "Virgin Mobile", icon: '<img src="icons/recargas/LOGO VIRGIN.svg" class="w-6 h-6" alt="Virgin Mobile">' }
];

// ----------------------
// NUEVAS CATEGORÍAS DE SERVICIOS
// ----------------------
const serviceCategories = [
    { name: "Agua y drenaje", icon: '<img src="icons/servicios/AGUA.svg" class="w-6 h-6" alt="Agua y drenaje">' },
    { name: "Catálogos", icon: '<img src="icons/servicios/CATALOGOS.svg" class="w-6 h-6" alt="Catálogos">' },
    { name: "Gas y electricidad", icon: '<img src="icons/servicios/gas y electricidad.svg" class="w-6 h-6" alt="Gas y electricidad">' },
    { name: "Gobiernos", icon: '<img src="icons/servicios/gobierno.svg" class="w-6 h-6" alt="Gobiernos">' },
    { name: "Lotería", icon: '<img src="icons/servicios/loteria.svg" class="w-6 h-6" alt="Lotería">' },
    { name: "Movilidad", icon: '<img src="icons/servicios/movilidad.svg" class="w-6 h-6" alt="Movilidad">' },
    { name: "Servicios digitales", icon: '<img src="icons/servicios/aplicaciones.svg" class="w-6 h-6" alt="Servicios digitales">' },
    { name: "TV e internet", icon: '<img src="icons/servicios/tv e internet.svg" class="w-6 h-6" alt="TV e internet">' }
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

// ----------------------
// Productos de ejemplo (Punto de Venta)
// ----------------------
const sampleProducts = [
    { id: 'p1', name: 'COCA COLA 600 ML', price: 19.14, code: '75007614' },
    { id: 'p2', name: 'MARIAS', price: 15.45, code: '7501000658923' },
    { id: 'p3', name: 'PAPAS ORIGINAL 45G-BSA SABRITAS', price: 18.07, code: '7501011101456' },
    { id: 'p4', name: 'NITO BIMBO 62G', price: 15.43, code: '7501000112784' },
    { id: 'p5', name: 'RUFFLES QUESO 50 GR', price: 18.14, code: '7501011104099' },
    { id: 'p6', name: 'COCA COLA 500 ML', price: 16.36, code: '75009809' },
    { id: 'p7', name: 'LECHE LALA ENTERA 1 LT', price: 28.10, code: '7501020526066' },
    { id: 'p8', name: 'NUTRILECHE 1 LT', price: 21.62, code: '7501020540666' }
];


// Función para cambiar pestaña (si ya existe, puedes sustituirla)
window.setCartTab = function (tab) {
    if (!['quick', 'search', 'generic'].includes(tab)) return;
    state.activeCartTab = tab;
    window.renderApp && window.renderApp();
}


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
    window.showToast(`'${name}' added to cart`, 'success', 2500);
}
window.addItemToCart = addItemToCart;

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

window.setCartTab = function (tab) {
    if (!['quick', 'search', 'generic'].includes(tab)) return;
    state.activeCartTab = tab;
    window.renderApp && window.renderApp();
}

// =====================
// FUNCIONES PARA TECLADO NUMÉRICO DE COBRO DIRECTO
// =====================

// Función para agregar número (puede ser al display o al campo de comisión)
window.addDirectPayNumber = function (number) {
    if (state.activeInput === 'commission') {
        // Agregar número al campo de comisión
        const input = document.getElementById('commission-input');
        if (input) {
            if (input.value === '0' || input.value === '') {
                input.value = number;
            } else {
                input.value += number;
            }
            input.focus();
        }
    } else {
        // Agregar número al display principal
        if (state.directPayDisplay === '0.0') {
            state.directPayDisplay = number;
        } else {
            state.directPayDisplay += number;
        }
        state.directPayAmount = parseFloat(state.directPayDisplay) || 0;
        updateDirectPayDisplay();
    }
}

// Función para agregar punto decimal
window.addDirectPayDecimal = function () {
    if (state.activeInput === 'commission') {
        // Agregar punto al campo de comisión
        const input = document.getElementById('commission-input');
        if (input && !input.value.includes('.')) {
            if (input.value === '') {
                input.value = '0.';
            } else {
                input.value += '.';
            }
            input.focus();
        }
    } else {
        // Agregar punto al display principal
        if (!state.directPayDisplay.includes('.')) {
            state.directPayDisplay += '.';
            updateDirectPayDisplay();
        }
    }
}

// Función para limpiar (display o campo de comisión)
window.clearDirectPay = function () {
    if (state.activeInput === 'commission') {
        // Limpiar campo de comisión
        const input = document.getElementById('commission-input');
        if (input) {
            input.value = '';
            input.focus();
        }
    } else {
        // Limpiar display principal
        state.directPayDisplay = '0.0';
        state.directPayAmount = 0;
        updateDirectPayDisplay();
    }
}

// Función para actualizar el display visual
function updateDirectPayDisplay() {
    const displayEl = document.getElementById('direct-pay-display');
    if (displayEl) {
        displayEl.textContent = `$${state.directPayDisplay}`;
    }
}

// Función para establecer tipo de comisión
window.setDirectCommissionType = function (type) {
    state.directPayCommission.type = type;
    window.renderApp && window.renderApp();
}

// Función para aplicar comisión
window.applyDirectCommission = function () {
    const input = document.getElementById('commission-input');
    if (input) {
        const value = parseFloat(input.value) || 0;
        state.directPayCommission.value = value;
        window.showToast('Comisión aplicada correctamente', 'success');
    }
}

// Función para limpiar el campo de comisión
window.clearCommissionInput = function () {
    const input = document.getElementById('commission-input');
    if (input) {
        input.value = '';
        input.focus();
        state.directPayCommission.value = 0;
    }
}

// Función para establecer qué campo está activo
window.setActiveInput = function (inputType) {
    state.activeInput = inputType;
    updateInputFocus();
}

// Función para actualizar el focus visual
function updateInputFocus() {
    const display = document.getElementById('direct-pay-display');
    const commissionInput = document.getElementById('commission-input');
    
    if (display && commissionInput) {
        if (state.activeInput === 'commission') {
            display.style.border = '2px solid transparent';
            commissionInput.style.border = '2px solid #3b82f6';
            commissionInput.focus();
        } else {
            display.style.border = '2px solid #3b82f6';
            commissionInput.style.border = '1px solid #d1d5db';
        }
    }
}

// Función para procesar pago directo
window.processDirectPayment = function () {
    if (state.directPayAmount <= 0) {
        window.showToast("Ingrese un monto válido para cobrar.", 'error');
        return;
    }

    // Calcular comisión
    let commissionAmount = 0;
    if (state.directPayCommission.value > 0) {
        if (state.directPayCommission.type === 'percentage') {
            commissionAmount = (state.directPayAmount * state.directPayCommission.value) / 100;
        } else {
            commissionAmount = state.directPayCommission.value;
        }
    }

    const totalAmount = state.directPayAmount + commissionAmount;

    // Mostrar modal de confirmación/método de pago
    window.showDirectPaymentModal(totalAmount, commissionAmount);
}

// Modal para seleccionar método de pago
window.showDirectPaymentModal = function (total, commission) {
    const modalHtml = `
        <div id="direct-payment-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
                <h2 class="text-2xl font-bold mb-4 text-gray-800">Confirmar Cobro</h2>
                
                <div class="space-y-2 mb-4">
                    <div class="flex justify-between text-lg">
                        <span>Monto:</span>
                        <span class="font-semibold">$${state.directPayAmount.toFixed(2)}</span>
                    </div>
                    ${commission > 0 ? `
                    <div class="flex justify-between text-lg text-red-600">
                        <span>Comisión:</span>
                        <span class="font-semibold">$${commission.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="flex justify-between text-xl font-bold text-green-700 border-t pt-2">
                        <span>TOTAL:</span>
                        <span>$${total.toFixed(2)}</span>
                    </div>
                </div>

                <div class="space-y-3">
                    <button data-action="process-direct-cash" class="w-full bg-green-600 text-white py-3 rounded-lg font-bold">COBRAR EN EFECTIVO</button>
                    <button data-action="process-direct-card" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">COBRAR CON TARJETA</button>
                </div>

                <button data-action="close-direct-modal" class="w-full mt-3 text-gray-600 py-2">Cancelar</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Cerrar modal de pago directo
window.closeDirectPaymentModal = function () {
    const modal = document.getElementById('direct-payment-modal');
    if (modal) modal.remove();
}

// Procesar pago directo en efectivo o tarjeta
window.processDirectCash = function () {
    finishDirectPayment('Efectivo');
}

window.processDirectCard = function () {
    // Mostrar interfaz de lector de tarjeta
    window.closeDirectPaymentModal();
    if (window.openCardReaderView) {
        const total = state.directPayAmount + (state.directPayCommission.type === 'percentage' 
            ? (state.directPayAmount * state.directPayCommission.value) / 100 
            : state.directPayCommission.value);
        window.openCardReaderView({ total });
    }
}

function finishDirectPayment(method) {
    const commissionAmount = state.directPayCommission.type === 'percentage' 
        ? (state.directPayAmount * state.directPayCommission.value) / 100 
        : state.directPayCommission.value;
    
    const totalAmount = state.directPayAmount + commissionAmount;

    saveTransaction({
        date: new Date(),
        total: totalAmount,
        subtotal: state.directPayAmount,
        commission: { ...state.directPayCommission, amount: commissionAmount },
        items: [{ name: 'Cobro Directo', price: state.directPayAmount, quantity: 1 }],
        paymentMethod: method,
        status: 'Completed'
    });

    window.closeDirectPaymentModal();
    window.showToast(`Cobro de $${totalAmount.toFixed(2)} procesado exitosamente`, 'success');
    
    // Limpiar estado
    state.directPayDisplay = '0.0';
    state.directPayAmount = 0;
    state.directPayCommission = { type: 'percentage', value: 0 };
    
    window.renderApp && window.renderApp();
}

// ----------------- NUEVA FUNCIÓN: Toast de notificación -----------------
// Pegar esta función en js/app.js en la sección de utilidades globales (fuera de otras funciones)
window.showToast = function (message, type = 'success', timeout = 3000) {
    try {
        // eliminar toast existente si hay
        const existing = document.getElementById('syspago-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'syspago-toast';
        // contenedor posicionado top-center
        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.top = '12px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.zIndex = 9999;
        toast.style.transition = 'opacity 260ms ease';
        toast.style.opacity = '0';

        // contenido (usando clases tailwind para apariencia si están cargadas)
        const bgClass = type === 'success' ? 'bg-green-600' : 'bg-red-600';
        const title = type === 'success' ? 'Éxito' : 'Error';

        // Creamos el contenido HTML (aseguramos texto escapado)
        const safeMessage = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');

        toast.innerHTML = `
            <div class="${bgClass} text-white rounded-lg shadow-md px-4 py-3 flex items-center space-x-3" style="min-width:260px;">
                <div style="flex-shrink:0;">
                    ${type === 'success'
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 6L9 17l-5-5"/></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'
            }
                </div>
                <div>
                    <div style="font-weight:600;">${title}</div>
                    <div style="font-size:0.9rem; margin-top:2px;">${safeMessage}</div>
                </div>
            </div>
        `;

        document.body.appendChild(toast);

        // Animación de entrada
        requestAnimationFrame(() => { toast.style.opacity = '1'; });

        // Auto-cierre
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                try { toast.remove(); } catch (e) { }
            }, 260);
        }, timeout);
    } catch (e) {
        // si algo falla, no rompemos la app
        console.error('showToast error', e);
    }
}

// --- Render de una fila de producto (global) ---
window.productRowHtml = window.productRowHtml || function (product) {
    const priceStr = window.formatCurrency ? window.formatCurrency(product.price || 0) : ('$ ' + (product.price || 0));
    const code = product.code || product.barcode || product.sku || '';
    const safeName = String(product.name || '').replace(/'/g, "\\'");
    const safePrice = Number(product.price || 0);
    return `
        <div class="flex items-center justify-between bg-white border-b last:border-b-0 px-4 py-4">
            <div class="flex-1 pr-3">
                <div class="text-base font-semibold text-gray-800">${(product.name || '').toUpperCase()}</div>
                <div class="text-sm text-gray-600 mt-1">
                    <span class="font-medium">${priceStr}</span> &nbsp;|&nbsp; <span class="text-xs text-gray-500">Código: ${code}</span>
                </div>
            </div>
            <div class="flex-shrink-0">
                <button onclick="window.addItemToCart && window.addItemToCart('${safeName}', ${safePrice}, 1)" class="w-12 h-12 flex items-center justify-center rounded border border-blue-300 bg-white hover:bg-blue-50">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 6m5-6v6m4-6v6m-9 0h10" />
                    </svg>
                </button>
            </div>
        </div>
    `;
};

// Búsqueda en tiempo real. Llama a window.searchProducts(q) con el texto.
// Si q es vacío, muestra todos los productos del origen (state.products o state.sampleProducts).
// Reemplaza/pega esta implementación de búsqueda (asegúrate de que esté antes de renderCartView)
window.searchProducts = function (q) {
    try {
        // Mostrar en consola para depuración
        console.log('[searchProducts] q=', q);

        const termRaw = String(q || '');
        const term = termRaw.toLowerCase().trim();

        // Helper: normalizar texto (quita acentos y lower case)
        const normalize = (s) => {
            if (!s && s !== 0) return '';
            try {
                // usa Unicode normalization y quita marcas diacríticas
                return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            } catch (e) {
                return String(s).toLowerCase();
            }
        };

        // Determinar fuente de productos (con prioridad): state.products > state.sampleProducts > state.catalog/state.items > fallback local
        const fallback = [
            { name: "COCA COLA COLA 600 ML", price: 19.14, code: "75007614" },
            { name: "MARIAS", price: 15.45, code: "7501000658923" },
            { name: "PAPAS ORIGINAL 45G BSA SABRITAS", price: 18.07, code: "7501011101456" },
            { name: "NITO BIMBO 62G", price: 15.43, code: "7501000112784" },
            { name: "RUFFLES QUESO 50 GR", price: 18.14, code: "7501011104099" },
            { name: "COCA COLA COLA 500 ML", price: 16.36, code: "75009809" },
            { name: "LECHE LALA ENTERA 1 LT", price: 28.10, code: "7501020526066" }
        ];

        const productsSource = (typeof state !== 'undefined' && state && Array.isArray(state.products) && state.products.length)
            ? state.products
            : (typeof state !== 'undefined' && state && Array.isArray(state.sampleProducts) && state.sampleProducts.length)
                ? state.sampleProducts
                : (typeof state !== 'undefined' && state && Array.isArray(state.catalog) && state.catalog.length)
                    ? state.catalog
                    : (typeof state !== 'undefined' && state && Array.isArray(state.items) && state.items.length)
                        ? state.items
                        : fallback;

        // Debug logs para saber qué estamos usando y su tamaño
        console.log('[searchProducts] productsSource.length =', productsSource.length);
        console.log('[searchProducts] primeros items =', (productsSource || []).slice(0, 6).map(p => p.name || p.code || p.id));

        const container = document.getElementById('product-search-results');
        if (!container) {
            console.warn('[searchProducts] no existe #product-search-results en el DOM');
            return;
        }

        // Si el término está vacío, mostramos la lista completa
        if (term === '') {
            const htmlAll = (productsSource && productsSource.length)
                ? `<div class="divide-y bg-gray-50 border rounded-b-lg overflow-hidden">` + productsSource.map(p => window.productRowHtml ? window.productRowHtml(p) : '').join('') + `</div>`
                : `<div class="p-4 text-sm text-gray-500">No hay productos para mostrar.</div>`;
            container.innerHTML = htmlAll;
            return;
        }

        // Normalizar term para comparar
        const normTerm = normalize(term);

        // Filtrar: buscar en nombre y código normalizados
        const filtered = (productsSource || []).filter(p => {
            const name = normalize(p.name || '');
            const code = normalize(p.code || p.barcode || p.sku || '');
            return name.indexOf(normTerm) !== -1 || code.indexOf(normTerm) !== -1;
        });

        console.log('[searchProducts] filtered.length =', filtered.length, 'term=', normTerm);

        if (!filtered || filtered.length === 0) {
            container.innerHTML = `<div class="p-4 text-sm text-gray-500">No hay resultados.</div>`;
            return;
        }

        const html = `<div class="divide-y bg-gray-50 border rounded-b-lg overflow-hidden">` + filtered.map(p => window.productRowHtml ? window.productRowHtml(p) : '').join('') + `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error('searchProducts error', err);
    }
};


window.searchProducts = window.searchProducts || function (q) {
    try {
        const term = String(q || '').toLowerCase().trim();

        // Determinar fuente: state.products > state.sampleProducts > state.catalog/state.items > fallback sample
        const fallback = [
            { name: "COCA COLA COLA 600 ML", price: 19.14, code: "75007614" },
            { name: "MARIAS", price: 15.45, code: "7501000658923" },
            { name: "PAPAS ORIGINAL 45G BSA SABRITAS", price: 18.07, code: "7501011101456" },
            { name: "NITO BIMBO 62G", price: 15.43, code: "7501000112784" },
            { name: "RUFFLES QUESO 50 GR", price: 18.14, code: "7501011104099" },
            { name: "COCA COLA COLA 500 ML", price: 16.36, code: "75009809" },
            { name: "LECHE LALA ENTERA 1 LT", price: 28.10, code: "7501020526066" }
        ];

        const productsSource = (state && state.products && state.products.length) ? state.products
            : (state && state.sampleProducts && state.sampleProducts.length) ? state.sampleProducts
                : (state && (state.catalog || state.items) && (state.catalog || state.items).length) ? (state.catalog || state.items)
                    : fallback;

        // Si no hay contenedor, salimos con warning
        const container = document.getElementById('product-search-results');
        if (!container) {
            console.warn('searchProducts: no existe #product-search-results en el DOM');
            return;
        }

        // Filtrar
        const list = term === '' ? productsSource : productsSource.filter(p => {
            const name = (p.name || '').toString().toLowerCase();
            const code = (p.code || p.barcode || p.sku || '').toString().toLowerCase();
            return name.includes(term) || code.includes(term);
        });

        // Render
        if (!list || list.length === 0) {
            container.innerHTML = `<div class="p-4 text-sm text-gray-500">No hay resultados.</div>`;
            return;
        }

        const html = `<div class="divide-y bg-gray-50 border rounded-b-lg overflow-hidden">` + list.map(p => window.productRowHtml(p)).join('') + `</div>`;
        container.innerHTML = html;

    } catch (e) {
        console.error('searchProducts error', e);
    }
};



// ------------------------------------------------------------------------

function saveTransaction(transactionData) {
    if (!db) return;
    const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    addDoc(collectionRef, transactionData)
        .then(() => console.log("Transacción guardada exitosamente."))
        .catch(error => console.error("Error guardando transacción:", error));
}

// ------------------------------------------------------------------
// RENDER: carrito / PV (modificado para mostrar botón AGREGAR PRODUCTO cuando está vacío)
// ------------------------------------------------------------------
function renderCartView() {
    try {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            console.warn('No existe #main-content en el DOM');
            return;
        }

        const tabsHtml = `
            <div class="bg-white rounded-t-lg shadow-sm border-b">
                <div class="flex justify-between items-center px-3 py-2">
                    <div class="flex space-x-2">
                        <button onclick="setCartTab('quick')" class="px-4 py-2 text-sm font-medium ${state.activeCartTab === 'quick' ? 'text-gray-900' : 'text-gray-600'}">Venta Rápida</button>
                        <button onclick="setCartTab('search')" class="px-4 py-2 text-sm font-medium ${state.activeCartTab === 'search' ? 'text-gray-900' : 'text-gray-600'}">Buscar Productos</button>
                        <button onclick="setCartTab('generic')" class="px-4 py-2 text-sm font-medium ${state.activeCartTab === 'generic' ? 'text-gray-900' : 'text-gray-600'}">Producto genérico</button>
                    </div>                   
                </div>
            </div>
        `;

        // sampleProducts por defecto si no existe state.sampleProducts
        const sampleProducts = (state.sampleProducts && state.sampleProducts.length) ? state.sampleProducts : [
            { name: "COCA COLA COLA 600 ML", price: 19.14, code: "75007614" },
            { name: "MARIAS", price: 15.45, code: "7501000658923" },
            { name: "PAPAS ORIGINAL 45G BSA SABRITAS", price: 18.07, code: "7501011101456" },
            { name: "NITO BIMBO 62G", price: 15.43, code: "7501000112784" },
            { name: "RUFFLES QUESO 50 GR", price: 18.14, code: "7501011104099" },
            { name: "COCA COLA COLA 500 ML", price: 16.36, code: "75009809" },
            { name: "LECHE LALA ENTERA 1 LT", price: 28.10, code: "7501020526066" }
        ];

        // determinar fuente de productos: primero state.products si existe, sino sampleProducts/fallback
        const productsSource = (state.products && state.products.length) ? state.products
            : (state.sampleProducts && state.sampleProducts.length) ? state.sampleProducts
                : sampleProducts;

        // función auxiliar: obtener HTML inicial de resultados (toda la lista)
        const initialResultsHtml = (productsSource && productsSource.length)
            ? `<div class="divide-y bg-gray-50 border rounded-b-lg overflow-hidden">` + productsSource.map(p => window.productRowHtml ? window.productRowHtml(p) : (function () {
                const priceStr = window.formatCurrency ? window.formatCurrency(p.price || 0) : ('$ ' + (p.price || 0));
                const code = p.code || p.barcode || p.sku || '';
                const safeName = String(p.name || '').replace(/'/g, "\\'");
                const safePrice = Number(p.price || 0);
                return `
                    <div class="flex items-center justify-between bg-white border-b last:border-b-0 px-4 py-4">
                        <div class="flex-1 pr-3">
                            <div class="text-base font-semibold text-gray-800">${(p.name || '').toUpperCase()}</div>
                            <div class="text-sm text-gray-600 mt-1">
                                <span class="font-medium">${priceStr}</span> &nbsp;|&nbsp; <span class="text-xs text-gray-500">Código: ${code}</span>
                            </div>
                        </div>
                        <div class="flex-shrink-0">
                            <button onclick="window.addItemToCart('${safeName}', ${safePrice}, 1)" class="w-12 h-12 flex items-center justify-center rounded border border-blue-300 bg-white hover:bg-blue-50">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 6m5-6v6m4-6v6m-9 0h10" />
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            })()).join('') + `</div>`
            : `<div class="p-6 text-center text-sm text-gray-500">No hay productos para mostrar.</div>`;

        // Contenido para la pestaña Buscar: input con oninput para búsqueda en tiempo real
        // Inserto los resultados iniciales dentro del contenedor para que se vean desde el primer render
        const searchTabHtml = `
            <div class="p-3 bg-white border rounded-b-lg">
                <div class="flex items-center space-x-2 mb-3">
                    <div class="relative flex-1">
                        <input id="product-search-input" oninput="window.searchProducts(this.value)" type="text" placeholder="Introduzca texto aquí" class="w-full p-3 border rounded pl-10" />
                        <svg class="w-5 h-5 absolute left-3 top-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
                        </svg>
                        <button onclick="(function(){ document.getElementById('product-search-input').value=''; window.searchProducts && window.searchProducts(''); })()" class="absolute right-2 top-2 text-gray-500">✕</button>
                    </div>
                    <button onclick="(function(){ const q=document.getElementById('product-search-input').value; window.searchProducts && window.searchProducts(q); })()" class="px-3 py-2 bg-blue-600 text-white rounded">Buscar</button>
                </div>
                <div id="product-search-results" class="">
                    ${initialResultsHtml}
                </div>
            </div>
        `;

        // Pestaña Venta rápida: aquí puedes usar sampleProducts o state.sampleProducts
        let quickTabHtml = '';
        if (state.activeCartTab === 'quick') {
            const listHtml = (sampleProducts && sampleProducts.length)
                ? `<div class="divide-y bg-gray-50 border rounded-b-lg overflow-hidden">` + sampleProducts.map(p => window.productRowHtml ? window.productRowHtml(p) : '').join('') + `</div>`
                : `<div class="p-6 text-center text-sm text-gray-500">No hay artículos rápidos configurados.</div>`;

            quickTabHtml = `
                <div class="p-4">
                    <div class="mb-2">
                        <h3 class="text-base font-semibold text-gray-800">PV Venta | Carrito (${(state.cart || []).length} artículos)</h3>
                    </div>
                    ${listHtml}
                </div>
            `;
        }

        // Producto genérico
        const genericTabHtml = `
            <div class="p-4 bg-gray-50 rounded-b-lg">
                <div class="space-y-3">
                    <input id="generic-name" type="text" placeholder="Nombre del producto" class="w-full p-3 border rounded" />
                    <input id="generic-price" type="text" inputmode="decimal" placeholder="Precio" class="w-full p-3 border rounded" />
                    <div class="flex justify-end space-x-2">
                        <button onclick="(function(){ document.getElementById('generic-name').value=''; document.getElementById('generic-price').value=''; })()" class="px-4 py-2 bg-gray-200 rounded">Limpiar</button>
                        <button onclick="(function(){ const n=document.getElementById('generic-name').value; const p=parseFloat(document.getElementById('generic-price').value)||0; if(n && p>0){ window.addItemToCart(n,p,1); document.getElementById('generic-name').value=''; document.getElementById('generic-price').value=''; } })()" class="px-4 py-2 bg-blue-600 text-white rounded">Agregar</button>
                    </div>
                </div>
            </div>
        `;

        // Seleccionar contenido por pestaña
        let tabContent = '';
        if (state.activeCartTab === 'quick') tabContent = quickTabHtml;
        else if (state.activeCartTab === 'search') tabContent = searchTabHtml;
        else if (state.activeCartTab === 'generic') tabContent = genericTabHtml;

        // Composición final de la vista
        const cartHtml = `
            <div class="h-full flex flex-col">
                ${tabsHtml}
                <div class="flex-1 overflow-y-auto px-0 py-3">
                    <div class="max-w-full mx-auto px-2">

                        ${tabContent}

                    </div>
                </div>
            </div>
        `;

        mainContent.innerHTML = cartHtml;

        // Agregar validación al campo de precio del producto genérico
        setTimeout(() => {
            const priceInput = document.getElementById('generic-price');
            if (priceInput) {
                priceInput.addEventListener('input', (e) => {
                    let value = e.target.value;
                    // Remover caracteres no válidos (solo números y punto)
                    value = value.replace(/[^0-9.]/g, '');
                    // Permitir solo un punto decimal
                    const parts = value.split('.');
                    if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    // Limitar a 2 decimales
                    if (parts.length === 2 && parts[1].length > 2) {
                        value = parts[0] + '.' + parts[1].substring(0, 2);
                    }
                    e.target.value = value;
                });
            }
        }, 100);

        // Nota: window.searchProducts debe existir y actualizar #product-search-results.
        // Si no existe, puedes pegar la implementación que te di antes; si existe, al escribir en el input
        // llamará a window.searchProducts(this.value) y actualizará el contenedor.
        // No es necesario llamar window.searchProducts('') aquí porque ya inyectamos initialResultsHtml.

    } catch (e) {
        console.error('Error en renderCartView:', e);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="p-4 text-red-600">Ocurrió un error al renderizar la vista. Revisa la consola para más detalles.</div>';
        }
    }
}


// ------------------------------------------------------------------
// RENDER: Lista de productos (pestañas + listado) - vista que aparece al pulsar AGREGAR PRODUCTO
// ------------------------------------------------------------------
function renderProductsView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const productsHtml = sampleProducts.map(p => `
        <div class="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
            <div>
                <div class="font-medium text-gray-800">${p.name}</div>
                <div class="text-sm text-gray-500">$ ${p.price.toFixed(2)} | Código: ${p.code}</div>
            </div>
            <div class="flex items-center space-x-2">
                <button data-action="add-product" data-product-id="${p.id}" class="p-2 rounded-md border text-blue-600 hover:bg-blue-50" title="Agregar al carrito">
                    <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4"/><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7 13v7a2 2 0 002 2h6a2 2 0 002-2v-7"/></svg>
                </button>
            </div>
        </div>
    `).join('');

    const html = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-bold">Venta Rápida</h2>
                <button data-action="back-to-cart" class="text-sm text-gray-500">Cerrar</button>
            </div>

            <div class="flex gap-3">
                <button class="px-3 py-2 rounded-lg bg-blue-600 text-white">Editar productos</button>
                <button class="px-3 py-2 rounded-lg bg-blue-600 text-white">Reordenar productos</button>
            </div>

            <div class="mt-2 bg-white p-3 rounded-lg border">
                <div class="flex items-center space-x-3 mb-3">
                    <div class="p-2 bg-gray-100 rounded-full">🔍</div>
                    <input id="product-search" type="text" placeholder="Buscar Productos" class="w-full p-2 border rounded" />
                </div>

                <div id="product-list" class="space-y-2">
                    ${productsHtml}
                </div>
            </div>
        </div>
    `;
    mainContent.innerHTML = html;

    // Filtro simple
    const search = document.getElementById('product-search');
    const listEl = document.getElementById('product-list');
    if (!search || !listEl) return;
    search.addEventListener('input', (ev) => {
        const q = (ev.target.value || '').trim().toLowerCase();
        const filtered = sampleProducts.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
        listEl.innerHTML = filtered.map(p => `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                <div>
                    <div class="font-medium text-gray-800">${p.name}</div>
                    <div class="text-sm text-gray-500">$ ${p.price.toFixed(2)} | Código: ${p.code}</div>
                </div>
                <div class="flex items-center space-x-2">
                    <button data-action="add-product" data-product-id="${p.id}" class="p-2 rounded-md border text-blue-600 hover:bg-blue-50" title="Agregar al carrito">
                        <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4"/><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7 13v7a2 2 0 002 2h6a2 2 0 002-2v-7"/></svg>
                    </button>
                </div>
            </div>
        `).join('') || `<p class="text-gray-500 text-center py-6">No hay coincidencias.</p>`;
    });
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
                    <input id="service-amount" type="text" inputmode="decimal" placeholder="$ Monto a pagar" class="w-full p-3 border rounded-lg text-lg" />
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
        // Validar que solo contenga números y decimales
        if (amtEl && amtEl.value) {
            const cleanValue = amtEl.value.replace(/[^0-9.]/g, '');
            // Asegurar solo un punto decimal
            const parts = cleanValue.split('.');
            if (parts.length > 2) {
                amtEl.value = parts[0] + '.' + parts.slice(1).join('');
            } else {
                amtEl.value = cleanValue;
            }
        }
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

    const checkoutHtml = `
        <!-- Display del monto -->
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg mb-4 shadow-lg cursor-pointer transition-all duration-200" data-action="focus-display">
            <div class="text-right">
                <div class="text-4xl font-bold text-white" id="direct-pay-display">$${state.directPayDisplay}</div>
                <div class="text-sm text-blue-100 mt-1">Toca para ingresar monto principal</div>
            </div>
        </div>

        <!-- Teclado numérico -->
        <div class="bg-white rounded-xl p-4 shadow-lg mb-4">
            <div class="grid grid-cols-3 gap-3 mb-4">
                <!-- Fila 1 -->
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="1">1</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="2">2</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="3">3</button>
                
                <!-- Fila 2 -->
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="4">4</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="5">5</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="6">6</button>
                
                <!-- Fila 3 -->
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="7">7</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="8">8</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="9">9</button>
                
                <!-- Fila 4 -->
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-decimal">.</button>
                <button class="keypad-btn bg-gray-100 hover:bg-gray-200 text-2xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-number" data-number="0">0</button>
                <button class="keypad-btn bg-red-100 hover:bg-red-200 text-red-600 text-xl font-semibold p-4 rounded-lg shadow-sm transition" data-action="keypad-clear">
                    <svg class="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Botón de cobrar -->
        <button class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 rounded-lg shadow-lg transition mb-4" data-action="process-direct-payment">
            COBRAR $
        </button>

        <!-- Sección de comisión -->
        <div class="bg-white rounded-xl p-4 shadow-lg">
            <h3 class="text-lg font-semibold mb-3 text-gray-800">Comisión</h3>
            <div class="flex space-x-2 mb-3">
                <button class="flex-1 py-2 px-4 rounded-lg font-medium transition ${state.directPayCommission.type === 'percentage' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}" data-action="set-commission-type" data-type="percentage">%</button>
                <button class="flex-1 py-2 px-4 rounded-lg font-medium transition ${state.directPayCommission.type === 'fixed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}" data-action="set-commission-type" data-type="fixed">$</button>
            </div>
            <div class="flex items-center space-x-2">
                <div class="flex-1 relative">
                    <input type="text" id="commission-input" class="w-full p-2 border border-gray-300 rounded-lg pr-10 transition-all duration-200" placeholder="0" value="${state.directPayCommission.value}" inputmode="decimal" data-action="focus-commission">
                    <button class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-600 transition" data-action="clear-commission" title="Limpiar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <button class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition" data-action="apply-direct-commission">GUARDAR</button>
            </div>
            <div class="text-xs text-gray-500 mt-2">Toca el campo para ingresar comisión con el teclado</div>
        </div>
    `;
    mainContent.innerHTML = checkoutHtml;

    // Inicializar estado y event listeners específicos para esta vista
    setTimeout(() => {
        // Establecer foco inicial en el display
        state.activeInput = 'display';
        updateInputFocus();

        const commissionInput = document.getElementById('commission-input');
        if (commissionInput) {
            // Permitir solo números y punto decimal
            commissionInput.addEventListener('input', (e) => {
                let value = e.target.value;
                value = value.replace(/[^0-9.]/g, '');
                const parts = value.split('.');
                if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                }
                e.target.value = value;
            });

            // Seleccionar todo al hacer focus y cambiar input activo
            commissionInput.addEventListener('focus', (e) => {
                state.activeInput = 'commission';
                updateInputFocus();
                setTimeout(() => e.target.select(), 10);
            });

            // Detectar clic en el campo para cambiar foco
            commissionInput.addEventListener('click', () => {
                state.activeInput = 'commission';
                updateInputFocus();
            });

            // Mejorar navegación con teclado
            commissionInput.addEventListener('keydown', (e) => {
                const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'Home', 'End', 'ArrowLeft', 'ArrowRight'];
                if (allowedKeys.includes(e.key) ||
                    (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key)) ||
                    (!e.shiftKey && e.key >= '0' && e.key <= '9') ||
                    e.key === '.') {
                    return;
                }
                e.preventDefault();
            });
        }

        // Event listener para el display principal
        const display = document.getElementById('direct-pay-display');
        if (display) {
            display.parentElement.addEventListener('click', () => {
                state.activeInput = 'display';
                updateInputFocus();
            });
        }
    }, 100);
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
// HEADER DINÁMICO (logo + nombre del menú actual) con botón atrás y ajustes
// ------------------------------------------------------------------
window.renderHeader = function () {
    const header = document.getElementById('app-header');
    if (!header) return;

    const title = getMenuTitle(state.currentView);
    const companyLogo = `<img src="icons/servicios/LOGO SYSTIENDA solo carrito.svg" class="w-8 h-8" alt="SYSTIENDA">`;

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
                    <div class="text-2xl font-semibold text-gray-800">${title}</div>
                </div>

                <!-- Botón Ajustes (tuerca) siempre visible a la derecha -->
                <button data-action="open-settings" aria-label="Ajustes" title="Ajustes" class="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-md text-gray-600 hover:bg-gray-100">
                    <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                        <path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09c.67 0 1.22-.42 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 0 1 7.8 3.8l.06.06c.5.5 1.2.68 1.82.33.48-.28 1.09-.44 1.69-.44H12a1.65 1.65 0 0 0 1.65-1.51V3a2 2 0 0 1 4 0v.09c0 .6.16 1.21.44 1.69.35.62.17 1.32-.33 1.82l-.06.06c-.6.6-.78 1.51-.33 1.82.29.29.84.5 1.51.5H21a2 2 0 0 1 0 4h-.09c-.67 0-1.22.21-1.51.5z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
};

// Añadir la vista de Ajustes
function renderSettingsView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const merchant = state.merchantName || 'DEMO MERCHANT';

    const html = `
        <div class="space-y-4">
            <h2 class="text-xl font-bold mb-2">Ajustes</h2>

            <div class="bg-white p-4 rounded-lg shadow-sm border">
                <div class="flex items-center space-x-3 mb-3">
                    <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                        <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A9 9 0 1118.88 6.196 9 9 0 015.12 17.804z"/><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <div class="flex-grow">
                        <div class="text-sm text-gray-500">Mi cuenta</div>
                        <input id="merchant-name-input" class="w-full border p-2 rounded mt-1" value="${merchant}" />
                    </div>
                </div>

                <div class="border-t mt-4 pt-4 space-y-3">
                    <button data-action="open-consultar" class="w-full text-left p-3 rounded-lg border bg-white">Consultar</button>
                    <button data-action="open-depositos" class="w-full text-left p-3 rounded-lg border bg-white">Depositos</button>
                </div>
            </div>

            <div class="bg-white p-4 rounded-lg shadow-sm border">
                <div class="text-lg font-semibold mb-3">¿Necesitas Ayuda?</div>
                <div class="grid grid-cols-2 gap-3">
                    <button data-action="contact-write" class="p-3 border rounded-lg text-center text-sm">ESCRÍBENOS<br><span class="block text-xs text-gray-500">55 4784 3689</span></button>
                    <button data-action="contact-call" class="p-3 border rounded-lg text-center text-sm">LLÁMANOS<br><span class="block text-xs text-gray-500">55 4747 6290</span></button>
                </div>

                <div class="mt-4">
                    <button data-action="sign-out" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">CERRAR SESIÓN</button>
                </div>

                <div class="text-center text-sm text-gray-500 mt-6">Version<br>3.17.15</div>
            </div>
        </div>
    `;
    mainContent.innerHTML = html;
}

// Asegúrate de que renderApp incluya la vista product-list
window.renderApp = function () {
    console.log('🚀 renderApp ejecutándose. Vista actual:', state.currentView);
    
    // render header en todas las vistas excepto en el menú inicial
    if (state.currentView !== 'syspago-menu') {
        window.renderHeader && window.renderHeader();
    }

    // Mostrar/ocultar bottom bar según la vista
    const bottomBar = document.getElementById('bottom-bar');
    if (bottomBar) {
        if (state.currentView === 'syspago-menu') {
            bottomBar.style.display = 'none';
        } else {
            bottomBar.style.display = 'block';
        }
    }
 
    switch (state.currentView) {
        case 'topup': renderTopupView(); break;
        case 'topup-plans': renderTopupPlansView(); break;
        case 'topup-plan-confirm': renderTopupPlanConfirmView(); break;
        case 'topup-form': renderTopupFormView(); break;
        case 'payment': renderPaymentView(); break;
        case 'service-providers': renderServiceProvidersView(); break;
        case 'payment-form': renderPaymentFormView(); break;
        case 'settings': renderSettingsView(); break;
        case 'checkout': renderCheckoutView(); break;
        case 'movements': renderMovementsView(); break;
        case 'product-list': renderProductsView(); break;
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

        // Prevenir propagación para evitar procesamiento duplicado
        event.stopPropagation();

        const action = target.getAttribute('data-action');
        const view = target.getAttribute('data-view');
        const key = target.getAttribute('data-key');

        // DEBUG: descomentar si necesitas traza en consola
        // console.debug('Delegated click -> action:', action, 'view:', view, 'key:', key);

        if (view) { window.changeView(view); return; }

        switch (action) {


            // abrir lista de productos (desde Carrito vacío)
            case 'open-product-list': {
                window.changeView('product-list');
                break;
            }

            // cerrar listado y volver al carrito
            case 'back-to-cart': {
                window.changeView('cart');
                break;
            }

            // añadir producto al carrito desde la lista
            case 'add-product': {
                const productId = target.getAttribute('data-product-id');
                const product = sampleProducts.find(p => p.id === productId);
                if (product) {
                    addItemToCart(product.name, product.price, 1);
                    // permanecer en la lista para seguir agregando; notificar
                    window.showToast(`${product.name} agregado al carrito.`);
                }
                break;
            }

            case 'open-settings': {
                // abrir pantalla de ajustes
                window.changeView('settings');
                break;
            }

            case 'sign-out': {
                // Confirmar cierre de sesión
                window.showMessageBox('Cerrar sesión', '¿Deseas cerrar sesión?', () => {
                    // Limpiar estado sensible
                    state.cart = [];
                    state.selectedService = null;
                    state.selectedProvider = null;
                    calculateTotals();
                    window.showToast('Sesión cerrada.');
                    // Redirigir a la pantalla de bienvenida
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                });
                break;
            }

            case 'contact-write': {
                window.showMessageBox('Contacto', 'Abrirías WhatsApp con: 55 4784 3689 (simulado).');
                break;
            }
            case 'contact-call': {
                window.showMessageBox('Contacto', 'Llamada a: 55 4747 6290 (simulado).');
                break;
            }

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

            // === CASOS PARA TECLADO NUMÉRICO DE COBRO DIRECTO ===
            case 'keypad-number': {
                const number = target.getAttribute('data-number');
                if (number) window.addDirectPayNumber(number);
                break;
            }
            case 'keypad-decimal': {
                window.addDirectPayDecimal();
                break;
            }
            case 'keypad-clear': {
                window.clearDirectPay();
                break;
            }
            case 'process-direct-payment': {
                window.processDirectPayment();
                break;
            }
            case 'set-commission-type': {
                const type = target.getAttribute('data-type');
                if (type) window.setDirectCommissionType(type);
                break;
            }
            case 'apply-direct-commission': {
                window.applyDirectCommission();
                break;
            }
            case 'clear-commission': {
                window.clearCommissionInput();
                break;
            }
            case 'close-direct-modal': {
                window.closeDirectPaymentModal();
                break;
            }
            case 'process-direct-cash': {
                window.processDirectCash();
                break;
            }
            case 'process-direct-card': {
                window.processDirectCard();
                break;
            }
            case 'focus-display': {
                window.setActiveInput('display');
                break;
            }
            case 'focus-commission': {
                window.setActiveInput('commission');
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

    // Listener para el campo de comisión de cobro directo
    const commissionInput = document.getElementById('commission-input');
    if (commissionInput) {
        // Permitir solo números y punto decimal
        commissionInput.addEventListener('input', (e) => {
            let value = e.target.value;
            // Remover caracteres no válidos (solo números y punto)
            value = value.replace(/[^0-9.]/g, '');
            // Permitir solo un punto decimal
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            e.target.value = value;
        });

        // Seleccionar todo el texto al hacer focus
        commissionInput.addEventListener('focus', (e) => {
            setTimeout(() => e.target.select(), 10);
        });

        // Permitir delete/backspace para funcionalidad normal
        commissionInput.addEventListener('keydown', (e) => {
            // Permitir teclas de navegación y edición
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'Home', 'End', 'ArrowLeft', 'ArrowRight', 'Clear', 'Copy', 'Paste'];
            if (allowedKeys.indexOf(e.key) !== -1 ||
                // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.key === 'a' && e.ctrlKey === true) ||
                (e.key === 'c' && e.ctrlKey === true) ||
                (e.key === 'v' && e.ctrlKey === true) ||
                (e.key === 'x' && e.ctrlKey === true)) {
                return;
            }
            // Permitir números y punto decimal
            if ((e.shiftKey || (e.key < '0' || e.key > '9')) && e.key !== '.') {
                e.preventDefault();
            }
        });
    }
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

// ---------- PANEL / VISTA DETALLADA DEL CARRITO (pegar al final de js/app.js) ----------
// Asegúrate de que estas funciones principales estén expuestas en window (si tu archivo se carga como module)
if (typeof window.addItemToCart === 'undefined' && typeof addItemToCart === 'function') window.addItemToCart = addItemToCart;
if (typeof window.updateItemQuantity === 'undefined' && typeof updateItemQuantity === 'function') window.updateItemQuantity = updateItemQuantity;
if (typeof window.removeItem === 'undefined' && typeof removeItem === 'function') window.removeItem = removeItem;
if (typeof window.calculateTotals === 'undefined' && typeof calculateTotals === 'function') window.calculateTotals = calculateTotals;
if (typeof window.renderApp === 'undefined' && typeof renderApp === 'function') window.renderApp = renderApp;

// Abrir panel de carrito (overlay)
window.openCartDetail = function () {
    // Cerrar si ya existe
    const existing = document.getElementById('syspago-cart-detail');
    if (existing) return;

    // Construir overlay
    const overlay = document.createElement('div');
    overlay.id = 'syspago-cart-detail';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '9998';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.3)';
    overlay.innerHTML = `
        <div class="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden" style="max-height:92vh; display:flex; flex-direction:column;">
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <div class="text-lg font-semibold">Carrito</div>
                <button id="syspago-cart-close" class="text-gray-600 hover:text-gray-900">Cerrar ✕</button>
            </div>

            <div id="syspago-cart-content" style="overflow:auto; flex:1;">

                <!-- se inyecta aqui la lista -->

            </div>

            <div class="px-4 py-3 border-t bg-gray-50">
                <div class="mb-3 grid grid-cols-2 gap-4 items-center">
                    <div>
                        <div class="text-sm text-gray-500">Sub Total</div>
                        <div id="cart-subtotal" class="text-xl font-semibold text-gray-900">$0.00</div>
                    </div>
                    <div>
                        <div class="text-sm text-gray-500">Descuento</div>
                        <div id="cart-discount" class="text-xl font-semibold text-gray-900">$0.00</div>
                    </div>
                    <div class="col-span-2 mt-2">
                        <div class="text-sm text-gray-500">Total</div>
                        <div id="cart-total" class="text-2xl font-extrabold text-green-600">$0.00</div>
                    </div>
                </div>

                <div class="flex space-x-3">
                    <button id="cart-add-product" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded">AGREGAR PRODUCTO</button>
                    <button id="cart-checkout" class="flex-1 px-4 py-2 bg-blue-700 text-white rounded">REALIZAR PAGO</button>
                </div>

                <div class="mt-3">
                    <button id="cart-clear" class="w-full px-4 py-2 border rounded text-red-600">Borrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('syspago-cart-close').addEventListener('click', closeCartDetail);
    document.getElementById('cart-add-product').addEventListener('click', () => {
        // Cambiamos a la pestaña producto genérico para agregar (o abre modal según prefieras)
        state.activeCartTab = 'generic';
        window.renderApp && window.renderApp();
        closeCartDetail();
    });
    document.getElementById('cart-checkout').addEventListener('click', () => {
        // Cambia a la vista de cobro si la tienes implementada; fallback: mostrar alerta
        if (typeof window.changeView === 'function') {
            (function () {
                const _origChangeView = window.changeView;
                window.changeView = function (viewName, pushHistory = true) {
                    // Mapear alias 'syspago' a la vista real 'syspago-menu'
                    if (viewName === 'syspago') viewName = 'syspago-menu';
                    return _origChangeView.call(this, viewName, pushHistory);
                };
            })();
        } else {
            window.showToast && window.showToast('Iniciando cobro...', 'success', 1500);
        }
        closeCartDetail();
    });
    document.getElementById('cart-clear').addEventListener('click', () => {
        if (confirm('¿Deseas borrar todos los artículos del carrito?')) {
            window.clearCart && window.clearCart();
            renderCartDetail(); // actualizar panel
        }
    });

    renderCartDetail();
    // Animación simple de entrada
    overlay.style.opacity = '0';
    requestAnimationFrame(() => overlay.style.opacity = '1');
};

// Cerrar panel
function closeCartDetail() {
    const el = document.getElementById('syspago-cart-detail');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => { try { el.remove(); } catch (e) { } }, 180);
}
window.closeCartDetail = closeCartDetail;

// Render del detalle del carrito (llama a funciones ya existentes para actualizar cantidad / remover)
function renderCartDetail() {
    const container = document.getElementById('syspago-cart-content');
    if (!container) return;

    const cart = (state && Array.isArray(state.cart)) ? state.cart : [];

    if (!cart || cart.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-gray-600">Carrito vacío.</div>`;
        document.getElementById('cart-subtotal').textContent = window.formatCurrency ? window.formatCurrency(0) : '$0.00';
        document.getElementById('cart-total').textContent = window.formatCurrency ? window.formatCurrency(0) : '$0.00';
        return;
    }

    // Generar filas
    const rows = cart.map(item => {
        const priceStr = window.formatCurrency ? window.formatCurrency(item.price || 0) : ('$' + (item.price || 0));
        const lineTotal = (item.price || 0) * (item.quantity || 1);
        const lineTotalStr = window.formatCurrency ? window.formatCurrency(lineTotal) : ('$' + lineTotal.toFixed(2));
        const id = item.id || (Math.random() * 1000000 | 0);

        return `
            <div class="px-4 py-4 border-b bg-white flex items-start justify-between">
                <div class="flex-1 pr-3">
                    <div class="text-sm font-semibold text-gray-800">${(item.name || '').toUpperCase()}</div>
                    <div class="text-sm text-gray-600 mt-1">${priceStr}</div>
                    <div class="mt-2">
                        <button data-action="remove" data-id="${id}" class="text-sm text-red-500">Eliminar</button>
                    </div>
                </div>

                <div class="flex flex-col items-end">
                    <div class="flex items-center border rounded">
                        <button data-action="dec" data-id="${id}" class="px-3 py-1 text-lg">−</button>
                        <div class="px-4 py-1 border-l border-r" style="min-width:42px; text-align:center;">${item.quantity || 1}</div>
                        <button data-action="inc" data-id="${id}" class="px-3 py-1 text-lg">+</button>
                    </div>
                    <div class="mt-3 font-semibold text-gray-900">${lineTotalStr}</div>
                    <div class="text-xs text-gray-500 mt-1">- $0</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="bg-gray-50">${rows}</div>`;

    // Enlazar botones (delegación local)
    container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const action = btn.getAttribute('data-action');
            const idAttr = btn.getAttribute('data-id');
            // Encontrar el item por id en state.cart (coincidimos por item.id o fallback por name/price)
            const itemIndex = state.cart.findIndex(it => String(it.id) === String(idAttr));
            let found = itemIndex >= 0 ? state.cart[itemIndex] : null;
            if (!found) {
                // fallback: intentar buscar por nombre/price si id no coincide
                found = state.cart.find(it => String(it.name || '') === String(btn.closest('div').querySelector('.font-semibold')?.textContent || ''));
            }

            if (action === 'remove') {
                if (found) {
                    window.removeItem && window.removeItem(found.id);
                    renderCartDetail();
                    window.showToast && window.showToast(`'${found.name}' eliminado`, 'success', 1500);
                    window.renderApp && window.renderApp();
                    window.calculateTotals && window.calculateTotals();
                }
                return;
            }

            if (!found) return;

            const currentQty = Number(found.quantity || 1);
            if (action === 'inc') {
                const newQty = currentQty + 1;
                window.updateItemQuantity && window.updateItemQuantity(found.id, newQty);
            } else if (action === 'dec') {
                const newQty = currentQty - 1;
                if (newQty <= 0) {
                    // confirmar eliminación
                    if (confirm('¿Eliminar artículo del carrito?')) {
                        window.removeItem && window.removeItem(found.id);
                    }
                } else {
                    window.updateItemQuantity && window.updateItemQuantity(found.id, newQty);
                }
            }

            // recalcular y actualizar visual
            window.calculateTotals && window.calculateTotals();
            renderCartDetail();
            window.renderApp && window.renderApp();
        });
    });

    // Actualizar sumas
    document.getElementById('cart-subtotal').textContent = window.formatCurrency ? window.formatCurrency(state.subtotal || 0) : ('$' + (state.subtotal || 0).toFixed(2));
    document.getElementById('cart-discount').textContent = window.formatCurrency ? window.formatCurrency(0) : '$0.00';
    document.getElementById('cart-total').textContent = window.formatCurrency ? window.formatCurrency(state.total || state.subtotal || 0) : ('$' + (state.total || state.subtotal || 0).toFixed(2));
}

// Borrar todo el carrito
window.clearCart = function () {
    state.cart = [];
    state.subtotal = 0;
    state.total = 0;
    window.renderApp && window.renderApp();
    window.showToast && window.showToast('Carrito borrado', 'success', 1500);
    // también actualizamos Firestore/localStorage si corresponde
    window.saveStateToFirestore && window.saveStateToFirestore();
};

// ---------- SUGERENCIA: botón "Ver Carrito" ----------
// Puedes insertar este botón en el template donde se muestra el Footer o en la vista PV Venta.
// Ejemplo simple: añade un botón flotante en la esquina inferior derecha que abra el panel
(function addCartFloatingButton() {
    if (document.getElementById('syspago-cart-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'syspago-cart-fab';
    fab.title = 'Ver carrito';
    fab.style.position = 'fixed';
    fab.style.right = '18px';
    fab.style.bottom = '18px';
    fab.style.zIndex = '9997';
    fab.style.width = '56px';
    fab.style.height = '56px';
    fab.style.borderRadius = '999px';
    fab.style.border = 'none';
    fab.style.background = '#2563EB'; // azul
    fab.style.color = 'white';
    fab.style.boxShadow = '0 6px 18px rgba(0,0,0,0.15)';
    fab.style.cursor = 'pointer';
    fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72"/></svg>';
    document.body.appendChild(fab);
    fab.addEventListener('click', () => {
        window.openCartDetail && window.openCartDetail();
    });
})();


// ---------- Bottom-sheet de pago (modal desde abajo) ----------

window.openCheckoutSheet = function (options = {}) {
    try {
        // evitar duplicados
        if (document.getElementById('syspago-checkout-sheet')) return;

        const total = (options.total !== undefined) ? options.total : (state && (state.total || state.subtotal) ? (state.total || state.subtotal) : 0);
        const totalStr = window.formatCurrency ? window.formatCurrency(total) : ('$' + (Number(total || 0)).toFixed(2));

        // fondo que cubre la pantalla (para detectar clicks fuera)
        const backdrop = document.createElement('div');
        backdrop.id = 'syspago-checkout-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.left = '0';
        backdrop.style.top = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.zIndex = '10050';
        backdrop.style.background = 'rgba(0,0,0,0.25)';
        backdrop.style.backdropFilter = 'blur(0.1px)';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 220ms ease';

        // sheet contenido (fijo abajo)
        const sheet = document.createElement('div');
        sheet.id = 'syspago-checkout-sheet';
        sheet.style.position = 'fixed';
        sheet.style.left = '0';
        sheet.style.right = '0';
        sheet.style.bottom = '0';
        sheet.style.zIndex = '10051';
        sheet.style.maxWidth = '900px';
        sheet.style.margin = '0 auto';
        sheet.style.borderTopLeftRadius = '14px';
        sheet.style.borderTopRightRadius = '14px';
        sheet.style.boxShadow = '0 -8px 30px rgba(0,0,0,0.18)';
        sheet.style.background = 'linear-gradient(#ffffff,#fafafa)';
        sheet.style.padding = '18px';
        sheet.style.transform = 'translateY(120%)';
        sheet.style.transition = 'transform 260ms cubic-bezier(.2,.9,.3,1)';
        sheet.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';

        sheet.innerHTML = `
            <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:0.95rem; color:#444;">Total:</div>
                <div style="font-size:1.25rem; font-weight:700; color:#111;">${totalStr}</div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
                <button id="syspago-pay-cash" style="width:100%; padding:14px; border-radius:10px; border:2px solid #2b6cb0; background:#fff; color:#2b6cb0; font-weight:600;">Efectivo</button>
                <button id="syspago-pay-card" style="width:100%; padding:14px; border-radius:10px; border:2px solid #2b6cb0; background:#fff; color:#2b6cb0; font-weight:600;">Tarjeta</button>
            </div>

            <div style="height:8px;"></div>
        `;

        // Añadir al DOM
        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);

        // Forzar reflow y animar
        requestAnimationFrame(() => {
            backdrop.style.opacity = '1';
            sheet.style.transform = 'translateY(0%)';
        });

        function closeSheet() {
            try {
                sheet.style.transform = 'translateY(120%)';
                backdrop.style.opacity = '0';
                setTimeout(() => {
                    try { backdrop.remove(); } catch (e) { }
                    try { sheet.remove(); } catch (e) { }
                }, 260);
            } catch (e) { console.error(e); }
        }

        // Cerrar al tocar el backdrop
        backdrop.addEventListener('click', () => closeSheet());

        // Botones de pago
        document.getElementById('syspago-pay-cash').addEventListener('click', () => {
            // Acción ejemplo: registrar pago en efectivo
            closeSheet();
            window.showToast && window.showToast('Pago en efectivo seleccionado', 'success', 1500);
            // Aquí podrías abrir la vista de cobro o llamar processCheckout('cash')
            if (typeof window.processCheckout === 'function') window.processCheckout('cash', total);
            else if (typeof window.changeView === 'function') window.changeView('checkout');
        });

        document.getElementById('syspago-pay-card').addEventListener('click', () => {
            closeSheet();
            window.showToast && window.showToast('Pago con tarjeta seleccionado', 'success', 1500);
            if (typeof window.processCheckout === 'function') window.processCheckout('card', total);
            else if (typeof window.changeView === 'function') window.changeView('checkout');
        });

        // Soporte tecla ESC para cerrar
        function onEsc(e) {
            if (e.key === 'Escape') closeSheet();
        }
        document.addEventListener('keydown', onEsc);
        // remover listener al cerrar sheet
        backdrop._cleanup = () => document.removeEventListener('keydown', onEsc);

        // Aseguramos cleanup al remover elementos
        const observer = new MutationObserver(() => {
            if (!document.body.contains(sheet)) {
                try {
                    backdrop._cleanup && backdrop._cleanup();
                    observer.disconnect();
                } catch (e) { }
            }
        });
        observer.observe(document.body, { childList: true, subtree: false });

        return {
            close: closeSheet
        };

    } catch (err) {
        console.error('openCheckoutSheet error', err);
    }
};

// Interceptar clicks del botón "REALIZAR PAGO" dentro del panel del carrito (delegación global)
// Esto funciona aunque el botón se cree dinámicamente por openCartDetail
document.body.addEventListener('click', function (ev) {
    const btn = ev.target.closest && ev.target.closest('#cart-checkout');
    if (!btn) return;
    ev.preventDefault();
    // calcular total actual (state.total preferido)
    const total = (state && (state.total || state.subtotal)) ? (state.total || state.subtotal) : 0;
    window.openCheckoutSheet && window.openCheckoutSheet({ total });
});


// ====== Pago con tarjeta: pantalla de lector listo ======
// Pegar este bloque al final de js/app.js (fuera de otras funciones).
// Este código crea una vista full-screen que simula la pantalla "Lector listo"
// y la apertura se realiza desde window.processCheckout('card', total).

window.openCardReaderView = function (options = {}) {
    try {
        // cerrar cualquier sheet/modal previo
        try { const bs = document.getElementById('syspago-checkout-sheet'); if (bs) bs.remove(); } catch (e) { }
        try { const bd = document.getElementById('syspago-checkout-backdrop'); if (bd) bd.remove(); } catch (e) { }
        // cerrar panel carrito si existe
        try { closeCartDetail && closeCartDetail(); } catch (e) { }

        // prevenir duplicados
        if (document.getElementById('syspago-card-reader')) return;

        const total = (options.total !== undefined) ? options.total : (state && (state.total || state.subtotal) ? (state.total || state.subtotal) : 0);
        const totalStr = window.formatCurrency ? window.formatCurrency(total) : ('$' + (Number(total || 0)).toFixed(2));

        // overlay full-screen
        const overlay = document.createElement('div');
        overlay.id = 'syspago-card-reader';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '11000';
        overlay.style.background = '#ffffff';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'flex-start';
        overlay.style.paddingTop = '36px';
        overlay.style.transition = 'opacity 200ms ease';
        overlay.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';

        // contenido (adaptable al estilo que muestras en la captura)
        overlay.innerHTML = `
            <div style="width:100%; max-width:480px; text-align:center;">
                <div style="margin-bottom:18px;">
                    <!-- iconos superiores -->
                    <div style="font-size:28px; color:#2b6cb0; margin-bottom:6px;">🔊</div>
                </div>

                <div style="font-weight:600; color:#222; margin-bottom:6px; font-size:18px;">Lector Listo</div>

                <div style="margin:16px 0;">
                    <!-- logo -->
                    <div style="font-weight:700; font-size:28px; color:#2b6cb0; margin-bottom:8px;">SYSpago</div>

                    <!-- imagen de fondo con sensor de pago -->
                    <div style="width:200px; height:200px; margin:0 auto 10px; border-radius:12px; display:flex; align-items:center; justify-content:center; background-image:url('icons/fondo de pago con sensor.png'); background-size:contain; background-repeat:no-repeat; background-position:center;">
                    </div>
                </div>

                <div style="color:#333; margin-top:6px; font-size:15px;">Por favor acerque ó inserte la tarjeta</div>

                <div style="margin-top:18px; font-size:14px; color:#888;">Monto</div>
                <div id="syspago-card-amount" style="font-size:36px; font-weight:700; color:#111; margin-top:6px;">${totalStr}</div>

                <div style="height:24px;"></div>

                <div style="padding:0 18px; width:100%; box-sizing:border-box;">
                    <button id="syspago-card-cancel" style="width:100%; background:#2b6cb0; color:white; border:none; padding:14px; border-radius:8px; font-weight:700;">CANCELAR TRANSACCION</button>
                </div>

                <div style="height:36px;"></div>

                <div id="syspago-card-status" style="color:#2b6cb0; font-weight:600;"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Simular lector listo / esperando tarjeta
        const status = document.getElementById('syspago-card-status');
        let intervalId = null;
        let dots = 0;
        function startWaiting() {
            if (!status) return;
            status.textContent = 'Esperando tarjeta';
            intervalId = setInterval(() => {
                dots = (dots + 1) % 4;
                status.textContent = 'Esperando tarjeta' + '.'.repeat(dots);
            }, 600);
        }
        startWaiting();

        // Cancelar
        document.getElementById('syspago-card-cancel').addEventListener('click', () => {
            // detener simulación
            try { if (intervalId) clearInterval(intervalId); } catch (e) { }
            // cerrar vista
            try { overlay.remove(); } catch (e) { }
            window.showToast && window.showToast('Transacción cancelada', 'success', 1400);
            // regresar al panel carrito o a la vista que prefieras
            if (typeof openCartDetail === 'function') openCartDetail();
        });

        // Si quieres poder cerrar con ESC
        function onEsc(e) { if (e.key === 'Escape') { try { if (intervalId) clearInterval(intervalId); } catch (e) { }; try { overlay.remove(); } catch (e) { } } }
        document.addEventListener('keydown', onEsc);
        // cleanup al remover overlay
        const mo = new MutationObserver(() => {
            if (!document.body.contains(overlay)) {
                try { document.removeEventListener('keydown', onEsc); } catch (e) { }
                try { if (intervalId) clearInterval(intervalId); } catch (e) { }
                mo.disconnect();
            }
        });
        mo.observe(document.body, { childList: true, subtree: false });

        return overlay;
    } catch (err) {
        console.error('openCardReaderView error', err);
    }
};

// ====== processCheckout: enruta a pantalla de tarjeta o efectivo ======
window.processCheckout = window.processCheckout || function (method, total) {
    try {
        // cerrar checkout sheet si está abierto
        try { const s = document.getElementById('syspago-checkout-sheet'); if (s) s.remove(); } catch (e) { }
        try { const b = document.getElementById('syspago-checkout-backdrop'); if (b) b.remove(); } catch (e) { }

        // Si method === 'card' abrir pantalla lector
        if (method === 'card') {
            window.openCardReaderView && window.openCardReaderView({ total: total });
            return;
        }

        // Si method === 'cash' manejar flujo efectivo (por ahora mostramos toast y cambiamos a view checkout si existe)
        if (method === 'cash') {
            window.showToast && window.showToast('Iniciando pago en efectivo', 'success', 1200);
            if (typeof window.changeView === 'function') window.changeView('checkout');
            return;
        }

        // fallback: open checkout view
        if (typeof window.changeView === 'function') window.changeView('checkout');
    } catch (err) {
        console.error('processCheckout error', err);
    }
};

// Interceptar clicks de openCheckoutSheet si el usuario eligió tarjeta en el sheet
// (ya está cubierto por el listener que llama processCheckout en openCheckoutSheet).
// Asegúrate de que el botón de "Tarjeta" en el sheet llama a processCheckout('card', total).


// ====== Pago en Efectivo: pantalla full-screen con cálculo de cambio ======
// Pegar este bloque al final de js/app.js (fuera de otras funciones)

window.openCashPaymentView = function (options = {}) {
    try {
        // evitar duplicados
        if (document.getElementById('syspago-cash-view')) return;

        const total = (options.total !== undefined) ? Number(options.total) : Number((state && (state.total || state.subtotal)) ? (state.total || state.subtotal) : 0);
        const totalStr = window.formatCurrency ? window.formatCurrency(total) : ('$' + total.toFixed(2));

        // Cerrar overlays previos (checkout sheet / cart detail) si existen
        try { const bs = document.getElementById('syspago-checkout-sheet'); if (bs) bs.remove(); } catch (e) { }
        try { const bd = document.getElementById('syspago-checkout-backdrop'); if (bd) bd.remove(); } catch (e) { }
        try { closeCartDetail && closeCartDetail(); } catch (e) { }

        // Crear overlay full-screen
        const overlay = document.createElement('div');
        overlay.id = 'syspago-cash-view';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '12000';
        overlay.style.background = '#fff';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'flex-start';
        overlay.style.padding = '18px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';

        overlay.innerHTML = `
            <div style="width:100%; max-width:640px; text-align:left;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <button id="syspago-cash-back" style="background:none; border:none; font-size:18px; color:#333; padding:6px; cursor:pointer;">←</button>
                    <div style="font-size:20px; font-weight:600;">Pago en Efectivo</div>
                </div>

                <div style="text-align:center; margin-top:22px;">
                    <div style="color:#666; font-size:14px;">Tu Total</div>
                    <div id="syspago-cash-total" style="font-size:48px; font-weight:700; color:#111; margin-top:6px;">${totalStr}</div>
                </div>

                <div style="margin-top:28px;">
                    <label style="display:block; color:#777; margin-bottom:8px;">Monto recibida</label>
                    <input id="syspago-cash-received" inputmode="decimal" type="text" placeholder="0.00" style="width:100%; padding:14px 12px; font-size:18px; border:none; border-bottom:1px solid #ccc; outline:none;" />
                </div>

                <div style="margin-top:36px; text-align:center;">
                    <div style="color:#888; font-size:14px;">Cambio</div>
                    <div id="syspago-cash-change" style="font-size:28px; font-weight:700; color:#111; margin-top:6px;">${window.formatCurrency ? window.formatCurrency(0) : '$0.00'}</div>
                </div>

                <div style="height:22px;"></div>

                <div style="padding:0 0 28px 0;">
                    <button id="syspago-cash-accept" style="width:100%; max-width:100%; padding:14px; border-radius:8px; background:#2d3748; color:white; font-weight:700; border:none; font-size:16px;">ACEPTAR PAGO</button>
                </div>

            </div>
        `;

        document.body.appendChild(overlay);

        // Referencias
        const input = document.getElementById('syspago-cash-received');
        const changeEl = document.getElementById('syspago-cash-change');
        const acceptBtn = document.getElementById('syspago-cash-accept');
        const backBtn = document.getElementById('syspago-cash-back');

        // Formateador
        const fmt = (v) => window.formatCurrency ? window.formatCurrency(Number(v || 0)) : ('$' + Number(v || 0).toFixed(2));

        // Actualizar cambio cuando cambia el campo
        function updateChange() {
            const receivedRaw = parseFloat((input.value || '0').toString().replace(',', '.')) || 0;
            const change = Math.max(0, receivedRaw - total);
            changeEl.textContent = fmt(change);
        }

        // Validar que solo se ingresen números y punto decimal
        input.addEventListener('input', (e) => {
            let value = e.target.value;
            // Remover caracteres no válidos (solo números y punto)
            value = value.replace(/[^0-9.]/g, '');
            // Permitir solo un punto decimal
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            // Limitar a 2 decimales
            if (parts.length === 2 && parts[1].length > 2) {
                value = parts[0] + '.' + parts[1].substring(0, 2);
            }
            e.target.value = value;
            updateChange();
        });

        // Botón aceptar pago
        acceptBtn.addEventListener('click', () => {
            const receivedRaw = parseFloat((input.value || '0').toString().replace(',', '.')) || 0;
            if (isNaN(receivedRaw) || receivedRaw <= 0) {
                window.showToast && window.showToast('Ingresa monto recibido válido', 'error', 2000);
                return;
            }
            if (receivedRaw < total) {
                // confirmar cobro incompleto
                if (!confirm('El monto recibido es menor al total. ¿Deseas continuar?')) return;
            }

            // Finalizar pago: tipo 'cash'
            window.finalizePayment && window.finalizePayment('cash', total, receivedRaw);
            // cerrar vista
            try { overlay.remove(); } catch (e) { }
        });

        // Back / cerrar (volver al carrito)
        backBtn.addEventListener('click', () => {
            try { overlay.remove(); } catch (e) { }
            // volver al panel carrito
            try { openCartDetail && openCartDetail(); } catch (e) { }
        });

        // Soporte ESC
        function onEsc(e) {
            if (e.key === 'Escape') {
                try { overlay.remove(); } catch (e) { }
            }
        }
        document.addEventListener('keydown', onEsc);
        // cleanup observer para remover listener cuando overlay desaparezca
        const mo = new MutationObserver(() => {
            if (!document.body.contains(overlay)) {
                try { document.removeEventListener('keydown', onEsc); } catch (e) { }
                mo.disconnect();
            }
        });
        mo.observe(document.body, { childList: true, subtree: false });

        // foco al input al abrir
        setTimeout(() => {
            try { input.focus(); } catch (e) { }
            updateChange();
        }, 120);

        return overlay;

    } catch (err) {
        console.error('openCashPaymentView error', err);
    }
};



window.finalizePayment = window.finalizePayment || function (method, total, received) {
    try {
        // normalizar valores
        total = Number(total || 0);
        received = Number(received || 0);
        const change = Math.max(0, Number(received - total));

        // construir transacción resumida
        const tx = {
            id: Date.now(),
            items: Array.isArray(state.cart) ? [...state.cart] : [],
            total: Number(total),
            received: Number(received),
            change: Number(change),
            method: method || 'unknown',
            date: new Date().toISOString()
        };

        // guardar en estado (para mostrar en la pantalla de éxito y/o persistir)
        state.lastTransaction = tx;
        // opcional: persistir el estado
        window.saveStateToFirestore && window.saveStateToFirestore();

        // Mostrar pantalla de éxito con detalles (no vaciamos el carrito aquí, se hará cuando el usuario pulse "¡Listo ir a caja")
        window.openPaymentSuccessView && window.openPaymentSuccessView(tx);

        // también mostrar toast breve
        window.showToast && window.showToast('Pago procesado correctamente', 'success', 1600);
    } catch (err) {
        console.error('finalizePayment error', err);
        window.showToast && window.showToast('Error procesando pago', 'error', 1600);
    }
};

// Asegurar que processCheckout redirija a la vista cash cuando corresponda
if (typeof window.processCheckout === 'function') {
    const originalProcess = window.processCheckout;
    window.processCheckout = function (method, total) {
        if (method === 'cash') {
            window.openCashPaymentView && window.openCashPaymentView({ total });
            return;
        }
        // fallback al original para otros métodos (card)
        return originalProcess(method, total);
    };
} else {
    // si no existía, definimos una simple implementación
    window.processCheckout = function (method, total) {
        if (method === 'cash') {
            window.openCashPaymentView && window.openCashPaymentView({ total });
        } else if (method === 'card') {
            window.openCardReaderView && window.openCardReaderView({ total });
        }
    };
}


// Función que muestra la pantalla final tipo "Pago realizado con éxito"
window.openPaymentSuccessView = window.openPaymentSuccessView || function (tx = {}) {
    try {
        if (!tx || typeof tx !== 'object') tx = state.lastTransaction || {};
        if (document.getElementById('syspago-payment-success')) return;

        const totalStr = window.formatCurrency ? window.formatCurrency(tx.total || 0) : ('$' + Number(tx.total || 0).toFixed(2));
        const receivedStr = window.formatCurrency ? window.formatCurrency(tx.received || 0) : ('$' + Number(tx.received || 0).toFixed(2));
        const changeStr = window.formatCurrency ? window.formatCurrency(tx.change || 0) : ('$' + Number(tx.change || 0).toFixed(2));

        // crear overlay full-screen
        const overlay = document.createElement('div');
        overlay.id = 'syspago-payment-success';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '13000';
        overlay.style.background = '#fff';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'flex-start';
        overlay.style.padding = '18px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
        overlay.style.overflow = 'auto';

        overlay.innerHTML = `
            <div style="width:100%; max-width:640px; text-align:center; margin-top:28px;">
                <div id="syspago-success-total" style="font-size:56px; font-weight:600; color:#111; margin-bottom:18px;">${totalStr}</div>
                <div style="color:#1e40af; font-weight:700; margin-bottom:22px; font-size:16px;">PAGO REALIZADO CON ÉXITO!!</div>

                <div style="width:100%; margin-top:8px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #eee;">
                        <div style="color:#777;">Monto</div>
                        <div style="font-weight:600; color:#111;">${totalStr}</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #eee;">
                        <div style="color:#777;">Monto recibida</div>
                        <div style="font-weight:600; color:#111;">${receivedStr}</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #eee; margin-bottom:12px;">
                        <div style="color:#777;">Cambio</div>
                        <div style="font-weight:600; color:#111;">${changeStr}</div>
                    </div>
                </div>

                <div style="margin-top:22px; display:flex; flex-direction:column; gap:12px;">
                    <button id="syspago-success-done" style="padding:12px 18px; background:#2b6cb0; color:white; border:none; border-radius:10px; font-weight:700;">¡Listo ir a caja</button>
                    <button id="syspago-success-share" style="padding:12px 18px; background:white; color:#2b6cb0; border:2px solid #2b6cb0; border-radius:10px; font-weight:700;">COMPARTIR TICKET</button>
                </div>

                <div style="height:32px;"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Handlers
        document.getElementById('syspago-success-done').addEventListener('click', () => {
            // Al confirmar: vaciar carrito, recalcular totales y volver a la vista principal (o a caja)
            try {
                if (Array.isArray(state.cart)) state.cart = [];
                state.subtotal = 0;
                state.total = 0;
                window.saveStateToFirestore && window.saveStateToFirestore();
                window.renderApp && window.renderApp();
                window.showToast && window.showToast('Listo, carrito actualizado', 'success', 1200);
            } catch (e) {
                console.error('error al vaciar carrito', e);
            } finally {
                try { overlay.remove(); } catch (e) { }
                // opcional: cambiar a vista 'checkout' o 'movements' según flujo
                if (typeof window.changeView === 'function') window.changeView('cart');
            }
        });

        document.getElementById('syspago-success-share').addEventListener('click', async () => {
            try {
                await window.shareTransaction ? window.shareTransaction(tx) : shareTicketFallback(tx);
            } catch (e) {
                console.error('Error compartiendo ticket', e);
                window.showToast && window.showToast('No se pudo compartir el ticket', 'error', 1400);
            }
        });

        // fallback share: copiar texto al portapapeles o usar navigator.share si está disponible
        async function shareTicketFallback(txData) {
            try {
                const when = new Date(txData.date || Date.now()).toLocaleString();
                let body = `TICKET - Transacción: ${txData.id}\nFecha: ${when}\n\nItems:\n`;
                (txData.items || []).forEach(it => {
                    const q = it.quantity || 1;
                    body += `- ${it.name} x${q} ${window.formatCurrency ? window.formatCurrency((it.price || 0) * q) : ('$' + ((it.price || 0) * q).toFixed(2))}\n`;
                });
                body += `\nMonto: ${window.formatCurrency ? window.formatCurrency(txData.total) : ('$' + Number(txData.total).toFixed(2))}\n`;
                body += `Recibido: ${window.formatCurrency ? window.formatCurrency(txData.received) : ('$' + Number(txData.received).toFixed(2))}\n`;
                body += `Cambio: ${window.formatCurrency ? window.formatCurrency(txData.change) : ('$' + Number(txData.change).toFixed(2))}\n`;

                if (navigator.share) {
                    await navigator.share({
                        title: `Ticket ${txData.id}`,
                        text: body
                    });
                    window.showToast && window.showToast('Ticket compartido', 'success', 1500);
                    return;
                }

                // copiar al portapapeles como fallback
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(body);
                    window.showToast && window.showToast('Ticket copiado al portapapeles', 'success', 1500);
                    return;
                }

                // último recurso: abrir prompt con texto para que el usuario copie manualmente
                prompt('Copiar ticket (Ctrl+C, Enter):', body);
            } catch (err) {
                console.error('shareTicketFallback error', err);
                throw err;
            }
        }

    } catch (err) {
        console.error('openPaymentSuccessView error', err);
    }
};


// ====== Función showSyspagoMenu eliminada ======
// Esta función causaba la pantalla intermedia con tiles PV Cloud/SyStienda
// Ahora la navegación va directamente a la vista cart (PV Venta)

// Vista por defecto cambiada a cart (PV Venta)
// La pantalla de bienvenida ahora está en welcome.html



window.hideInitialSplash = function () {
    try {
        const el = document.getElementById('syspago-splash');
        if (el) el.remove();
    } catch (err) {
        console.error('hideInitialSplash error', err);
    }
};



// === TECLADO VIRTUAL ON-SCREEN PARA DESKTOP TOUCH ===
// Pegar al final de js/app.js (fuera de otras funciones)

// Nota: el teclado se activa en dispositivos NO móviles (evita solaparse con teclado nativo).
(function () {
    // detecta mobile user agent
    const isMobileUA = /Mobi|Android/i.test(navigator.userAgent || '');
    // enable only on non-mobile (but also check touch capability if you want)
    const enableVKBD = !isMobileUA;

    if (!enableVKBD) {
        console.log('[vkbd] device mobile, no virtual keyboard needed.');
        return;
    }

    // crear DOM del teclado (si no existe)
    function createVKBD() {
        if (document.getElementById('syspago-vkbd')) return;
        const container = document.createElement('div');
        container.id = 'syspago-vkbd';
        container.className = 'alpha';
        container.innerHTML = `
            <div class="vk-top">
                <div class="vk-info">Teclado en pantalla</div>
                <div class="vk-hide" id="vkbd-hide">Ocultar ✕</div>
            </div>

            <div id="vk-rows">
                <!-- filas se generan dinámicamente -->
            </div>
        `;
        document.body.appendChild(container);
    }

    // layouts
    const LAYOUTS = {
        alpha: [
            ['q','w','e','r','t','y','u','i','o','p'],
            ['a','s','d','f','g','h','j','k','l'],
            ['shift','z','x','c','v','b','n','m','backspace'],
            ['123','space','enter']
        ],
        numeric: [
            ['7','8','9'],
            ['4','5','6'],
            ['1','2','3'],
            ['0','.','backspace'],
            ['ABC','enter']
        ]
    };

    // estado
    let vkState = {
        visible: false,
        layout: 'alpha',
        shift: false,
        activeEl: null,
        changingLayout: false  // Flag para evitar reset durante cambio de layout
    };

    // helpers para focus / insert
    function isTextInput(el) {
        if (!el) return false;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return true;
        if (el.isContentEditable) return true;
        return false;
    }
    function supportsNumeric(el) {
        if (!el) return false;
        if (el.tagName && el.tagName.toLowerCase() === 'input') {
            const t = el.getAttribute('type') || el.type || '';
            const m = el.getAttribute('inputmode') || '';
            if (/number|tel|numeric|decimal/i.test(t) || /numeric|tel|decimal/i.test(m)) return true;
        }
        return false;
    }

    function setActiveElement(el) {
        vkState.activeEl = el;
        // adjust layout if numeric
        if (supportsNumeric(el)) {
            vkState.layout = 'numeric';
            document.getElementById('syspago-vkbd').classList.add('numeric');
        } else {
            vkState.layout = 'alpha';
            document.getElementById('syspago-vkbd').classList.remove('numeric');
        }
        buildKeyboard();
    }

    // inserta texto en el elemento focalizado (usa selección/caret)
    function insertTextAtCursor(el, text) {
        if (!el) return;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
            try {
                const start = el.selectionStart || 0;
                const end = el.selectionEnd || 0;
                const value = el.value || '';
                const newVal = value.slice(0,start) + text + value.slice(end);
                el.value = newVal;
                const pos = start + text.length;
                el.setSelectionRange(pos,pos);
                // trigger input event con flag para evitar duplicación
                const inputEvent = new Event('input', { bubbles: true });
                inputEvent._fromVirtualKeyboard = true;
                el.dispatchEvent(inputEvent);
            } catch (e) {
                // fallback simple append
                el.value = (el.value || '') + text;
                const inputEvent = new Event('input', { bubbles: true });
                inputEvent._fromVirtualKeyboard = true;
                el.dispatchEvent(inputEvent);
            }
            try { el.focus({ preventScroll: true }); } catch(e){ el.focus(); }
            return;
        }
        // contenteditable
        if (el.isContentEditable) {
            const sel = document.getSelection();
            if (!sel) return;
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const node = document.createTextNode(text);
            range.insertNode(node);
            // move cursor after node
            range.setStartAfter(node);
            range.setEndAfter(node);
            sel.removeAllRanges();
            sel.addRange(range);
            // trigger input-like event
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.focus();
            return;
        }
    }

    function doBackspace(el) {
        if (!el) return;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
            try {
                const start = el.selectionStart || 0;
                const end = el.selectionEnd || 0;
                if (start !== end) {
                    // tiene selección
                    const value = el.value || '';
                    el.value = value.slice(0,start) + value.slice(end);
                    el.setSelectionRange(start,start);
                } else if (start > 0) {
                    const value = el.value || '';
                    const newStart = start - 1;
                    el.value = value.slice(0,newStart) + value.slice(end);
                    el.setSelectionRange(newStart,newStart);
                }
                const inputEvent = new Event('input', { bubbles: true });
                inputEvent._fromVirtualKeyboard = true;
                el.dispatchEvent(inputEvent);
            } catch (e) {
                // fallback: quitar último char
                el.value = (el.value || '').slice(0, -1);
                const inputEvent = new Event('input', { bubbles: true });
                inputEvent._fromVirtualKeyboard = true;
                el.dispatchEvent(inputEvent);
            }
            try { el.focus({ preventScroll: true }); } catch(e){ el.focus(); }
            return;
        }
        if (el.isContentEditable) {
            const sel = document.getSelection();
            if (!sel) return;
            if (sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (!range.collapsed) {
                range.deleteContents();
            } else {
                // try to delete previous character
                range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
                range.deleteContents();
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.focus();
        }
    }

    function commitEnter(el) {
        if (!el) return;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'textarea' || el.isContentEditable) {
            insertTextAtCursor(el, '\n');
            return;
        }
        // for input, try to trigger change/submit or blur
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
    }

    // construir teclado según layout y estado shift
    function buildKeyboard() {
        const container = document.getElementById('vk-rows');
        if (!container) return;
        
        // Solo configurar delegación de eventos una vez
        if (!container._vkbdDelegationSetup) {
            container._vkbdDelegationSetup = true;
            
            // Prevenir cambio de foco en mousedown
            container.addEventListener('mousedown', (ev) => {
                if (ev.target.classList.contains('vk-key')) {
                    ev.preventDefault();
                }
            });
            
            // Delegación de eventos para todos los clicks en botones
            container.addEventListener('click', (ev) => {
                const keyEl = ev.target.closest('.vk-key');
                if (!keyEl) return;
                
                ev.preventDefault();
                ev.stopPropagation();
                
                const k = keyEl.dataset.key;
                const active = vkState.activeEl;
                if (!active) return;
                
                if (k === 'shift') {
                    vkState.shift = !vkState.shift;
                    buildKeyboard();
                    return;
                }
                if (k === 'backspace') {
                    doBackspace(active);
                    return;
                }
                if (k === 'enter') {
                    commitEnter(active);
                    return;
                }
                if (k === 'space') {
                    insertTextAtCursor(active, ' ');
                    return;
                }
                if (k === '123') {
                    vkState.layout = 'numeric';
                    const kbd = document.getElementById('syspago-vkbd');
                    if (kbd) {
                        kbd.classList.add('numeric');
                    }
                    buildKeyboard();
                    return;
                }
                if (k === 'ABC') {
                    vkState.layout = 'alpha';
                    document.getElementById('syspago-vkbd').classList.remove('numeric');
                    buildKeyboard();
                    return;
                }
                // normal char
                const key = k;
                const toInsert = (vkState.shift && key.length === 1 && key.match(/^[a-z]$/)) ? key.toUpperCase() : key;
                insertTextAtCursor(active, toInsert);
            });
        }
        
        container.innerHTML = '';
        const layout = vkState.layout === 'numeric' ? LAYOUTS.numeric : LAYOUTS.alpha;
        layout.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'vk-row';
            row.forEach(key => {
                const keyEl = document.createElement('button');
                keyEl.type = 'button';
                keyEl.className = 'vk-key';
                keyEl.tabIndex = -1; // Evitar que el botón reciba foco
                // wide keys
                if (key === 'space') keyEl.classList.add('wider');
                if (key === 'enter' || key === 'shift' || key === 'backspace' || key === '123' || key === 'ABC') keyEl.classList.add('wide', 'secondary');
                const display = (function (k) {
                    if (k === 'space') return '⎵';
                    if (k === 'backspace') return '⌫';
                    if (k === 'enter') return '↵';
                    if (k === 'shift') return '⇧';
                    if (k === '123') return '123';
                    if (k === 'ABC') return 'ABC';
                    return k;
                })(key);
                keyEl.textContent = (vkState.shift && /^[a-z]$/.test(key) ? key.toUpperCase() : display);
                keyEl.dataset.key = key;
                // Ya no necesitamos listeners individuales, usamos delegación
                rowEl.appendChild(keyEl);
            });
            container.appendChild(rowEl);
        });
    }

    // show/hide functions
    function showVKBD() {
        createVKBD();
        const kb = document.getElementById('syspago-vkbd');
        if (!kb) return;
        document.body.classList.remove('no-virtual-keyboard');
        kb.style.display = 'block';
        const wasVisible = vkState.visible;
        vkState.visible = true;
        // Solo reconstruir el teclado si no estaba visible antes
        if (!wasVisible) {
            buildKeyboard();
        }
    }
    function hideVKBD() {
        const kb = document.getElementById('syspago-vkbd');
        if (!kb) return;
        kb.style.display = 'none';
        vkState.visible = false;
        vkState.activeEl = null;
    }

    // attach global listeners: focus on inputs => show keyboard
    function onFocusIn(e) {
        const target = e.target;
        if (!isTextInput(target)) return;
        // ignore readonly/disabled
        if (target.readOnly || target.disabled) return;
        // set active
        setActiveElement(target);
        // show keyboard
        showVKBD();
        // ensure caret visible: scroll into view if needed
        try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(e){}
    }

    function onFocusOut(e) {
        // delay hiding to allow clicks on keyboard to register
        setTimeout(() => {
            // if focus is inside keyboard, don't hide
            const active = document.activeElement;
            const kb = document.getElementById('syspago-vkbd');
            if (!kb) return;
            if (kb.contains(active)) return;
            // also if vkState.activeEl exists and still focused, keep
            if (vkState.activeEl && (document.activeElement === vkState.activeEl)) return;
            // otherwise hide
            hideVKBD();
        }, 120);
    }

    // click on hide button
    function attachHideControl() {
        const hideBtn = document.getElementById('vkbd-hide');
        if (!hideBtn) return;
        hideBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            hideVKBD();
        });
    }

    // initialize
    function install() {
        createVKBD();
        attachHideControl();
        // delegate focus/blur
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        // also support touchstart to open keyboard when tapping elements not focusing normally (some custom elements)
        document.addEventListener('touchstart', (ev) => {
            const t = ev.target.closest && ev.target.closest('input, textarea, [contenteditable="true"]');
            if (!t) return;
            // trigger focus
            try { t.focus(); } catch(e){}
        }, { passive: true });
        console.log('[vkbd] virtual keyboard installed (desktop).');
    }

    // run installer
    try { install(); } catch (e) { console.error('vkbd install error', e); }

})();