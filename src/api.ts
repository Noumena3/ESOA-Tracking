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

export interface ShipmentFilters {
    search: string;
    username: string;
    status: string;
}

export interface ShipmentSummary {
    total: number;
    arrived: number;
    transit: number;
    collected: number;
    totalFees: number;
    arrivedFees: number;
    collectedFees: number;
    transitFees: number;
}

export interface ShipmentSort {
    column: string | null;
    direction: 'asc' | 'desc';
}

export const supabaseClient = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function applyShipmentFilters(query: any, filters: ShipmentFilters): any {
    const search = filters.search.trim();
    if (search) {
        const escaped = search
            .replace(/\\/g, '\\\\')
            .replace(/[%_]/g, character => `\\${character}`)
            .replace(/"/g, '\\"');
        const pattern = `"%${escaped}%"`;
        query = query.or(`id.ilike.${pattern},article.ilike.${pattern}`);
    }
    if (filters.username !== 'All') query = query.eq('username', filters.username);
    if (filters.status !== 'All') query = query.eq('status', filters.status);
    return query;
}

function normalizeShipmentStatuses(data: Shipment[]): Shipment[] {
    return data.map(shipment => ({
        ...shipment,
        status: shipment.status === 'Livré' ? 'Arrivé' : shipment.status,
    }));
}

export async function getShipments(
    filters: ShipmentFilters,
    page: number,
    pageSize: number,
    sort: ShipmentSort
): Promise<{ data: Shipment[]; count: number }> {
    let query = supabaseClient
        .from('shipments')
        .select('*', { count: 'exact' });
    query = applyShipmentFilters(query, filters);
    const sortableColumns = ['username', 'id', 'article', 'created_at', 'frais', 'status'];
    const column = sort.column && sortableColumns.includes(sort.column) ? sort.column : 'created_at';
    query = query
        .order(column, { ascending: sort.column ? sort.direction === 'asc' : false })
        .order('id', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: normalizeShipmentStatuses((data || []) as Shipment[]), count: count || 0 };
}

export async function getShipmentSummary(filters: ShipmentFilters): Promise<ShipmentSummary> {
    const { data, error } = await supabaseClient.rpc('get_shipment_summary', {
        p_search: filters.search.trim(),
        p_username: filters.username === 'All' ? null : filters.username,
        p_status: filters.status === 'All' ? null : filters.status,
    });
    if (error) throw error;
    const summary = data?.[0];
    return {
        total: Number(summary?.total_count || 0),
        arrived: Number(summary?.arrived_count || 0),
        transit: Number(summary?.transit_count || 0),
        collected: Number(summary?.collected_count || 0),
        totalFees: Number(summary?.total_frais || 0),
        arrivedFees: Number(summary?.arrived_frais || 0),
        collectedFees: Number(summary?.collected_frais || 0),
        transitFees: Number(summary?.transit_frais || 0),
    };
}

export async function getAllShipments(filters: ShipmentFilters): Promise<Shipment[]> {
    const pageSize = 1000;
    const allShipments: Shipment[] = [];
    let page = 1;
    while (true) {
        const result = await getShipments(filters, page, pageSize, { column: 'created_at', direction: 'desc' });
        allShipments.push(...result.data);
        if (result.data.length < pageSize) return allShipments;
        page += 1;
    }
}

export async function shipmentExists(id: string): Promise<boolean> {
    const { data, error } = await supabaseClient
        .from('shipments')
        .select('id')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return Boolean(data);
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

export async function logEvent(action: string, shipmentId: string, details: any = {}): Promise<boolean> {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const username = user?.user_metadata?.full_name || user?.email || 'Unknown';

        const { error } = await supabaseClient.from('audit_logs').insert([{
            shipment_id: shipmentId,
            action: action,
            username: username,
            details: details
        }]);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Logging error:", e);
        return false;
    }
}

