import * as api from './api.ts';
import * as auth from './auth.ts';
import { elements, render, renderShipmentHistory, updateBatchBar, applyTheme, updateLoading, updateTransitAlert, exportToCSV } from './ui.ts';
import { Shipment } from './api.ts';
import { isNonNegativeInteger, isShipmentStatus } from './domain.ts';

let shipments: Shipment[] = [];
let selectedShipments = new Set<string>();
let sortState = { column: null as string | null, direction: 'asc' as 'asc' | 'desc' };
let shipmentSummary: api.ShipmentSummary = {
    total: 0, arrived: 0, transit: 0, collected: 0,
    totalFees: 0, arrivedFees: 0, collectedFees: 0, transitFees: 0,
};
let totalCount = 0;
let currentPage = 1;
let pageSize = Number(elements.pageSize.value) || 25;
let searchDebounce: ReturnType<typeof setTimeout> | undefined;
let latestLoadId = 0;
let currentProfile: api.UserProfile | null = null;
let transitAlertCount = 0;
let delayedTransitFilterActive = false;

function refreshTransitAlertDisplay(): void {
    updateTransitAlert(transitAlertCount, delayedTransitFilterActive);
}

function getTransitAlertCutoffs(): { normal: string; maritime: string } {
    const now = new Date();
    const maritime = new Date(now);
    const dayOfMonth = maritime.getDate();
    maritime.setDate(1);
    maritime.setMonth(maritime.getMonth() - 3);
    const lastDayOfTargetMonth = new Date(maritime.getFullYear(), maritime.getMonth() + 1, 0).getDate();
    maritime.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
    maritime.setDate(maritime.getDate() - 15);
    return {
        normal: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(),
        maritime: maritime.toISOString(),
    };
}

function clearDelayedTransitFilter(): void {
    if (!delayedTransitFilterActive) return;
    delayedTransitFilterActive = false;
    refreshTransitAlertDisplay();
}

function applyProfile(profile: api.UserProfile): void {
    currentProfile = profile;
    const userFilterContainer = document.getElementById('user-filter-container');
    const formUserField = document.getElementById('form-user-field');
    const formUser = document.getElementById('form-user') as HTMLSelectElement;

    if (profile.role === 'admin') {
        userFilterContainer?.classList.remove('hidden');
        formUserField?.classList.remove('hidden');
        elements.userFilter.value = 'All';
        formUser.value = profile.username;
    } else {
        userFilterContainer?.classList.add('hidden');
        formUserField?.classList.add('hidden');
        elements.userFilter.value = profile.username;
        formUser.value = profile.username;
    }
}

async function authorizeProfile(userId: string): Promise<void> {
    applyProfile(await api.getCurrentProfile(userId));
}

function currentFilters(): api.ShipmentFilters {
    const today = new Date();
    const toDateInputValue = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    let createdFrom = '';
    let createdTo = '';
    const period = elements.dateRangeFilter.value;
    if (!delayedTransitFilterActive && period === 'custom') {
        createdFrom = elements.dateFrom.value;
        createdTo = elements.dateTo.value;
    } else if (!delayedTransitFilterActive && period !== 'all') {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (period === 'last7') start.setDate(start.getDate() - 6);
        else if (period === 'thisMonth') start.setDate(1);
        else if (period === 'last30') start.setDate(start.getDate() - 29);
        createdFrom = toDateInputValue(start);
        createdTo = toDateInputValue(today);
    }

    return {
        search: elements.searchInput.value,
        username: elements.userFilter.value,
        status: delayedTransitFilterActive ? 'En transit' : elements.statusFilter.value,
        createdFrom: delayedTransitFilterActive ? '' : createdFrom,
        createdTo: delayedTransitFilterActive ? '' : createdTo,
        transitBefore: '',
        transitNormalBefore: delayedTransitFilterActive ? getTransitAlertCutoffs().normal : '',
        transitMaritimeBefore: delayedTransitFilterActive ? getTransitAlertCutoffs().maritime : '',
    };
}

function renderCurrentPage(): void {
    render(
        shipments, shipmentSummary, selectedShipments, currentPage, pageSize, totalCount,
        sortState, handleToggleSelection, handleChangeStatus, handleChangeShippingMethod, handleDeleteShipment, handleUpdateFrais, handleViewHistory
    );
}

async function handleViewHistory(shipment: Shipment): Promise<void> {
    elements.historyTitle.textContent = `Historique — ${shipment.article} (${shipment.id})`;
    elements.historyList.textContent = 'Chargement de l’historique…';
    elements.modalHistory.classList.remove('hidden');
    elements.modalHistory.classList.add('flex');

    try {
        const entries = await api.getShipmentHistory(shipment.id);
        renderShipmentHistory(shipment, entries);
    } catch (err: any) {
        elements.historyList.textContent = 'Impossible de charger l’historique.';
        alert("Erreur lors du chargement de l’historique : " + err.message);
    }
}

async function refreshData(requestedPage = currentPage): Promise<void> {
    const loadId = ++latestLoadId;
    try {
        updateLoading(true);
        const filters = currentFilters();
        const [result, summary, alertCount] = await Promise.all([
            api.getShipments(filters, requestedPage, pageSize, sortState),
            api.getShipmentSummary(filters),
            api.getTransitAlertCount(filters.username),
        ]);
        if (loadId !== latestLoadId) return;
        totalCount = result.count;
        const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
        currentPage = Math.min(Math.max(1, requestedPage), lastPage);
        if (currentPage !== requestedPage) {
            const corrected = await api.getShipments(filters, currentPage, pageSize, sortState);
            if (loadId !== latestLoadId) return;
            shipments = corrected.data;
            totalCount = corrected.count;
        } else {
            shipments = result.data;
        }
        shipmentSummary = summary;
        transitAlertCount = alertCount;
        refreshTransitAlertDisplay();
        renderCurrentPage();
    } catch (err: any) {
        if (loadId === latestLoadId) alert("Erreur de connexion : " + err.message);
    } finally {
        if (loadId === latestLoadId) updateLoading(false);
    }
}

function handleToggleSelection(id: string): void {
    if (selectedShipments.has(id)) {
        selectedShipments.delete(id);
    } else {
        selectedShipments.add(id);
    }
    updateBatchBar(selectedShipments.size);
    renderCurrentPage();
}

async function handleChangeStatus(id: string, newStatus: string): Promise<void> {
    const shipment = shipments.find(s => s.id === id);
    if (!shipment) return;

    try {
        updateLoading(true);
        await api.updateShipment(id, { status: newStatus });
        await refreshData();
    } catch (err: any) {
        alert("Erreur : " + err.message);
    } finally {
        updateLoading(false);
    }
}

async function handleChangeShippingMethod(id: string, shippingMethod: string): Promise<void> {
    if (shippingMethod !== 'Normal' && shippingMethod !== 'Maritime') return;
    try {
        updateLoading(true);
        await api.updateShipment(id, { shipping_method: shippingMethod });
        await refreshData();
    } catch (err: any) {
        alert('Impossible de modifier le mode d’envoi : ' + err.message);
        await refreshData();
    } finally {
        updateLoading(false);
    }
}

async function handleDeleteShipment(id: string): Promise<void> {
    if (confirm("Supprimer cet article ?")) {
        try {
            updateLoading(true);
            await api.deleteShipment(id);
            selectedShipments.delete(id);
            updateBatchBar(selectedShipments.size);
            await refreshData();
        } catch (err: any) {
            alert("Erreur : " + err.message);
        } finally {
            updateLoading(false);
        }
    }
}

async function handleUpdateFrais(id: string, value: string): Promise<void> {
    const newValue = value.trim() === '' ? 0 : Number(value);
    if (!isNonNegativeInteger(newValue)) {
        alert("Les frais doivent être un nombre entier positif ou nul.");
        renderCurrentPage();
        return;
    }
    try {
        await api.updateShipment(id, { frais: newValue });
        await refreshData();
    } catch (err: any) {
        alert("Erreur : " + err.message);
    }
}

async function init(): Promise<void> {
    applyTheme();
    try {
        const session = await auth.getSession();
        if (session) {
            await authorizeProfile(session.user.id);
            elements.loginOverlay.classList.add('hidden');
            elements.loginOverlay.classList.remove('flex');
            elements.appContent.classList.remove('hidden');
            await refreshData();

        } else {
            elements.loginOverlay.classList.remove('hidden');
            elements.loginOverlay.classList.add('flex');
            elements.appContent.classList.add('hidden');
        }
    } catch (e: any) {
        console.error("Init error:", e);
        await auth.signOut().catch(() => undefined);
        elements.loginError.textContent = 'Ce compte ne possède pas de profil ESOA autorisé. Contactez l’administrateur.';
        elements.loginError.classList.remove('hidden');
        elements.loginOverlay.classList.remove('hidden');
        elements.loginOverlay.classList.add('flex');
        elements.appContent.classList.add('hidden');
    }
}

// Event Listeners
elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    elements.loginError.classList.add('hidden');
    try {
        const { user } = await auth.signIn(email, password);
        await authorizeProfile(user.id);
        elements.loginOverlay.classList.add('hidden');
        elements.loginOverlay.classList.remove('flex');
        elements.appContent.classList.remove('hidden');
        await refreshData();
    } catch (err: any) {
        await auth.signOut().catch(() => undefined);
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
        currentProfile = null;
        shipments = [];
        selectedShipments.clear();
        updateBatchBar(0);
        renderCurrentPage();
    } catch (err: any) {
        alert("Erreur : " + err.message);
    }
});

elements.btnExport.addEventListener('click', async () => {
    try {
        updateLoading(true);
        exportToCSV(await api.getAllShipments(currentFilters()));
    } catch (err: any) {
        alert("Erreur lors de l’export : " + err.message);
    } finally {
        updateLoading(false);
    }
});

elements.btnAdd.addEventListener('click', () => {
    elements.modalAdd.classList.remove('hidden');
    elements.modalAdd.classList.add('flex');
});

elements.btnCloseModal.addEventListener('click', () => {
    elements.modalAdd.classList.add('hidden');
    elements.modalAdd.classList.remove('flex');
});

elements.btnCloseHistory.addEventListener('click', () => {
    elements.modalHistory.classList.add('hidden');
    elements.modalHistory.classList.remove('flex');
});

elements.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fraisValue = Number((document.getElementById('form-frais') as HTMLInputElement).value);
    if (!isNonNegativeInteger(fraisValue)) {
        alert("Les frais doivent être un nombre entier positif ou nul.");
        return;
    }

    const article = (document.getElementById('form-article') as HTMLInputElement).value.trim();
    if (!article) {
        alert("Veuillez saisir le nom de l’article.");
        return;
    }

    const id = (document.getElementById('form-id') as HTMLInputElement).value.trim();
    if (!id) {
        alert("Veuillez saisir l’identifiant de tracking.");
        return;
    }
    const newShipment: Omit<Shipment, 'created_at'> = {
        username: (document.getElementById('form-user') as HTMLSelectElement).value,
        id,
        article,
        frais: fraisValue,
        status: (document.getElementById('form-status') as HTMLSelectElement).value,
        shipping_method: (document.getElementById('form-shipping-method') as HTMLSelectElement).value as 'Normal' | 'Maritime',
    };
    if (!isShipmentStatus(newShipment.status)) {
        alert("Veuillez choisir un statut valide.");
        return;
    }

    try {
        if (await api.shipmentExists(id)) {
            alert("Cet identifiant de tracking existe déjà.");
            return;
        }
        updateLoading(true);

        await api.insertShipment(newShipment);

        await refreshData();

        elements.addForm.reset();
        elements.modalAdd.classList.add('hidden');
        elements.modalAdd.classList.remove('flex');
    } catch (err: any) {
        alert("Erreur : " + err.message);
    } finally {
        updateLoading(false);
    }
});

elements.searchInput.addEventListener('input', () => {
    clearDelayedTransitFilter();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { void refreshData(1); }, 250);
});
elements.userFilter.addEventListener('change', () => { clearDelayedTransitFilter(); void refreshData(1); });
elements.statusFilter.addEventListener('change', () => { clearDelayedTransitFilter(); void refreshData(1); });
elements.dateRangeFilter.addEventListener('change', () => {
    clearDelayedTransitFilter();
    elements.customDateRange.classList.toggle('hidden', elements.dateRangeFilter.value !== 'custom');
    void refreshData(1);
});
elements.dateFrom.addEventListener('change', () => { clearDelayedTransitFilter(); if (elements.dateRangeFilter.value === 'custom') void refreshData(1); });
elements.dateTo.addEventListener('change', () => { clearDelayedTransitFilter(); if (elements.dateRangeFilter.value === 'custom') void refreshData(1); });
elements.transitAlertButton.addEventListener('click', () => {
    delayedTransitFilterActive = !delayedTransitFilterActive;
    if (delayedTransitFilterActive) {
        elements.searchInput.value = '';
        elements.dateRangeFilter.value = 'all';
        elements.dateFrom.value = '';
        elements.dateTo.value = '';
        elements.customDateRange.classList.add('hidden');
    }
    refreshTransitAlertDisplay();
    void refreshData(1);
});
elements.pageSize.addEventListener('change', () => {
    pageSize = Number(elements.pageSize.value) || 25;
    void refreshData(1);
});
elements.btnPagePrev.addEventListener('click', () => {
    if (currentPage > 1) void refreshData(currentPage - 1);
});
elements.btnPageNext.addEventListener('click', () => {
    if (currentPage * pageSize < totalCount) void refreshData(currentPage + 1);
});

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        sortState.direction = (sortState.column === col && sortState.direction === 'asc') ? 'desc' : 'asc';
        sortState.column = col;
        void refreshData(1);
    });
});

elements.selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    if (isChecked) {
        shipments.forEach(s => selectedShipments.add(s.id));
    } else {
        shipments.forEach(s => selectedShipments.delete(s.id));
    }
    updateBatchBar(selectedShipments.size);
    renderCurrentPage();
});

elements.btnBatchStatus.addEventListener('click', async () => {
    const newStatus = elements.batchStatusSelect.value;
    if (!confirm(`Changer le statut de ${selectedShipments.size} article(s) vers "${newStatus}" ?`)) return;

    try {
        updateLoading(true);
        for (const id of selectedShipments) {
            await api.updateShipment(id, { status: newStatus });
        }
        selectedShipments.clear();
        updateBatchBar(0);
        await refreshData();
    } catch (err: any) {
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
        selectedShipments.clear();
        updateBatchBar(0);
        await refreshData();
    } catch (err: any) {
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

document.getElementById('btn-messenger')?.addEventListener('click', () => {
    const width = 420;
    const height = 700;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
        'https://www.facebook.com/messages/t/100583799205278',
        'esoa-messenger',
        `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (popup) popup.opener = null;
});

init();
