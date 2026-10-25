import { config } from '../config/index.js';
const TIMEZONE = config.timezone || 'Asia/Kolkata';
/**
 * Returns formatted date string in Asia/Kolkata timezone: YYYY-MM-DD
 */
export function getKolkataDateString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date); // en-CA gives YYYY-MM-DD
}
/**
 * Returns formatted timestamp in Asia/Kolkata timezone: YYYY-MM-DD HH:mm:ss
 */
export function getKolkataTimestamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    }
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}
/**
 * Returns the current hour in Asia/Kolkata timezone (0 - 23)
 */
export function getKolkataHour(date = new Date()) {
    const hourStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        hour: 'numeric',
        hour12: false,
    }).format(date);
    return parseInt(hourStr, 10);
}
/**
 * Returns start and end timestamps (YYYY-MM-DD HH:mm:ss) for a date in Asia/Kolkata
 */
export function getDateDayBoundaries(dateStr) {
    return {
        start: `${dateStr} 00:00:00`,
        end: `${dateStr} 23:59:59`,
    };
}
/**
 * Returns calculated date range based on filter keyword
 */
export function calculateDateRange(filter, customStart, customEnd) {
    const today = new Date();
    const todayStr = getKolkataDateString(today);
    switch (filter) {
        case 'yesterday': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = getKolkataDateString(yesterday);
            return { startDate: yStr, endDate: yStr };
        }
        case 'last7days': {
            const past7 = new Date(today);
            past7.setDate(past7.getDate() - 6);
            return { startDate: getKolkataDateString(past7), endDate: todayStr };
        }
        case 'thismonth': {
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            return { startDate: `${year}-${month}-01`, endDate: todayStr };
        }
        case 'lastmonth': {
            const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1);
            const lastMonthYear = lastMonthEnd.getFullYear();
            const lastMonthNum = String(lastMonthEnd.getMonth() + 1).padStart(2, '0');
            const lastDay = String(lastMonthEnd.getDate()).padStart(2, '0');
            return {
                startDate: `${lastMonthYear}-${lastMonthNum}-01`,
                endDate: `${lastMonthYear}-${lastMonthNum}-${lastDay}`,
            };
        }
        case 'thisyear': {
            const year = today.getFullYear();
            return { startDate: `${year}-01-01`, endDate: todayStr };
        }
        case 'custom': {
            if (customStart && customEnd) {
                return { startDate: customStart, endDate: customEnd };
            }
            return { startDate: todayStr, endDate: todayStr };
        }
        case 'today':
        default:
            return { startDate: todayStr, endDate: todayStr };
    }
}
