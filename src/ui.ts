import { Shipment, ShipmentSummary } from './api.ts';
import { escapeHtml } from './domain.ts';

export const elements = {
    tableBody: document.getElementById('tracking-table-body') as HTMLElement,
    paginationInfo: document.getElementById('pagination-info') as HTMLElement,
    pageSize: document.getElementById('page-size') as HTMLSelectElement,
    btnPagePrev: document.getElementById('btn-page-prev') as HTMLButtonElement,
    btnPageNext: document.getElementById('btn-page-next') as HTMLButtonElement,
    searchInput: document.getElementById('search-input') as HTMLInputElement,
    userFilter: document.getElementById('user-filter') as HTMLSelectElement,
    statusFilter: document.getElementById('status-filter') as HTMLSelectElement,
    btnAdd: document.getElementById('btn-add') as HTMLButtonElement,
    btnExport: document.getElementById('btn-export') as HTMLButtonElement,
    modalAdd: document.getElementById('modal-add') as HTMLElement,
    btnCloseModal: document.getElementById('btn-close-modal') as HTMLButtonElement,
    modalHistory: document.getElementById('modal-history') as HTMLElement,
    historyTitle: document.getElementById('history-title') as HTMLElement,
    historySubtitle: document.getElementById('history-subtitle') as HTMLElement,
    historyList: document.getElementById('history-list') as HTMLElement,
    btnCloseHistory: document.getElementById('btn-close-history') as HTMLButtonElement,
    addForm: document.getElementById('add-form') as HTMLFormElement,
    loadingSpinner: document.getElementById('loading-spinner') as HTMLElement,
    statTotal: document.getElementById('stat-total') as HTMLElement,
    statArrived: document.getElementById('stat-arrived') as HTMLElement,
    statTransit: document.getElementById('stat-transit') as HTMLElement,
    statRecupere: document.getElementById('stat-recupere') as HTMLElement,
    statTotalFrais: document.getElementById('stat-total-frais') as HTMLElement,
    statFraisLivres: document.getElementById('stat-frais-livres') as HTMLElement,
    statFraisRecupere: document.getElementById('stat-frais-recupere') as HTMLElement,
    statFraisTransit: document.getElementById('stat-frais-transit') as HTMLElement,
    loginOverlay: document.getElementById('login-overlay') as HTMLElement,
    appContent: document.getElementById('app-content') as HTMLElement,
    loginForm: document.getElementById('login-form') as HTMLFormElement,
    loginError: document.getElementById('login-error') as HTMLElement,
    btnLogout: document.getElementById('btn-logout') as HTMLButtonElement,
    batchActionsBar: document.getElementById('batch-actions-bar') as HTMLElement,
    batchCountSpan: document.getElementById('batch-count') as HTMLElement,
    batchStatusSelect: document.getElementById('batch-status-select') as HTMLSelectElement,
    btnBatchStatus: document.getElementById('btn-batch-status') as HTMLButtonElement,
    btnBatchDelete: document.getElementById('btn-batch-delete') as HTMLButtonElement,
    selectAllCheckbox: document.getElementById('select-all') as HTMLInputElement,
    btnThemeToggle: document.getElementById('btn-theme-toggle') as HTMLButtonElement,
};

const userColors: Record<string, string> = {
    "Noumena": "bg-blue-100 text-blue-700",
    "Eric": "bg-purple-100 text-purple-700",
    "Mika": "bg-pink-100 text-pink-700"
};

const statusColors: Record<string, string> = {
    "En transit": "bg-amber-100 text-amber-700",
    "Arrivé": "bg-sky-100 text-sky-700",
    "Récupéré": "bg-emerald-100 text-emerald-700"
};

export function updateLoading(isLoading: boolean): void {
    if (isLoading) {
        elements.loadingSpinner.classList.remove('hidden');
        elements.loadingSpinner.classList.add('flex');
    } else {
        elements.loadingSpinner.classList.add('hidden');
        elements.loadingSpinner.classList.remove('flex');
    }
}

export function updateBatchBar(count: number): void {
    elements.batchCountSpan.innerText = count.toString();
    if (count > 0) {
        elements.batchActionsBar.classList.remove('hidden');
        elements.batchActionsBar.classList.add('flex');
    } else {
        elements.batchActionsBar.classList.add('hidden');
        elements.batchActionsBar.classList.remove('flex');
    }
}

export function applyTheme(): void {
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

export function render(
    shipments: Shipment[],
    summary: ShipmentSummary,
    selectedShipments: Set<string>,
    page: number,
    pageSize: number,
    totalCount: number,
    sortState: { column: string | null, direction: 'asc' | 'desc' },
    onToggleSelection: (id: string) => void,
    onChangeStatus: (id: string, status: string) => void,
    onDeleteShipment: (id: string) => void,
    onUpdateFrais: (id: string, value: string) => void,
    onViewHistory: (shipment: Shipment) => void
): void {
    const { tableBody, selectAllCheckbox } = elements;
    tableBody.innerHTML = "";
    selectAllCheckbox.checked = shipments.length > 0 && shipments.every(s => selectedShipments.has(s.id));
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const firstItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const lastItem = Math.min(page * pageSize, totalCount);
    elements.paginationInfo.innerText = totalCount === 0
        ? 'Aucun article'
        : `Affichage ${firstItem}–${lastItem} sur ${totalCount} article(s) · page ${page}/${pageCount}`;
    elements.btnPagePrev.disabled = page <= 1;
    elements.btnPageNext.disabled = page >= pageCount;

    if (shipments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center text-gray-400">
                        <i class="fas fa-box-open text-4xl mb-3"></i>
                        <p class="text-lg font-medium">Aucun article trouvé</p>
                        <p class="text-sm">Essayez de modifier vos filtres ou votre recherche.</p>
                    </div>
                </td>
            </tr>`;
    } else {
        document.querySelectorAll('th[data-sort] .sort-arrow').forEach(el => {
            (el as HTMLElement).innerText = '';
        });
        if (sortState.column) {
            const activeTh = document.querySelector(`th[data-sort="${sortState.column}"] .sort-arrow`);
            if (activeTh) (activeTh as HTMLElement).innerText = sortState.direction === 'asc' ? '▲' : '▼';
        }

        shipments.forEach((s) => {
            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition-colors";
            const userCol = userColors[s.username] || 'bg-gray-100 text-gray-700';
            const statusCol = statusColors[s.status] || 'bg-gray-100 text-gray-700';
            const isSelected = selectedShipments.has(s.id) ? 'checked' : '';

            row.innerHTML = `
                <td class="px-6 py-4 text-center">
                    <input type="checkbox" ${isSelected} class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 checkbox-selection" data-id="${escapeHtml(s.id)}">
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${userCol}">${escapeHtml(s.username)}</span>
                </td>
                <td class="px-6 py-4 font-medium text-gray-900 font-mono-tag">${escapeHtml(s.id)}</td>
                <td class="px-6 py-4">${escapeHtml(s.article)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(s.created_at ? new Date(s.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—')}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <input type="number" value="${escapeHtml(s.frais)}" class="w-24 px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-amber-500 outline-none text-base font-semibold font-mono-tag frais-input" data-id="${escapeHtml(s.id)}">
                        <span class="text-sm text-gray-500">Ar</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <select class="px-2 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-amber-500 ${statusCol} status-select" data-id="${escapeHtml(s.id)}" aria-label="Statut de l’expédition ${escapeHtml(s.id)}">
                        <option value="En transit" ${s.status === 'En transit' ? 'selected' : ''}>En transit</option>
                        <option value="Arrivé" ${s.status === 'Arrivé' ? 'selected' : ''}>Arrivé</option>
                        <option value="Récupéré" ${s.status === 'Récupéré' ? 'selected' : ''}>Récupéré</option>
                    </select>
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                    <button class="text-sky-600 hover:text-sky-800 p-1 btn-history-shipment" data-id="${escapeHtml(s.id)}" title="Voir l’historique" aria-label="Voir l’historique de ${escapeHtml(s.id)}">
                        <i class="fas fa-clock" aria-hidden="true"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900 p-1 btn-delete-shipment" data-id="${escapeHtml(s.id)}" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        tableBody.querySelectorAll('.checkbox-selection').forEach(cb => {
            (cb as HTMLInputElement).addEventListener('change', () => onToggleSelection((cb as HTMLInputElement).dataset.id));
        });
        tableBody.querySelectorAll('.frais-input').forEach(input => {
            (input as HTMLInputElement).addEventListener('change', (e) => onUpdateFrais((input as HTMLInputElement).dataset.id, (e.target as HTMLInputElement).value));
        });
        tableBody.querySelectorAll('.status-select').forEach(select => {
            (select as HTMLSelectElement).addEventListener('change', (event) => {
                const target = event.currentTarget as HTMLSelectElement;
                onChangeStatus(target.dataset.id!, target.value);
            });
        });
        tableBody.querySelectorAll('.btn-delete-shipment').forEach(btn => {
            (btn as HTMLElement).addEventListener('click', () => onDeleteShipment((btn as HTMLElement).dataset.id));
        });
        tableBody.querySelectorAll('.btn-history-shipment').forEach(btn => {
            (btn as HTMLElement).addEventListener('click', () => {
                const shipment = shipments.find(item => item.id === (btn as HTMLElement).dataset.id);
                if (shipment) onViewHistory(shipment);
            });
        });
    }

    elements.statTotal.innerText = summary.total.toLocaleString();
    elements.statArrived.innerText = summary.arrived.toLocaleString();
    elements.statTransit.innerText = summary.transit.toLocaleString();
    elements.statRecupere.innerText = summary.collected.toLocaleString();
    elements.statTotalFrais.innerText = summary.totalFees.toLocaleString() + " Ar";
    elements.statFraisLivres.innerText = summary.arrivedFees.toLocaleString() + " Ar";
    elements.statFraisRecupere.innerText = summary.collectedFees.toLocaleString() + " Ar";
    elements.statFraisTransit.innerText = summary.transitFees.toLocaleString() + " Ar";
}

export function renderShipmentHistory(shipment: Shipment, entries: import('./api.ts').AuditLogEntry[]): void {
    elements.historyTitle.textContent = shipment.article;
    elements.historySubtitle.textContent = `Article · Référence ${shipment.id}`;
    elements.historyList.replaceChildren();

    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'rounded-xl border border-dashed border-gray-300 dark:border-slate-600 py-10 text-center text-sm text-gray-500 dark:text-gray-400';
        empty.textContent = 'Aucune modification enregistrée pour cet article.';
        elements.historyList.appendChild(empty);
        return;
    }

    for (const entry of entries) {
        const card = document.createElement('article');
        card.className = 'relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70';

        const heading = document.createElement('div');
        heading.className = 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2';
        const action = document.createElement('strong');
        const actionNames: Record<string, string> = { CREATE: 'Article ajouté', STATUS_CHANGE: 'Statut modifié', DELETE: 'Article supprimé', FRAIS_CHANGE: 'Frais modifiés', ARTICLE_CHANGE: 'Article modifié' };
        action.className = 'inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white';
        const actionIcon = document.createElement('i');
        actionIcon.className = `fas ${entry.action === 'CREATE' ? 'fa-circle-plus text-emerald-500' : entry.action === 'DELETE' ? 'fa-trash text-red-500' : entry.action === 'STATUS_CHANGE' ? 'fa-arrows-rotate text-blue-500' : 'fa-pen-to-square text-amber-500'}`;
        actionIcon.setAttribute('aria-hidden', 'true');
        action.append(actionIcon, document.createTextNode(actionNames[entry.action] || entry.action.replaceAll('_', ' ')));
        const date = document.createElement('time');
        date.className = 'text-xs text-gray-500 dark:text-gray-400';
        date.dateTime = entry.created_at;
        date.textContent = new Date(entry.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
        heading.append(action, date);

        const actor = document.createElement('p');
        actor.className = 'mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400';
        const actorIcon = document.createElement('i');
        actorIcon.className = 'fas fa-user-circle';
        actorIcon.setAttribute('aria-hidden', 'true');
        actor.append(actorIcon, document.createTextNode(entry.username));
        card.append(heading, actor);

        if (entry.details && Object.keys(entry.details).length > 0) {
            const details = document.createElement('div');
            details.className = 'mt-3 grid gap-2 border-t border-gray-100 pt-3 dark:border-slate-700';
            const labels: Record<string, string> = { article: 'Article', old: 'Ancienne valeur', new: 'Nouvelle valeur', oldValue: 'Anciens frais', newValue: 'Nouveaux frais', status: 'Statut au moment de la suppression' };
            for (const [key, value] of Object.entries(entry.details)) {
                const row = document.createElement('div');
                row.className = 'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm';
                const label = document.createElement('span');
                label.className = 'text-gray-500 dark:text-gray-400';
                label.textContent = labels[key] || key.replaceAll('_', ' ');
                const valueText = document.createElement('span');
                valueText.className = 'font-medium text-gray-800 dark:text-gray-100';
                const statusNames: Record<string, string> = { 'En transit': 'En transit', 'Arrivé': 'Arrivé', 'Récupéré': 'Récupéré' };
                valueText.textContent = key === 'newValue' && typeof value === 'number' ? `${value.toLocaleString('fr-FR')} Ar` : statusNames[String(value)] || String(value);
                row.append(label, valueText);
                details.appendChild(row);
            }
            card.appendChild(details);
        }
        elements.historyList.appendChild(card);
    }
}

export function exportToCSV(shipments: Shipment[]): void {
    if (shipments.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }
    const headers = ["Utilisateur", "ID Tracking", "Article", "Ajouté le", "Frais Transit", "Status"];
    const csvRows = [headers.join(",")];
    for (const s of shipments) {
        const createdAt = s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : '';
        csvRows.push([`"${s.username}"`, `"${s.id}"`, `"${s.article}"`, `"${createdAt}"`, s.frais, `"${s.status}"`].join(","));
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
