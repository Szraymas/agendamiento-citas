/**
 * Formats a numeric value into COP (Colombian Peso) currency string.
 * Example: 50000 -> "$ 50.000 COP"
 */
export function formatCOP(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$ 0 COP';
  }
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);

  return `${formatted} COP`;
}
