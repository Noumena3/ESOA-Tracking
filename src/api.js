// CONFIGURATION SUPABASE
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getShipments() {
    const { data, error } = await supabaseClient
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function updateShipment(id, updates) {
    const { error } = await supabaseClient.from('shipments').update(updates).eq('id', id);
    if (error) throw error;
    return true;
}

export async function deleteShipment(id) {
    const { error } = await supabaseClient.from('shipments').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export async function insertShipment(shipment) {
    const { error } = await supabaseClient.from('shipments').insert([shipment]);
    if (error) throw error;
    return true;
}

export async function deleteMultipleShipments(ids) {
    const { error } = await supabaseClient.from('shipments').delete().in('id', ids);
    if (error) throw error;
    return true;
}

export async function logEvent(action, shipmentId, details = {}) {
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
