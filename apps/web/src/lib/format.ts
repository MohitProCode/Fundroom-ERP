export function formatQuantity(value: string | number, unit?: string): string {
  const amount = Math.round(Number(value));
  const formatted = amount.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatMoney(value: string | number): string {
  return `INR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
