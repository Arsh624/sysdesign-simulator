import { useSimStore } from "../store/simStore";
import { useDesignStore } from "../store/designStore";

function Stat({
  label,
  value,
  valueClassName = "",
  sublabel,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sublabel?: string | null;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className={`text-sm font-medium text-gray-900 ${valueClassName}`}>
        {value}
      </span>
      {sublabel != null && (
        <span className="text-[9px] uppercase tracking-wide text-gray-400">
          {sublabel}
        </span>
      )}
    </div>
  );
}

export default function Hud() {
  const summary = useSimStore((s) => s.summary);
  const history = useSimStore((s) => s.history);

  const nodes = useDesignStore((s) => s.nodes);

  const lastPoint = history.length > 0 ? history[history.length - 1] : null;
  const throughputText =
    lastPoint != null ? `${Math.round(lastPoint.throughput)} req/s` : "—";

  const p95Text = summary != null ? `${Math.round(summary.p95)} ms` : "—";

  const dropRatePct = summary != null ? summary.dropRate * 100 : null;
  const dropRateText = dropRatePct != null ? `${dropRatePct.toFixed(1)}%` : "—";
  const dropRateColor =
    dropRatePct != null && dropRatePct > 5 ? "text-red-600" : "";

  const availability =
    summary != null ? (1 - summary.dropRate) * 100 : null;
  const availabilityText =
    availability != null
      ? availability < 100
        ? `${availability.toFixed(2)}%`
        : "100%"
      : "—";
  const availabilityColor =
    availability != null
      ? availability < 99
        ? "text-red-600"
        : availability < 99.9
          ? "text-amber-600"
          : "text-green-600"
      : "";
  const ninesText =
    availability != null
      ? availability >= 99.999
        ? "5 nines"
        : availability >= 99.99
          ? "4 nines"
          : availability >= 99.9
            ? "3 nines"
            : availability >= 99
              ? "2 nines"
              : availability >= 90
                ? "1 nine"
                : "low"
      : null;

  let bottleneckText = "—";
  if (nodes.length > 0) {
    const top = nodes.reduce((best, n) =>
      n.data.utilization > best.data.utilization ? n : best
    );
    if (top.data.utilization > 0) {
      bottleneckText = `${top.data.label} ${Math.round(top.data.utilization * 100)}%`;
    }
  }

  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b text-sm bg-white">
      <Stat label="Throughput" value={throughputText} />
      <Stat label="P95" value={p95Text} />
      <Stat label="Drop Rate" value={dropRateText} valueClassName={dropRateColor} />
      <Stat
        label="Availability"
        value={availabilityText}
        valueClassName={availabilityColor}
        sublabel={ninesText}
      />
      <Stat label="Bottleneck" value={bottleneckText} />
    </div>
  );
}
