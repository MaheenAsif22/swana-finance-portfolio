export const currency = (n) =>
  n == null ? '—' : '₨\u202F' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });

export const dateStr = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const timeStr = (s) => {
  if (!s) return '';
  return new Date(s).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
};

export const today   = () => new Date().toISOString().split('T')[0];
export const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
