import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useSimStore } from "../store/simStore";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded px-2 py-1.5 flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export function MetricsPanel() {
  const summary = useSimStore((s) => s.summary);
  const history = useSimStore((s) => s.history);

  const lastPoint = history.length > 0 ? history[history.length - 1] : undefined;

  const throughput = lastPoint ? Math.round(lastPoint.throughput).toString() : "—";
  const p50 = summary ? summary.p50.toFixed(1) : "—";
  const p95 = summary ? summary.p95.toFixed(1) : "—";
  const p99 = summary ? summary.p99.toFixed(1) : "—";
  const dropRate = summary ? `${(summary.dropRate * 100).toFixed(1)}%` : "—";
  const completed = summary ? summary.completed.toString() : "—";
  const dropped = summary ? summary.dropped.toString() : "—";

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 flex flex-col gap-4 p-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Metrics
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Throughput (req/s)" value={throughput} />
          <StatTile label="p50 (ms)" value={p50} />
          <StatTile label="p95 (ms)" value={p95} />
          <StatTile label="p99 (ms)" value={p99} />
          <StatTile label="Drop rate" value={dropRate} />
          <StatTile label="Completed" value={completed} />
          <StatTile label="Dropped" value={dropped} />
        </div>
      </div>

      {history.length === 0 && (
        <div className="text-xs text-gray-400 italic">
          Run the simulation to see metrics
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Latency (ms)
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={false} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="p50" stroke="#6b7280" dot={false} />
            <Line type="monotone" dataKey="p95" stroke="#f59e0b" dot={false} />
            <Line type="monotone" dataKey="p99" stroke="#ef4444" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Throughput &amp; Drops
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 1]}
              tick={{ fontSize: 10 }}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="throughput"
              stroke="#3b82f6"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="dropRate"
              stroke="#ef4444"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default MetricsPanel;
