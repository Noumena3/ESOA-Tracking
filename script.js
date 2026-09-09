const INITIAL_DATA = [
    { username: "Noumena", id: "9818990822658", article: "Inconnu", frais: 3290, status: "En transit" },
    { username: "Noumena", id: "YT8896131647185", article: "Inconnu", frais: 5264, status: "En transit" },
    { username: "Noumena", id: "JT5519312447454", article: "Inconnu", frais: 3290, status: "En transit" },
    { username: "Noumena", id: "777441840988035", article: "T-shirt", frais: 5264, status: "Livré" },
    { username: "Eric", id: "JT3175490504787", article: "Manette", frais: 0, status: "En transit" },
    { username: "Eric", id: "435334295550988", article: "chargeur", frais: 23030, status: "En transit" },
    { username: "Eric", id: "JT3175517602922", article: "Montre", frais: 9870, status: "En transit" },
    { username: "Eric", id: "79029277524913", article: "hair band", frais: 32900, status: "En transit" },
    { username: "Eric", id: "79029548063488", article: "casquette", frais: 19740, status: "En transit" },
    { username: "Eric", id: "79029841206427", article: "Boucle d'oreille léopard", frais: 6580, status: "En transit" },
    { username: "Eric", id: "79029686388457", article: "Boucle d'oreille", frais: 7238, status: "En transit" },
    { username: "Eric", id: "KK300137307563", article: "Blender", frais: 0, status: "En transit" },
    { username: "Eric", id: "435340312208319", article: "Bonnet enfant", frais: 42770, status: "En transit" },
    { username: "Eric", id: "79030316729582", article: "Porte clé", frais: 8554, status: "En transit" },
    { username: "Eric", id: "79030276170264", article: "Collier inoxydable", frais: 5264, status: "En transit" },
    { username: "Eric", id: "YT7642091117821", article: "Satroka", frais: 11186, status: "En transit" },
    { username: "Mika", id: "9823103539132", article: "Housse Noire", frais: 13160, status: "En transit" },
    { username: "Mika", id: "773439723202052", article: "Housse blanche", frais: 6580, status: "En transit" },
];

// --- CONFIGURATION SUPABASE (Étape 2) ---
const SUPABASE_URL = 'https://sqzsssdovoekogxnwesx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxenNzc2Rvdm9la29neG53ZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjY2NjAsImV4cCI6MjEwNDM0MjY2MH0.DdGmVY1siGXXtfDXI4bUizxHOsa9H6kMeU1T3DQH8l8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ---------------------------------------

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
const statTotalFrais = document.getElementById('stat-total-frais');
const statFraisLivres = document.getElementById('stat-frais-livres');
const statFraisTransit = document.getElementById('stat-frais-transit');

const userColors = {
    "Noumena": "bg-blue-100 text-blue-700",
    "Eric": "bg-purple-100 text-purple-700",
    "Mika": "bg-pink-100 text-pink-700"
};

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
        // On ne met pas d'alert ici pour éviter d'interrompre l'expérience utilisateur
        // si c'est juste un problème temporaire.
    }
}

async function init() {
    // Tentative de récupération Cloud
    await fetchShipments();

    // Si le Cloud est vide ou échoue, on regarde le local
    if (!shipments || shipments.length === 0) {
        console.log("Utilisation du stockage local / données initiales");
        const savedData = localStorage.getItem('esoa_shipments_local');
        if (savedData) {
            shipments = JSON.parse(savedData);
        } else {
            shipments = [...INITIAL_DATA];
        }
        render();
    }
}

function saveToLocalStorage() {
    localStorage.setItem('esoa_shipments_local', JSON.stringify(shipments));
}

function render() {
    tableBody.innerHTML = "";
    const filterText = searchInput.value;
    const filterUser = userFilter.value;

    const filtered = shipments.filter(s => {
        const matchesText = s.id.toLowerCase().includes(filterText.toLowerCase()) ||
                            s.article.toLowerCase().includes(filterText.toLowerCase());
        const matchesUser = filterUser === "All" || s.username === filterUser;
        return matchesText && matchesUser;
    });

    let totalFrais = 0;
    let fraisLivres = 0;
    let fraisTransit = 0;

    filtered.forEach((s) => {
        totalFrais += s.frais;
        if (s.status === 'Livré') {
            fraisLivres += s.frais;
        } else {
            fraisTransit += s.frais;
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
                <span class="px-2 py-1 rounded-full text-xs font-medium ${s.status === 'Livré' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
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
    statTransit.innerText = filtered.filter(s => s.status !== "Livré").length;
    statTotalFrais.innerText = totalFrais.toLocaleString() + " Ar";
    statFraisLivres.innerText = fraisLivres.toLocaleString() + " Ar";
    statFraisTransit.innerText = fraisTransit.toLocaleString() + " Ar";
}

// Actions
window.toggleStatus = async (id) => {
    const shipment = shipments.find(s => s.id === id);
    const newStatus = shipment.status === "Livré" ? "En transit" : "Livré";

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

// Export/Import Functions
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

            // Remappage des données pour utiliser 'username' au lieu de 'user'
            const remappedData = imported.map(item => {
                const { user, ...rest } = item;
                return { username: user || item.username, ...rest };
            });

            const choice = confirm("Voulez-vous REMPLACER toutes vos données Cloud ?\n(Cliquez sur 'Annuler' pour fusionner avec vos données existantes)");

            if (choice) {
                // Clear existing data first
                const { error: delError } = await supabaseClient.from('shipments').delete().neq('id', '0');
                if (delError) throw delError;

                const { error: insError } = await supabaseClient.from('shipments').insert(remappedData);
                if (insError) throw insError;
            } else {
                // Upsert (merge) - updates existing, inserts new
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
