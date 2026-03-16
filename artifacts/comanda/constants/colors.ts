const amber = "#F59E0B";
const amberLight = "#FCD34D";
const espresso = "#1A0F0A";
const charcoal = "#2D1B0E";
const warmDark = "#3D2B1F";
const surface = "#4A3728";
const muted = "#6B5040";
const textPrimary = "#FDF8F3";
const textSecondary = "#C9B8A8";
const textMuted = "#8B7262";
const green = "#22C55E";
const red = "#EF4444";
const orange = "#F97316";
const blue = "#3B82F6";

export default {
  amber,
  amberLight,
  espresso,
  charcoal,
  warmDark,
  surface,
  muted,
  textPrimary,
  textSecondary,
  textMuted,
  green,
  red,
  orange,
  blue,

  statusColors: {
    available: green,
    occupied: amber,
    reserved: blue,
    cleaning: orange,
    pending: orange,
    preparing: blue,
    ready: green,
    delivered: muted,
    cancelled: red,
  },

  statusLabels: {
    available: "Disponível",
    occupied: "Ocupada",
    reserved: "Reservada",
    cleaning: "Limpeza",
    pending: "Pendente",
    preparing: "Preparando",
    ready: "Pronto",
    delivered: "Entregue",
    cancelled: "Cancelado",
  },
} as const;
