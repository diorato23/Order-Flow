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
    // inglês (legado)
    available: green,
    occupied: amber,
    reserved: blue,
    cleaning: orange,
    pending: orange,
    preparing: blue,
    ready: green,
    delivered: muted,
    cancelled: red,
    // português (Supabase)
    disponivel: green,
    ocupada: amber,
    reservada: blue,
    limpeza: orange,
    pendente: orange,
    preparando: blue,
    pronto: green,
    entregue: muted,
    cancelado: red,
  },

  statusLabels: {
    // inglês (legado)
    available: "Disponible",
    occupied: "Ocupada",
    reserved: "Reservada",
    cleaning: "Limpieza",
    pending: "Pendiente",
    preparing: "Preparando",
    ready: "Listo",
    delivered: "Entregado",
    cancelled: "Cancelado",
    // espanhol (Colômbia)
    disponivel: "Disponible",
    ocupada: "Ocupada",
    reservada: "Reservada",
    limpeza: "Limpieza",
    pendente: "Pendiente",
    preparando: "Preparando",
    pronto: "Listo",
    entregue: "Entregado",
    cancelado: "Cancelado",
  },

} as const;
