/**
 * Propiedades del componente {@link StatCard}.
 */
interface StatCardProps {
  /** Etiqueta o título descriptivo de la métrica */
  label: string;
  /** Valor numérico o texto a destacar en grande */
  value: string | number;
  /** Color CSS acentuado para resaltar el valor principal */
  accentColor: string;
}

/**
 * Componente `StatCard` para visualizar tarjetas de métricas o estadísticas rápidas en el dashboard.
 */
export default function StatCard({
  label,
  value,
  accentColor,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-(--hulux-border) bg-(--hulux-surface) px-4 py-3 shadow-(--hulux-shadow)">
      <p className="text-xs text-(--hulux-text-muted) mb-0.5">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accentColor }}>{value}</p>
    </div>
  );
}

