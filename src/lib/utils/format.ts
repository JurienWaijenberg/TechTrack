/**
 * Format date string to readable format
 */
export function formatDate(dateString?: string): string | null {
    if (!dateString) {
        return null;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Extract last name from full name
 */
export function getLastName(lastName?: string): string {
    if (!lastName) return 'Unknown';
    
    const parts = lastName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : lastName;
}

