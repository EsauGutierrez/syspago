// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Function to change views
    window.changeView = (viewName) => {
        const mainContent = document.getElementById('main-content');
        // Clear current content
        mainContent.innerHTML = '';

        // Load the appropriate view
        switch (viewName) {
            case 'topup':
                mainContent.innerHTML = '<h1>Recargas</h1>';
                break;
            case 'payment':
                mainContent.innerHTML = '<h1>Servicios de Pago</h1>';
                break;
            case 'checkout':
                mainContent.innerHTML = '<h1>Checkout</h1>';
                break;
            case 'movements':
                mainContent.innerHTML = '<h1>Movimientos</h1>';
                break;
            case 'cart':
                mainContent.innerHTML = '<h1>Carrito de Compras</h1>';
                break;
            case 'services':
                loadServicesMenu();
                break;
            default:
                mainContent.innerHTML = '<h1>Bienvenido</h1>';
        }
    };

    // Function to load the services menu
    const loadServicesMenu = () => {
        const servicesHTML = `
            <h2 class="text-xl font-bold mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Servicios
            </h2>
            <ul class="list-disc pl-5">
                <li>Agua y drenaje</li>
                <li>Catálogos</li>
                <li>Gas y electricidad</li>
                <li>Gobiernos</li>
                <li>Lotería</li>
                <li>Movilidad</li>
                <li>Servicios digitales</li>
                <li>TV e internet</li>
            </ul>
        `;
        document.getElementById('main-content').innerHTML = servicesHTML;
    };

    // Close commission modal function
    window.closeCommissionModal = () => {
        document.getElementById('commission-modal').classList.add('hidden');
    };

    // Apply commission function
    window.applyCommission = () => {
        // Logic to apply commission
        closeCommissionModal();
    };

    // Toggle commission input function
    window.toggleCommissionInput = (type) => {
        const percentageGroup = document.getElementById('commission-percentage-group');
        const fixedGroup = document.getElementById('commission-fixed-group');
        if (type === 'percentage') {
            percentageGroup.classList.remove('hidden');
            fixedGroup.classList.add('hidden');
        } else {
            percentageGroup.classList.add('hidden');
            fixedGroup.classList.remove('hidden');
        }
    };

    // Update modal commission amount function
    window.updateModalCommissionAmount = () => {
        const percentage = document.getElementById('commission-percentage').value;
        const fixed = document.getElementById('commission-fixed').value;
        const amount = document.getElementById('modal-commission-amount');

        if (document.querySelector('input[name="commissionType"]:checked').value === 'percentage') {
            amount.textContent = `$${(percentage / 100).toFixed(2)}`;
        } else {
            amount.textContent = `$${parseFloat(fixed).toFixed(2)}`;
        }
    };
});