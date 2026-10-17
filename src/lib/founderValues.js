export function founderBody(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function numericValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatFounderMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function founderCsvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export const FOUNDER_THEMES = ['burgundy', 'forest', 'ocean', 'midnight'];
export function founderTheme(value) {
  return FOUNDER_THEMES.includes(value) ? value : 'burgundy';
}
