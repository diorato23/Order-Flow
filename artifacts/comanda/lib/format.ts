import { i18n } from "../constants/i18n";

/**
 * Formata um valor numérico para Pesos Colombianos (COP)
 * Exemplo: 15000 -> "$ 15.000"
 */
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Formata data e hora para o padrão local
 */
export const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
};
