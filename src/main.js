import * as api from './api.js';
import * as auth from './auth.js';
import { elements, render, updateBatchBar, applyTheme, updateLoading, exportToCSV } from './ui.js';

let shipments = [];
let selectedShipments = new Set();
let sortState = { column: null, direction: 'asc' };

async function refreshData() {
    try {
        updateLoading(true);
        shipments = await api.getShipments();
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais);
    } catch (err) {
        alert("Erreur de connexion : " + err.message);
    } finally {
        updateLoading(false);
    }
}

function handleToggleSelection(id) {
    if (selectedShipments.has(id)) {
        selectedShipments.delete(id);
    } else {
        selectedShipments.add(id);
    }
    updateBatchBar(selectedShipments.size);
    render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais);
}

async function handleToggleStatus(id) {
    const shipment = shipments.find(s => s.id === id);
    const statusCycle = ["En transit", "Livré", "Récupéré"];
    const currentIndex = statusCycle.indexOf(shipment.status);
    const newStatus = statusCycle[(currentIndex + 1) % statusCycle.length] || statusCycle[0];

    try {
        updateLoading(true);
        await api.updateShipment(id, { status: newStatus });
        await api.logEvent('STATUS_CHANGE', id, { old: shipment.status, new: newStatus });
        await refreshData();
    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        updateLoading(false);
    }
}

async function handleDeleteShipment(id) {
    if (confirm("Supprimer cet article ?")) {
        try {
            updateLoading(true);
            await api.deleteShipment(id);
            await api.logEvent('DELETE', id);
            selectedShipments.delete(id);
            updateBatchBar(selectedShipments.size);
            await refreshData();
        } catch (err) {
            alert("Erreur : " + err.message);
        } finally {
            updateLoading(false);
        }
    }
}

async function handleUpdateFrais(id, value) {
    const newValue = parseInt(value) || 0;
    if (newValue < 0) {
        alert("Les frais ne peuvent pas être négatifs.");
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais);
        return;
    }
    try {
        await api.updateShipment(id, { frais: newValue });
        await api.logEvent('FRAIS_CHANGE', id, { newValue });
        await refreshData();
    } catch (err) {
        alert("Erreur : " + err.message);
    }
}

async function init() {
    applyTheme();
    try {
        const session = await auth.getSession();
        if (session) {
            elements.loginOverlay.classList.add('hidden');
            elements.loginOverlay.classList.remove('flex');
            elements.appContent.classList.remove('hidden');
            await refreshData();
        } else {
            elements.loginOverlay.classList.remove('hidden');
            elements.loginOverlay.classList.add('flex');
            elements.appContent.classList.add('hidden');
        }
    } catch (e) {
        console.error("Init error:", e);
    }
}

// Event Listeners
elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    elements.loginError.classList.add('hidden');
    try {
        await auth.signIn(email, password);
        elements.loginOverlay.classList.add('hidden');
        elements.loginOverlay.classList.remove('flex');
        elements.appContent.classList.remove('hidden');
        await refreshData();
    } catch (err) {
        elements.loginError.innerText = err.message;
        elements.loginError.classList.remove('hidden');
    }
});

elements.btnLogout.addEventListener('click', async () => {
    try {
        await auth.signOut();
        elements.loginOverlay.classList.remove('hidden');
        elements.loginOverlay.classList.add('flex');
        elements.appContent.classList.add('hidden');
        shipments = [];
        selectedShipments.clear();
        updateBatchBar(0);
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais);
    } catch (err) {
        alert("Erreur : " + err.message);
    }
});

elements.btnExport.addEventListener('click', () => exportToCSV(shipments));

elements.btnAdd.addEventListener('click', () => {
    elements.modalAdd.classList.remove('hidden');
    elements.modalAdd.classList.add('flex');
});

elements.btnCloseModal.addEventListener('click', () => {
    elements.modalAdd.classList.add('hidden');
    elements.modalAdd.classList.remove('flex');
});

elements.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fraisValue = parseInt(document.getElementById('form-frais').value) || 0;
    if (fraisValue < 0) {
        alert("Les frais ne peuvent pas être négatifs.");
        return;
    }
    const newShipment = {
        username: document.getElementById('form-user').value,
        id: document.getElementById('form-id').value,
        article: document.getElementById('form-article').value,
        frais: fraisValue,
        status: document.getElementById('form-status').value,
    };
    try {
        updateLoading(true);
        await api.insertShipment(newShipment);
        await api.logEvent('CREATE', newShipment.id, { article: newShipment.article });
        await refreshData();
        elements.addForm.reset();
        elements.modalAdd.classList.add('hidden');
        elements.modalAdd.classList.remove('flex');
    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        updateLoading(false);
    }
});

elements.searchInput.addEventListener('input', () => render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais));
elements.userFilter.addEventListener('change', () => render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais));
elements.statusFilter.addEventListener('change', () => render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais));

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        sortState.direction = (sortState.column === col && sortState.direction === 'asc') ? 'desc' : 'asc';
        sortState.column = col;
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais);
    });
});

elements.selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const filterText = elements.searchInput.value.toLowerCase();
    const filterUser = elements.userFilter.value;
    const filterStatus = elements.statusFilter.value;

    const filtered = shipments.filter(s => {
        const matchesText = (s.id && s.id.toLowerCase().includes(filterText)) ||
                            (s.article && s.article.toLowerCase().includes(filterText));
        const matchesUser = filterUser === "All" || s.username === filterUser;
        const matchesStatus = filterStatus === "All" || s.status === filterStatus;
        return matchesText && matchesUser && matchesStatus;
    });

    if (isChecked) {
        filtered.forEach(s => selectedShipments.add(s.id));
    } else {
        filtered.forEach(s => selectedShipments.delete(s.id));
    }
    updateBatchBar(selectedShipments.size);
    render(shipments, selectedShipments, sortState, handleToggleSelection, handleToggleStatus, handleDeleteShipment, handleUpdateFrais);
});

elements.btnBatchStatus.addEventListener('click', async () => {
    const newStatus = elements.batchStatusSelect.value;
    if (!confirm(`Changer le statut de ${selectedShipments.size} article(s) vers "${newStatus}" ?`)) return;

    try {
        updateLoading(true);
        for (const id of selectedShipments) {
            await api.updateShipment(id, { status: newStatus });
            await api.logEvent('STATUS_CHANGE', id, { newStatus });
        }
        selectedShipments.clear();
        updateBatchBar(0);
        await refreshData();
    } catch (err) {
        alert("Erreur lors de la mise à jour groupée : " + err.message);
    } finally {
        updateLoading(false);
    }
});

elements.btnBatchDelete.addEventListener('click', async () => {
    if (!confirm(`Supprimer définitivement ${selectedShipments.size} article(s) ?`)) return;

    try {
        updateLoading(true);
        const idsToDelete = Array.from(selectedShipments);
        await api.deleteMultipleShipments(idsToDelete);
        for (const id of idsToDelete) {
            await api.logEvent('DELETE', id);
        }
        selectedShipments.clear();
        updateBatchBar(0);
        await refreshData();
    } catch (err) {
        alert("Erreur lors de la suppression groupée : " + err.message);
    } finally {
        updateLoading(false);
    }
});

elements.btnThemeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme();
});

init();
