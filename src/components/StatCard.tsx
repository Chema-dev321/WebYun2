export default function StatCard({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string | number;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-(--hulux-border) bg-(--hulux-surface) px-4 py-3 shadow-(--hulux-shadow)">
      <p className="text-xs text-(--hulux-text-muted) mb-0.5">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accentColor }}>{value}</p>
    </div>
  );
}
