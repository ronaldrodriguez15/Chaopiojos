import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function formatTime12Hour(timeValue) {
	if (timeValue === null || timeValue === undefined) return '';

	if (timeValue instanceof Date && !Number.isNaN(timeValue.getTime())) {
		const hours = timeValue.getHours();
		const minutes = String(timeValue.getMinutes()).padStart(2, '0');
		const period = hours >= 12 ? 'PM' : 'AM';
		const hour12 = hours % 12 || 12;
		return `${String(hour12).padStart(2, '0')}:${minutes} ${period}`;
	}

	const raw = String(timeValue).trim();
	if (!raw) return '';

	if (/\b(am|pm)\b/i.test(raw)) {
		return raw
			.replace(/\s+/g, ' ')
			.replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
	}

	const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
	if (!match) return raw;

	const hours = Number(match[1]);
	const minutes = match[2];
	if (!Number.isFinite(hours) || hours < 0 || hours > 23) return raw;

	const period = hours >= 12 ? 'PM' : 'AM';
	const hour12 = hours % 12 || 12;
	return `${String(hour12).padStart(2, '0')}:${minutes} ${period}`;
}
