// CONFIGURATION SUPABASE (Chargées via variables d'environnement Vite)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let shipments = [];
let selectedShipments = new Set();

// Elements
const tableBody = document.getElementById('tracking-table-body');
const searchInput = document.getElementById('search-input');
const userFilter = document.getElementById('user-filter');
const statusFilter = document.getElementById('status-filter');
const btnAdd = document.getElementById('btn-add');
const btnExport = document.getElementById('btn-export');
const modalAdd = document.getElementById('modal-add');
const btnCloseModal = document.getElementById('btn-close-modal');
const addForm = document.getElementById('add-form');
const loadingSpinner = document.getElementById('loading-spinner');

const statTotal = document.getElementById('stat-total');
const statDelivered = document.getElementById('stat-delivered');
const statTransit = document.getElementById('stat-transit');
const statRecupere = document.getElementById('stat-recupere');
const statTotalFrais = document.getElementById('stat-total-frais');
const statFraisLivres = document.getElementById('stat-frais-livres');
const statFraisRecupere = document.getElementById('stat-frais-recupere');
const statFraisTransit = document.getElementById('stat-frais-transit');

const loginOverlay = document.getElementById('login-overlay');
const appContent = document.getElementById('app-content');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

// Batch Actions Elements
const batchActionsBar = document.getElementById('batch-actions-bar');
const batchCountSpan = document.getElementById('batch-count');
const batchStatusSelect = document.getElementById('batch-status-select');
const btnBatchStatus = document.getElementById('btn-batch-status');
const btnBatchDelete = document.getElementById('btn-batch-delete');
const selectAllCheckbox = document.getElementById('select-all');

// Theme Elements
const btnThemeToggle = document.getElementById('btn-theme-toggle');

const userColors = {
    "Noumena": "bg-blue-100 text-blue-700",
    "Eric": "bg-purple-100 text-purple-700",
    "Mika": "bg-pink-100 text-pink-700"
};

let sortState = { column: null, direction: 'asc' };

const statusColors = {
    "En transit": "bg-amber-100 text-amber-700",
    "Livré": "bg-sky-100 text-sky-700",
    "Récupéré": "bg-emerald-100 text-emerald-700"
};

async function logEvent(action, shipmentId, details = {}) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const username = user?.user_metadata?.full_name || user?.email || 'Unknown';

        await supabaseClient.from('audit_logs').insert([{
            shipment_id: shipmentId,
            action: action,
            username: username,
            details: details
        }]);
    } catch (e) {
        console.error("Logging error:", e);
    }
}

function applyTheme() {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        btnThemeToggle.innerHTML = '<i class="fas fa-sun"></i> <span class="hidden sm:inline">Mode Clair</span>';
    } else {
        document.documentElement.classList.remove('dark');
        btnThemeToggle.innerHTML = '<i class="fas fa-moon"></i> <span class="hidden sm:inline">Mode Sombre</span>';
    }
    localStorage.setItem('theme', theme);
}

btnThemeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme();
});

async function init() {
    applyTheme();
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            loginOverlay.classList.add('hidden');
            loginOverlay.classList.remove('flex');
            appContent.classList.remove('hidden');
            await fetchShipments();
        } else {
            loginOverlay.classList.remove('hidden');
            loginOverlay.classList.add('flex');
            appContent.classList.add('hidden');
        }
    } catch (e) {
        console.error("Init error:", e);
    }
}

async function fetchShipments() {
    try {
        loadingSpinner.classList.remove('hidden');
        loadingSpinner.classList.add('flex');
        const { data, error } = await supabaseClient
            .from('shipments')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        shipments = data;
        render();
    } catch (err) {
        alert("Erreur de connexion : " + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
}

function updateBatchBar() {
    const count = selectedShipments.size;
    batchCountSpan.innerText = count;
    if (count > 0) {
        batchActionsBar.classList.remove('hidden');
        batchActionsBar.classList.add('flex');
    } else {
        batchActionsBar.classList.add('hidden');
        batchActionsBar.classList.remove('flex');
    }
}

window.toggleSelection = (id) => {
    if (selectedShipments.has(id)) {
        selectedShipments.delete(id);
    } else {
        selectedShipments.add(id);
    }
    updateBatchBar();
    render();
};

function render() {
    tableBody.innerHTML = "";
    const filterText = searchInput.value.toLowerCase();
    const filterUser = userFilter.value;
    const filterStatus = statusFilter.value;

    const filtered = shipments.filter(s => {
        const matchesText = (s.id && s.id.toLowerCase().includes(filterText)) ||
                            (s.article && s.article.toLowerCase().includes(filterText));
        const matchesUser = filterUser === "All" || s.username === filterUser;
        const matchesStatus = filterStatus === "All" || s.status === filterStatus;
        return matchesText && matchesUser && matchesStatus;
    });

    // Sync select-all checkbox
    if (filtered.length > 0) {
        selectAllCheckbox.checked = filtered.every(s => selectedShipments.has(s.id));
    } else {
        selectAllCheckbox.checked = false;
    }

    let totalFrais = 0, fraisLivres = 0, fraisRecupere = 0, fraisTransit = 0;

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center text-gray-400">
                        <i class="fas fa-box-open text-4xl mb-3"></i>
                        <p class="text-lg font-medium">Aucun article trouvé</p>
                        <p class="text-sm">Essayez de modifier vos filtres ou votre recherche.</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        if (sortState.column) {
            const col = sortState.column;
            const dir = sortState.direction === 'asc' ? 1 : -1;
            filtered.sort((a, b) => {
                let valA = a[col];
                let valB = b[col];
                if (col === 'frais') {
                    return ((parseInt(valA) || 0) - (parseInt(valB) || 0)) * dir;
                }
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
                return valA < valB ? -1 * dir : (valA > valB ? 1 * dir : 0);
            });
        }

        document.querySelectorAll('th[data-sort] .sort-arrow').forEach(el => el.innerText = '');
        if (sortState.column) {
            const activeTh = document.querySelector(`th[data-sort="${sortState.column}"] .sort-arrow`);
            if (activeTh) activeTh.innerText = sortState.direction === 'asc' ? '▲' : '▼';
        }

        filtered.forEach((s) => {
            const fraisVal = parseInt(s.frais) || 0;
            totalFrais += fraisVal;
            if (s.status === 'Livré') fraisLivres += fraisVal;
            else if (s.status === 'Récupéré') fraisRecupere += fraisVal;
            else fraisTransit += fraisVal;

            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition-colors";

            const userCol = userColors[s.username] || 'bg-gray-100 text-gray-700';
            const statusCol = statusColors[s.status] || 'bg-gray-100 text-gray-700';
            const isSelected = selectedShipments.has(s.id) ? 'checked' : '';

            row.innerHTML = `
                <td class="px-6 py-4 text-center">
                    <input type="checkbox" ${isSelected} onchange="toggleSelection('${s.id}')"
                           class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500">
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${userCol}">
                        ${s.username}
                    </span>
                </td>
                <td class="px-6 py-4 font-medium text-gray-900 font-mono-tag">${s.id}</td>
                <td class="px-6 py-4">${s.article}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <input type="number" value="${s.frais}"
                               onchange="updateFrais('${s.id}', this.value)"
                               class="w-24 px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium font-mono-tag">
                        <span class="text-xs text-gray-500">Ar</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusCol}">
                        ${s.status}
                    </span>
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                    <button onclick="toggleStatus('${s.id}')" class="text-amber-600 hover:text-amber-800 p-1" title="Changer Status">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button onclick="deleteShipment('${s.id}')" class="text-red-600 hover:text-red-900 p-1" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    statTotal.innerText = filtered.length;
    statDelivered.innerText = filtered.filter(s => s.status === "Livré").length;
    statTransit.innerText = filtered.filter(s => s.status === "En transit").length;
    statRecupere.innerText = filtered.filter(s => s.status === "Récupéré").length;
    statTotalFrais.innerText = totalFrais.toLocaleString() + " Ar";
    statFraisLivres.innerText = fraisLivres.toLocaleString() + " Ar";
    statFraisRecupere.innerText = fraisRecupere.toLocaleString() + " Ar";
    statFraisTransit.innerText = fraisTransit.toLocaleString() + " Ar";
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginError.classList.add('hidden');
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        loginOverlay.classList.add('hidden');
        loginOverlay.classList.remove('flex');
        appContent.classList.remove('hidden');
        await fetchShipments();
    } catch (err) {
        loginError.innerText = err.message;
        loginError.classList.remove('hidden');
    }
});

btnLogout.addEventListener('click', async () => {
    try {
        await supabaseClient.auth.signOut();
        loginOverlay.classList.remove('hidden');
        loginOverlay.classList.add('flex');
        appContent.classList.add('hidden');
        shipments = [];
        selectedShipments.clear();
        updateBatchBar();
        render();
    } catch (err) {
        alert("Erreur : " + err.message);
    }
});

window.toggleStatus = async (id) => {
    const shipment = shipments.find(s => s.id === id);
    const currentIndex = statusCycle.indexOf(shipment.status);
    const newStatus = statusCycle[(currentIndex + 1) % statusCycle.length] || statusCycle[0];
    try {
        loadingSpinner.classList.remove('hidden');
        loadingSpinner.classList.add('flex');
        const { error } = await supabaseClient.from('shipments').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        await logEvent('STATUS_CHANGE', id, { old: shipment.status, new: newStatus });
        await fetchShipments();
    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
};

window.deleteShipment = async (id) => {
    if (confirm("Supprimer cet article ?")) {
        try {
            loadingSpinner.classList.remove('hidden');
            loadingSpinner.classList.add('flex');
            const { error } = await supabaseClient.from('shipments').delete().eq('id', id);
            if (error) throw error;
            await logEvent('DELETE', id);
            selectedShipments.delete(id);
            updateBatchBar();
            await fetchShipments();
        } catch (err) {
            alert("Erreur : " + err.message);
        } finally {
            loadingSpinner.classList.add('hidden');
            loadingSpinner.classList.remove('flex');
        }
    }
};

window.updateFrais = async (id, value) => {
    const newValue = parseInt(value) || 0;
    if (newValue < 0) {
        alert("Les frais ne peuvent pas être négatifs.");
        render();
        return;
    }
    try {
        const { error } = await supabaseClient.from('shipments').update({ frais: newValue }).eq('id', id);
        if (error) throw error;
        await logEvent('FRAIS_CHANGE', id, { newValue });
        await fetchShipments();
    } catch (err) {
        alert("Erreur : " + err.message);
    }
};

function exportToCSV() {
    if (shipments.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }

    const headers = ["Utilisateur", "ID Tracking", "Article", "Frais Transit", "Status"];
    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const s of shipments) {
        const row = [
            `"${s.username}"`,
            `"${s.id}"`,
            `"${s.article}"`,
            s.frais,
            `"${s.status}"`
        ];
        csvRows.push(row.join(","));
    }

    const csvString = csvRows.join("\n");
    const csvBlob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `export_esoa_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

searchInput.addEventListener('input', render);
userFilter.addEventListener('change', render);
statusFilter.addEventListener('change', render);
btnExport.addEventListener('click', exportToCSV);

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        sortState.direction = (sortState.column === col && sortState.direction === 'asc') ? 'desc' : 'asc';
        sortState.column = col;
        render();
    });
});

btnAdd.addEventListener('click', () => {
    modalAdd.classList.remove('hidden');
    modalAdd.classList.add('flex');
});

btnCloseModal.addEventListener('click', () => {
    modalAdd.classList.add('hidden');
    modalAdd.classList.remove('flex');
});

addForm.addEventListener('submit', async (e) => {
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
        loadingSpinner.classList.remove('hidden');
        loadingSpinner.classList.add('flex');
        const { error } = await supabaseClient.from('shipments').insert([newShipment]);
        if (error) throw error;
        await logEvent('CREATE', newShipment.id, { article: newShipment.article });
        await fetchShipments();
        addForm.reset();
        modalAdd.classList.add('hidden');
        modalAdd.classList.remove('flex');
    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
});

// Batch Action Handlers
selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const filtered = shipments.filter(s => {
        const filterText = searchInput.value.toLowerCase();
        const filterUser = userFilter.value;
        const filterStatus = statusFilter.value;
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
    updateBatchBar();
    render();
});

btnBatchStatus.addEventListener('click', async () => {
    const newStatus = batchStatusSelect.value;
    if (!confirm(`Changer le statut de ${selectedShipments.size} article(s) vers "${newStatus}" ?`)) return;

    try {
        loadingSpinner.classList.remove('hidden');
        loadingSpinner.classList.add('flex');
        for (const id of selectedShipments) {
            await supabaseClient.from('shipments').update({ status: newStatus }).eq('id', id);
            await logEvent('STATUS_CHANGE', id, { newStatus });
        }
        selectedShipments.clear();
        updateBatchBar();
        await fetchShipments();
    } catch (err) {
        alert("Erreur lors de la mise à jour groupée : " + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
});

btnBatchDelete.addEventListener('click', async () => {
    if (!confirm(`Supprimer définitivement ${selectedShipments.size} article(s) ?`)) return;

    try {
        loadingSpinner.classList.remove('hidden');
        loadingSpinner.classList.add('flex');
        const idsToDelete = Array.from(selectedShipments);
        const { error } = await supabaseClient.from('shipments').delete().in('id', idsToDelete);
        if (error) throw error;
        for (const id of idsToDelete) {
            await logEvent('DELETE', id);
        }
        selectedShipments.clear();
        updateBatchBar();
        await fetchShipments();
    } catch (err) {
        alert("Erreur lors de la suppression groupée : " + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
});

init();
