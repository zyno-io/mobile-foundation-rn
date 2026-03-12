import { compact } from 'lodash';

export function formatPhone(input: string | null | undefined) {
    if (!input) {
        return '';
    }
    const strippedInput = input.replace(/^\+?1(\d{10})$/, '$1').replace(/[^\d]/g, '');
    if (strippedInput.length !== 10) return input;
    return `(${strippedInput.slice(0, 3)}) ${strippedInput.slice(3, 6)}-${strippedInput.slice(6, 10)}`;
}

export function formatCurrency(input: string | null) {
    if (input === null) {
        return '';
    }
    const strippedInput = input.replace(/[^\d]/g, '');
    if (strippedInput === '') {
        return strippedInput;
    }
    return `$${strippedInput}`;
}

export function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = (seconds % 3600) % 60;
    return compact([hours && `${hours}h`, minutes && `${minutes}m`, remainingSeconds && `${remainingSeconds}s`]).join(' ');
}
