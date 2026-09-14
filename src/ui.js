export const elements = {
    tableBody: document.getElementById('tracking-table-body'),
    searchInput: document.getElementById('search-input'),
    userFilter: document.getElementById('user-filter'),
    statusFilter: document.getElementById('status-filter'),
    btnAdd: document.getElementById('btn-add'),
    btnExport: document.getElementById('btn-export'),
    modalAdd: document.getElementById('modal-add'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    addForm: document.getElementById('add-form'),
    loadingSpinner: document.getElementById('loading-spinner'),
    statTotal: document.getElementById('stat-total'),
    statDelivered: document.getElementById('stat-delivered'),
    statTransit: document.getElementById('stat-transit'),
    statRecupere: document.getElementById('stat-recupere'),
    statTotalFrais: document.getElementById('stat-total-frais'),
    statFraisLivres: document.getElementById('stat-frais-livres'),
    statFraisRecupere: document.getElementById('stat-frais-recupere'),
    statFraisTransit: document.getElementById('stat-frais-transit'),
    loginOverlay: document.getElementById('login-overlay'),
    appContent: document.getElementById('app-content'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    btnLogout: document.getElementById('btn-logout'),
    batchActionsBar: document.getElementById('batch-actions-bar'),
    batchCountSpan: document.getElementById('batch-count'),
    batchStatusSelect: document.getElementById('batch-status-select'),
    btnBatchStatus: document.getElementById('btn-batch-status'),
    btnBatchDelete: document.getElementById('btn-batch-delete'),
    selectAllCheckbox: document.getElementById('select-all'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
};

const userColors = {
    "Noumena": "bg-blue-100 text-blue-700",
    "Eric": "bg-purple-100 text-purple-700",
    "Mika": "bg-pink-100 text-pink-700"
};

const statusColors = {
    "En transit": "bg-amber-100 text-amber-700",
    "Livré": "bg-sky-100 text-sky-700",
    "Récupéré": "bg-emerald-100 text-emerald-700"
};

export function updateLoading(isLoading) {
    if (isLoading) {
        elements.loadingSpinner.classList.remove('hidden');
        elements.loadingSpinner.classList.add('flex');
    } else {
        elements.loadingSpinner.classList.add('hidden');
        elements.loadingSpinner.classList.remove('flex');
    }
}

export function updateBatchBar(count) {
    elements.batchCountSpan.innerText = count;
    if (count > 0) {
        elements.batchActionsBar.classList.remove('hidden');
        elements.batchActionsBar.classList.add('flex');
    } else {
        elements.batchActionsBar.classList.add('hidden');
        elements.batchActionsBar.classList.remove('flex');
    }
}

export function applyTheme() {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        elements.btnThemeToggle.innerHTML = '<i class="fas fa-sun"></i> <span class="hidden sm:inline">Mode Clair</span>';
    } else {
        document.documentElement.classList.remove('dark');
        elements.btnThemeToggle.innerHTML = '<i class="fas fa-moon"></i> <span class="hidden sm:inline">Mode Sombre</span>';
    }
    localStorage.setItem('theme', theme);
}

export function render(shipments, selectedShipments, sortState, onToggleSelection, onToggleStatus, onDeleteShipment, onUpdateFrais) {
    const { tableBody, searchInput, userFilter, statusFilter, selectAllCheckbox } = elements;
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
            </tr>`;
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
                    <input type="checkbox" ${isSelected} class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 checkbox-selection" data-id="${s.id}">
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${userCol}">${s.username}</span>
                </td>
                <td class="px-6 py-4 font-medium text-gray-900 font-mono-tag">${s.id}</td>
                <td class="px-6 py-4">${s.article}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <input type="number" value="${s.frais}" class="w-24 px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium font-mono-tag frais-input" data-id="${s.id}">
                        <span class="text-xs text-gray-500">Ar</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusCol}">${s.status}</span>
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                    <button class="text-amber-600 hover:text-amber-800 p-1 btn-toggle-status" data-id="${s.id}" title="Changer Status">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900 p-1 btn-delete-shipment" data-id="${s.id}" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Attach event listeners to the newly created elements
        tableBody.querySelectorAll('.checkbox-selection').forEach(cb => {
            cb.addEventListener('change', () => onToggleSelection(cb.dataset.id));
        });
        tableBody.querySelectorAll('.frais-input').forEach(input => {
            input.addEventListener('change', (e) => onUpdateFrais(input.dataset.id, e.target.value));
        });
        tableBody.querySelectorAll('.btn-toggle-status').forEach(btn => {
            btn.addEventListener('click', () => onToggleStatus(btn.dataset.id));
        });
        tableBody.querySelectorAll('.btn-delete-shipment').forEach(btn => {
            btn.addEventListener('click', () => onDeleteShipment(btn.dataset.id));
        });
    }

    elements.statTotal.innerText = filtered.length;
    elements.statDelivered.innerText = filtered.filter(s => s.status === "Livré").length;
    elements.statTransit.innerText = filtered.filter(s => s.status === "En transit").length;
    elements.statRecupere.innerText = filtered.filter(s => s.status === "Récupéré").length;
    elements.statTotalFrais.innerText = totalFrais.toLocaleString() + " Ar";
    elements.statFraisLivres.innerText = fraisLivres.toLocaleString() + " Ar";
    elements.statFraisRecupere.innerText = fraisRecupere.toLocaleString() + " Ar";
    elements.statFraisTransit.innerText = fraisTransit.toLocaleString() + " Ar";
}

export function exportToCSV(shipments) {
    if (shipments.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }
    const headers = ["Utilisateur", "ID Tracking", "Article", "Frais Transit", "Status"];
    const csvRows = [headers.join(",")];
    for (const s of shipments) {
        csvRows.push([`"${s.username}"`, `"${s.id}"`, `"${s.article}"`, s.frais, `"${s.status}"`].join(","));
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
