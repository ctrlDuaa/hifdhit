/**
 * Country to timezone mapping
 * Maps country names to their primary IANA timezone identifiers
 */

export interface CountryOption {
  name: string;
  code: string;
  timezone: string;
}

export const countries: CountryOption[] = [
  { name: 'Afghanistan', code: 'AF', timezone: 'Asia/Kabul' },
  { name: 'Algeria', code: 'DZ', timezone: 'Africa/Algiers' },
  { name: 'Argentina', code: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Australia (Melbourne)', code: 'AU', timezone: 'Australia/Melbourne' },
  { name: 'Australia (Perth)', code: 'AU', timezone: 'Australia/Perth' },
  { name: 'Australia (Sydney)', code: 'AU', timezone: 'Australia/Sydney' },
  { name: 'Austria', code: 'AT', timezone: 'Europe/Vienna' },
  { name: 'Bangladesh', code: 'BD', timezone: 'Asia/Dhaka' },
  { name: 'Belgium', code: 'BE', timezone: 'Europe/Brussels' },
  { name: 'Brazil (Brasília)', code: 'BR', timezone: 'America/Sao_Paulo' },
  { name: 'Canada (Eastern)', code: 'CA', timezone: 'America/Toronto' },
  { name: 'Canada (Mountain)', code: 'CA', timezone: 'America/Edmonton' },
  { name: 'Canada (Pacific)', code: 'CA', timezone: 'America/Vancouver' },
  { name: 'Chile', code: 'CL', timezone: 'America/Santiago' },
  { name: 'China', code: 'CN', timezone: 'Asia/Shanghai' },
  { name: 'Colombia', code: 'CO', timezone: 'America/Bogota' },
  { name: 'Denmark', code: 'DK', timezone: 'Europe/Copenhagen' },
  { name: 'Egypt', code: 'EG', timezone: 'Africa/Cairo' },
  { name: 'France', code: 'FR', timezone: 'Europe/Paris' },
  { name: 'Germany', code: 'DE', timezone: 'Europe/Berlin' },
  { name: 'Greece', code: 'GR', timezone: 'Europe/Athens' },
  { name: 'India', code: 'IN', timezone: 'Asia/Kolkata' },
  { name: 'Indonesia', code: 'ID', timezone: 'Asia/Jakarta' },
  { name: 'Iran', code: 'IR', timezone: 'Asia/Tehran' },
  { name: 'Iraq', code: 'IQ', timezone: 'Asia/Baghdad' },
  { name: 'Italy', code: 'IT', timezone: 'Europe/Rome' },
  { name: 'Japan', code: 'JP', timezone: 'Asia/Tokyo' },
  { name: 'Jordan', code: 'JO', timezone: 'Asia/Amman' },
  { name: 'Kenya', code: 'KE', timezone: 'Africa/Nairobi' },
  { name: 'Kuwait', code: 'KW', timezone: 'Asia/Kuwait' },
  { name: 'Lebanon', code: 'LB', timezone: 'Asia/Beirut' },
  { name: 'Malaysia', code: 'MY', timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Mexico', code: 'MX', timezone: 'America/Mexico_City' },
  { name: 'Morocco', code: 'MA', timezone: 'Africa/Casablanca' },
  { name: 'Netherlands', code: 'NL', timezone: 'Europe/Amsterdam' },
  { name: 'New Zealand', code: 'NZ', timezone: 'Pacific/Auckland' },
  { name: 'Nigeria', code: 'NG', timezone: 'Africa/Lagos' },
  { name: 'Norway', code: 'NO', timezone: 'Europe/Oslo' },
  { name: 'Pakistan', code: 'PK', timezone: 'Asia/Karachi' },
  { name: 'Palestine', code: 'PS', timezone: 'Asia/Gaza' },
  { name: 'Peru', code: 'PE', timezone: 'America/Lima' },
  { name: 'Poland', code: 'PL', timezone: 'Europe/Warsaw' },
  { name: 'Qatar', code: 'QA', timezone: 'Asia/Qatar' },
  { name: 'Russia', code: 'RU', timezone: 'Europe/Moscow' },
  { name: 'Saudi Arabia', code: 'SA', timezone: 'Asia/Riyadh' },
  { name: 'Singapore', code: 'SG', timezone: 'Asia/Singapore' },
  { name: 'South Africa', code: 'ZA', timezone: 'Africa/Johannesburg' },
  { name: 'South Korea', code: 'KR', timezone: 'Asia/Seoul' },
  { name: 'Spain', code: 'ES', timezone: 'Europe/Madrid' },
  { name: 'Sweden', code: 'SE', timezone: 'Europe/Stockholm' },
  { name: 'Switzerland', code: 'CH', timezone: 'Europe/Zurich' },
  { name: 'Syria', code: 'SY', timezone: 'Asia/Damascus' },
  { name: 'Thailand', code: 'TH', timezone: 'Asia/Bangkok' },
  { name: 'Tunisia', code: 'TN', timezone: 'Africa/Tunis' },
  { name: 'Turkey', code: 'TR', timezone: 'Europe/Istanbul' },
  { name: 'United Arab Emirates', code: 'AE', timezone: 'Asia/Dubai' },
  { name: 'United Kingdom', code: 'GB', timezone: 'Europe/London' },
  { name: 'United States (Central)', code: 'US', timezone: 'America/Chicago' },
  { name: 'United States (Eastern)', code: 'US', timezone: 'America/New_York' },
  { name: 'United States (Mountain)', code: 'US', timezone: 'America/Denver' },
  { name: 'United States (Pacific)', code: 'US', timezone: 'America/Los_Angeles' },
  { name: 'Yemen', code: 'YE', timezone: 'Asia/Aden' },
];

/**
 * Convert UTC date to user's timezone
 */
export const toUserTimezone = (date: Date | string, timezone: string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Format the date in the user's timezone and parse it back
  const formatted = dateObj.toLocaleString('en-US', { timeZone: timezone });
  return new Date(formatted);
};

/**
 * Format date in user's timezone
 */
export const formatInTimezone = (
  date: Date | string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    ...options,
    timeZone: timezone,
  });
};

/**
 * Get the start of day in user's timezone
 */
export const getStartOfDayInTimezone = (date: Date, timezone: string): Date => {
  // Get the date in the target timezone (YYYY-MM-DD format)
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create noon UTC on that date as a reference point
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  
  // Get the date AND time that noon UTC shows in the target timezone
  const inTzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(noonUTC);
  
  const getPart = (type: string) => inTzParts.find(p => p.type === type)?.value || '0';
  
  const tzDay = parseInt(getPart('day'));
  const tzHour = parseInt(getPart('hour'));
  const tzMinute = parseInt(getPart('minute'));
  
  // Calculate base offset in minutes from noon
  let offsetMinutes = (tzHour - 12) * 60 + tzMinute;
  
  // Adjust if the day changed due to timezone offset
  if (tzDay !== day) {
    // Check if timezone is ahead (day increased) or behind (day decreased)
    // Handle month boundary wrapping (e.g., 31->1 or 1->31)
    if (tzDay > day || (tzDay === 1 && day > 20)) {
      // Timezone is ahead of UTC, add 24 hours to offset
      offsetMinutes += 24 * 60;
    } else if (tzDay < day || (day === 1 && tzDay > 20)) {
      // Timezone is behind UTC, subtract 24 hours
      offsetMinutes -= 24 * 60;
    }
  }
  
  // Midnight UTC on that date, adjusted by offset to get midnight in the timezone
  const midnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  
  return new Date(midnightUTC - offsetMinutes * 60 * 1000);
};

/**
 * Get the start of week (Monday) in user's timezone
 */
export const getStartOfWeekInTimezone = (date: Date, timezone: string): Date => {
  // Get the current day of the week in the user's timezone (0=Sunday, 6=Saturday)
  const dayName = formatInTimezone(date, timezone, { weekday: 'short' });
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const dayOfWeek = dayMap[dayName] || 0;
  
  // Calculate how many days to go back to get to Monday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Subtract days using milliseconds to handle month/year boundaries correctly
  const mondayDate = new Date(date.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  
  // Get the start of that Monday in the user's timezone
  return getStartOfDayInTimezone(mondayDate, timezone);
};
