import { normalizeShipmentStatus, postgrestIlikePattern } from './domain.ts';

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
    owner_id?: string;
    transit_since?: string | null;
}

export interface UserProfile {
    id: string;
    username: string;
    role: 'admin' | 'staff';
}

export interface ShipmentFilters {
    search: string;
    username: string;
    status: string;
    createdFrom: string;
    createdTo: string;
    transitBefore: string;
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

export interface AuditLogEntry {
    id: number;
    shipment_id: string;
    action: string;
    username: string;
    actor_id: string;
    actor_username?: string;
    details: Record<string, unknown>;
    created_at: string;
}

export const supabaseClient = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getCurrentProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, role')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data as UserProfile;
}

function applyShipmentFilters(query: any, filters: ShipmentFilters): any {
    const search = filters.search.trim();
    if (search) {
        const pattern = postgrestIlikePattern(search);
        query = query.or(`id.ilike.${pattern},article.ilike.${pattern}`);
    }
    if (filters.username !== 'All') query = query.eq('username', filters.username);
    if (filters.status !== 'All') query = query.eq('status', filters.status);
    if (filters.createdFrom) {
        const start = new Date(`${filters.createdFrom}T00:00:00`);
        if (!Number.isNaN(start.getTime())) query = query.gte('created_at', start.toISOString());
    }
    if (filters.createdTo) {
        const endExclusive = new Date(`${filters.createdTo}T00:00:00`);
        if (!Number.isNaN(endExclusive.getTime())) {
            endExclusive.setDate(endExclusive.getDate() + 1);
            query = query.lt('created_at', endExclusive.toISOString());
        }
    }
    if (filters.transitBefore) query = query.lt('transit_since', filters.transitBefore);
    return query;
}

function normalizeShipmentStatuses(data: Shipment[]): Shipment[] {
    return data.map(shipment => ({
        ...shipment,
        status: normalizeShipmentStatus(shipment.status),
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
    if (filters.createdFrom || filters.createdTo || filters.transitBefore) {
        const matchingRows: Array<{ status: string; frais: number }> = [];
        for (let offset = 0; ; offset += 1000) {
            let query = supabaseClient.from('shipments').select('status, frais');
            query = applyShipmentFilters(query, filters);
            const { data, error } = await query.range(offset, offset + 999);
            if (error) throw error;
            const page = (data || []) as Array<{ status: string; frais: number }>;
            matchingRows.push(...page);
            if (page.length < 1000) break;
        }

        return matchingRows.reduce<ShipmentSummary>((summary, row) => {
            const fee = Number(row.frais) || 0;
            summary.total += 1;
            summary.totalFees += fee;
            const status = normalizeShipmentStatus(row.status);
            if (status === 'Arrivé') {
                summary.arrived += 1;
                summary.arrivedFees += fee;
            } else if (status === 'En transit') {
                summary.transit += 1;
                summary.transitFees += fee;
            } else if (status === 'Récupéré') {
                summary.collected += 1;
                summary.collectedFees += fee;
            }
            return summary;
        }, { total: 0, arrived: 0, transit: 0, collected: 0, totalFees: 0, arrivedFees: 0, collectedFees: 0, transitFees: 0 });
    }

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

export async function getTransitAlertCount(days: number, username: string): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let query = supabaseClient
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'En transit')
        .lt('transit_since', cutoff);
    if (username !== 'All') query = query.eq('username', username);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
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

export async function getShipmentHistory(shipmentId: string): Promise<AuditLogEntry[]> {
    const { data, error } = await supabaseClient
        .from('audit_logs')
        .select('id, shipment_id, action, username, actor_id, details, created_at')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    const entries = (data || []) as AuditLogEntry[];
    const actorIds = [...new Set(entries.map(entry => entry.actor_id).filter(Boolean))];
    if (actorIds.length === 0) return entries;

    const [{ data: { user } }, { data: profiles, error: profileError }] = await Promise.all([
        supabaseClient.auth.getUser(),
        supabaseClient.from('profiles').select('id, username').in('id', actorIds),
    ]);
    if (profileError) throw profileError;
    const actorNames = new Map((profiles || []).map((profile: { id: string; username: string }) => [profile.id, profile.username]));
    return entries.map(entry => ({
        ...entry,
        actor_username: actorNames.get(entry.actor_id)
            || (entry.actor_id === user?.id ? entry.username : 'Administrateur'),
    }));
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
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Session utilisateur introuvable.');
    const { data: targetProfile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('username', shipment.username)
        .maybeSingle();
    if (profileError) throw profileError;
    const { error } = await supabaseClient.from('shipments').insert([{
        ...shipment,
        owner_id: targetProfile?.id || user.id,
    }]);
    if (error) throw error;
    return true;
}

export async function deleteMultipleShipments(ids: string[]): Promise<boolean> {
    const { error } = await supabaseClient.from('shipments').delete().in('id', ids);
    if (error) throw error;
    return true;
}

