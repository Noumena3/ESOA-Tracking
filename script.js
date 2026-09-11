// CONFIGURATION SUPABASE
const SUPABASE_URL = 'https://sqzsssdovoekogxnwesx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxenNzc2Rvdm9la29neG53ZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjY2NjAsImV4cCI6MjEwNDM0MjY2MH0.DdGmVY1siGXXtfDXI4bUizxHOsa9H6kMeU1T3DQH8l8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let shipments = [];

// Elements
const tableBody = document.getElementById('tracking-table-body');
const searchInput = document.getElementById('search-input');
const userFilter = document.getElementById('user-filter');
const btnAdd = document.getElementById('btn-add');
const btnExport = document.getElementById('btn-export');
const importFile = document.getElementById('import-file');
const modalAdd = document.getElementById('modal-add');
const btnCloseModal = document.getElementById('btn-close-modal');
const addForm = document.getElementById('add-form');

const statTotal = document.getElementById('stat-total');
const statDelivered = document.getElementById('stat-delivered');
const statTransit = document.getElementById('stat-transit');
const statRecupere = document.getElementById('stat-recupere');
const statTotalFrais = document.getElementById('stat-total-frais');
const statFraisLivres = document.getElementById('stat-frais-livres');
const statFraisRecupere = document.getElementById('stat-frais-recupere');
const statFraisTransit = document.getElementById('stat-frais-transit');

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

const userColors = {
    "Noumena": "bg-blue-100 text-blue-700",
    "Eric": "bg-purple-100 text-purple-700",
    "Mika": "bg-pink-100 text-pink-700"
};

const statusColors = {
    "En transit": "bg-amber-100 text-amber-700",
    "Livré": "bg-blue-100 text-blue-700",
    "Récupéré": "bg-green-100 text-green-700"
};

// Ordre du cycle quand on clique sur le bouton "Changer Status"
const statusCycle = ["En transit", "Livré", "Récupéré"];

// Initialize app
async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        console.log("Session active, chargement des données...");
        loginOverlay.classList.add('hidden');
        loginOverlay.classList.remove('flex');
        await fetchShipments();
    } else {
        console.log("Aucune session, affichage du login");
        loginOverlay.classList.remove('hidden');
        loginOverlay.classList.add('flex');
    }
}

async function fetchShipments() {
    try {
        const { data, error } = await supabaseClient
            .from('shipments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        shipments = data;
        render();
    } catch (err) {
        console.error("Erreur lors de la récupération :", err);
        alert("Erreur de connexion à la base de données : " + err.message);
    }
}

function render() {
    tableBody.innerHTML = "";
    const filterText = searchInput.value;
    const filterUser = userFilter.value;

    const filtered = shipments.filter(s => {
        const matchesText = (s.id && s.id.toLowerCase().includes(filterText.toLowerCase())) ||
                            (s.article && s.article.toLowerCase().includes(filterText.toLowerCase()));
        const matchesUser = filterUser === "All" || s.username === filterUser;
        return matchesText && matchesUser;
    });

    let totalFrais = 0;
    let fraisLivres = 0;
    let fraisRecupere = 0;
    let fraisTransit = 0;

    filtered.forEach((s) => {
        const fraisVal = parseInt(s.frais) || 0;
        totalFrais += fraisVal;
        if (s.status === 'Livré') {
            fraisLivres += fraisVal;
        } else if (s.status === 'Récupéré') {
            fraisRecupere += fraisVal;
        } else {
            fraisTransit += fraisVal;
        }

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 transition-colors";
        row.innerHTML = `
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${userColors[s.username] || 'bg-gray-100 text-gray-700'}">
                    ${s.username}
                </span>
            </td>
            <td class="px-6 py-4 font-medium text-gray-900">${s.id}</td>
            <td class="px-6 py-4">${s.article}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <input type="number" value="${s.frais}"
                           onchange="updateFrais('${s.id}', this.value)"
                           class="w-24 px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium">
                    <span class="text-xs text-gray-500">Ar</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[s.status] || 'bg-gray-100 text-gray-700'}">
                    ${s.status}
                </span>
            </td>
            <td class="px-6 py-4 text-right space-x-2">
                <button onclick="toggleStatus('${s.id}')" class="text-indigo-600 hover:text-indigo-900 p-1" title="Changer Status">
                    <i class="fas fa-sync-alt"></i>
                </button>
                <button onclick="deleteShipment('${s.id}')" class="text-red-600 hover:text-red-900 p-1" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    statTotal.innerText = filtered.length;
    statDelivered.innerText = filtered.filter(s => s.status === "Livré").length;
    statTransit.innerText = filtered.filter(s => s.status === "En transit").length;
    statRecupere.innerText = filtered.filter(s => s.status === "Récupéré").length;
    statTotalFrais.innerText = totalFrais.toLocaleString() + " Ar";
    statFraisLivres.innerText = fraisLivres.toLocaleString() + " Ar";
    statFraisRecupere.innerText = fraisRecupere.toLocaleString() + " Ar";
    statFraisTransit.innerText = fraisTransit.toLocaleString() + " Ar";
}

// --- Auth Actions ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginError.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        loginOverlay.classList.add('hidden');
        loginOverlay.classList.remove('flex');
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
        shipments = [];
        render();
    } catch (err) {
        alert("Erreur lors de la déconnexion : " + err.message);
    }
});

// --- Data Actions ---
window.toggleStatus = async (id) => {
    const shipment = shipments.find(s => s.id === id);
    const currentIndex = statusCycle.indexOf(shipment.status);
    // Si le status actuel n'est pas reconnu (ancienne donnée), on repart de "En transit"
    const newStatus = statusCycle[(currentIndex + 1) % statusCycle.length] || statusCycle[0];

    try {
        const { error } = await supabaseClient
            .from('shipments')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;
        await fetchShipments();
    } catch (err) {
        alert("Erreur lors de la mise à jour du statut : " + err.message);
    }
};

window.deleteShipment = async (id) => {
    if (confirm("Voulez-vous vraiment supprimer cet article ?")) {
        try {
            const { error } = await supabaseClient
                .from('shipments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchShipments();
        } catch (err) {
            alert("Erreur lors de la suppression : " + err.message);
        }
    }
};

window.updateFrais = async (id, value) => {
    const newValue = parseInt(value) || 0;
    try {
        const { error } = await supabaseClient
            .from('shipments')
            .update({ frais: newValue })
            .eq('id', id);

        if (error) throw error;
        await fetchShipments();
    } catch (err) {
        alert("Erreur lors de la mise à jour des frais : " + err.message);
    }
};

// Export/Import
function exportData() {
    const dataStr = JSON.stringify(shipments, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esoa_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error("Le fichier doit être une liste d'articles.");

            // Remapping 'user' -> 'username' for Supabase compatibility
            const remappedData = imported.map(item => {
                const { user, ...rest } = item;
                return { username: user || item.username, ...rest };
            });

            const choice = confirm("Voulez-vous REMPLACER toutes vos données Cloud ?\n(Cliquez sur 'Annuler' pour fusionner avec vos données existantes)");

            if (choice) {
                const { error: delError } = await supabaseClient.from('shipments').delete().neq('id', '0');
                if (delError) throw delError;
                const { error: insError } = await supabaseClient.from('shipments').insert(remappedData);
                if (insError) throw insError;
            } else {
                const { error } = await supabaseClient.from('shipments').upsert(remappedData);
                if (error) throw error;
            }

            await fetchShipments();
            alert("Données importées avec succès dans le Cloud !");
        } catch (err) {
            alert("Erreur lors de l'importation : " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

// Event Listeners
searchInput.addEventListener('input', render);
userFilter.addEventListener('change', render);
btnExport.addEventListener('click', exportData);
importFile.addEventListener('change', importData);

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
    const newShipment = {
        username: document.getElementById('form-user').value,
        id: document.getElementById('form-id').value,
        article: document.getElementById('form-article').value,
        frais: parseInt(document.getElementById('form-frais').value) || 0,
        status: document.getElementById('form-status').value,
    };

    try {
        const { error } = await supabaseClient
            .from('shipments')
            .insert([newShipment]);

        if (error) throw error;
        await fetchShipments();

        addForm.reset();
        modalAdd.classList.add('hidden');
        modalAdd.classList.remove('flex');
    } catch (err) {
        alert("Erreur lors de l'ajout : " + err.message);
    }
});

init();
