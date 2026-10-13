export const shipmentStatuses = ['En transit', 'Arrivé', 'Récupéré'] as const;

export function isNonNegativeInteger(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 0;
}

export function isShipmentStatus(value: string): boolean {
    return shipmentStatuses.includes(value as typeof shipmentStatuses[number]);
}

export function normalizeShipmentStatus(value: string): string {
    return value === 'Livré' ? 'Arrivé' : value;
}

export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]!);
}

export function postgrestIlikePattern(value: string): string {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/[%_]/g, character => `\\${character}`)
        .replace(/"/g, '\\"');
    return `"%${escaped}%"`;
}
