import * as api from './api.ts';
import * as auth from './auth.ts';
import { elements, render, updateBatchBar, applyTheme, updateLoading, exportToCSV } from './ui.ts';
import { Shipment } from './api.ts';

let shipments: Shipment[] = [];
let selectedShipments = new Set<string>();
let sortState = { column: null as string | null, direction: 'asc' as 'asc' | 'desc' };

async function logEventOrWarn(action: string, shipmentId: string, details: Record<string, unknown> = {}): Promise<boolean> {
    const logged = await api.logEvent(action, shipmentId, details);
    if (!logged) {
        alert("L’action a été effectuée, mais son ajout à l’historique a échoué.");
    }
    return logged;
}

async function refreshData(): Promise<void> {
    try {
        updateLoading(true);
        shipments = await api.getShipments();
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais);
    } catch (err: any) {
        alert("Erreur de connexion : " + err.message);
    } finally {
        updateLoading(false);
    }
}

function handleToggleSelection(id: string): void {
    if (selectedShipments.has(id)) {
        selectedShipments.delete(id);
    } else {
        selectedShipments.add(id);
    }
    updateBatchBar(selectedShipments.size);
    render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais);
}

async function handleChangeStatus(id: string, newStatus: string): Promise<void> {
    const shipment = shipments.find(s => s.id === id);
    if (!shipment) return;

    try {
        updateLoading(true);
        await api.updateShipment(id, { status: newStatus });
        await logEventOrWarn('STATUS_CHANGE', id, { old: shipment.status, new: newStatus });
        await refreshData();
    } catch (err: any) {
        alert("Erreur : " + err.message);
    } finally {
        updateLoading(false);
    }
}

async function handleDeleteShipment(id: string): Promise<void> {
    if (confirm("Supprimer cet article ?")) {
        try {
            updateLoading(true);
            await api.deleteShipment(id);
            await logEventOrWarn('DELETE', id);
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
    if (!Number.isSafeInteger(newValue) || newValue < 0) {
        alert("Les frais doivent être un nombre entier positif ou nul.");
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais);
        return;
    }
    try {
        await api.updateShipment(id, { frais: newValue });
        await logEventOrWarn('FRAIS_CHANGE', id, { newValue });
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
    }
}

// Event Listeners
elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    elements.loginError.classList.add('hidden');
    try {
        await auth.signIn(email, password);
        elements.loginOverlay.classList.add('hidden');
        elements.loginOverlay.classList.remove('flex');
        elements.appContent.classList.remove('hidden');
        await refreshData();
    } catch (err: any) {
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
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais);
    } catch (err: any) {
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
    const fraisValue = Number((document.getElementById('form-frais') as HTMLInputElement).value);
    if (!Number.isSafeInteger(fraisValue) || fraisValue < 0) {
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
    if (shipments.some(shipment => shipment.id === id)) {
        alert("Cet identifiant de tracking existe déjà.");
        return;
    }

    const newShipment: Omit<Shipment, 'created_at'> = {
        username: (document.getElementById('form-user') as HTMLSelectElement).value,
        id,
        article,
        frais: fraisValue,
        status: (document.getElementById('form-status') as HTMLSelectElement).value,
    };

    try {
        updateLoading(true);

        await api.insertShipment(newShipment);
        await logEventOrWarn('CREATE', newShipment.id, { article });

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

elements.searchInput.addEventListener('input', () => render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais));
elements.userFilter.addEventListener('change', () => render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais));
elements.statusFilter.addEventListener('change', () => render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais));

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        sortState.direction = (sortState.column === col && sortState.direction === 'asc') ? 'desc' : 'asc';
        sortState.column = col;
        render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais);
    });
});

elements.selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
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
    render(shipments, selectedShipments, sortState, handleToggleSelection, handleChangeStatus, handleDeleteShipment, handleUpdateFrais);
});

elements.btnBatchStatus.addEventListener('click', async () => {
    const newStatus = elements.batchStatusSelect.value;
    if (!confirm(`Changer le statut de ${selectedShipments.size} article(s) vers "${newStatus}" ?`)) return;

    try {
        updateLoading(true);
        let allEventsLogged = true;
        for (const id of selectedShipments) {
            await api.updateShipment(id, { status: newStatus });
            if (!await api.logEvent('STATUS_CHANGE', id, { newStatus })) allEventsLogged = false;
        }
        if (!allEventsLogged) alert("Les statuts ont été modifiés, mais une partie de l’historique n’a pas été enregistrée.");
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
        let allEventsLogged = true;
        for (const id of idsToDelete) {
            if (!await api.logEvent('DELETE', id)) allEventsLogged = false;
        }
        if (!allEventsLogged) alert("Les articles ont été supprimés, mais une partie de l’historique n’a pas été enregistrée.");
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
