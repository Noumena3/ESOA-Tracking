// CONFIGURATION SUPABASE
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// On définit l'interface Shipment pour tout le projet
export interface Shipment {
    id: string;
    username: string;
    article: string;
    frais: number;
    status: string;
    created_at?: string;
}

export const supabaseClient = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getShipments(): Promise<Shipment[]> {
    const { data, error } = await supabaseClient
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Shipment[];
}

export async function updateShipment(id: string, updates: Partial<Shipment>): Promise<boolean> {
    const { error } = await supabaseClient.from('shipments').update(updates).eq('id', id);
    if (error) throw error;
    return true;
}

export async function deleteShipment(id: string): Promise<boolean> {
    const { error } = await supabaseClient.from('shipments').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export async function insertShipment(shipment: Omit<Shipment, 'created_at'>): Promise<boolean> {
    const { error } = await supabaseClient.from('shipments').insert([shipment]);
    if (error) throw error;
    return true;
}

export async function deleteMultipleShipments(ids: string[]): Promise<boolean> {
    const { error } = await supabaseClient.from('shipments').delete().in('id', ids);
    if (error) throw error;
    return true;
}

export async function logEvent(action: string, shipmentId: string, details: any = {}): Promise<void> {
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
