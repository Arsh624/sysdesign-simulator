import type { ReactNode } from "react";
import { runner } from "../sim/runner";
import { useSimStore } from "../store/simStore";

const SPEED_OPTIONS = [0, 1, 2.5, 5];
const TRAFFIC_OPTIONS = [0, 1, 2.5, 5];

interface SegmentedProps {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}

function Segmented({ label, value, options, onChange }: SegmentedProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={
              opt === value
                ? "px-3 py-1 rounded border text-sm bg-blue-600 text-white border-blue-600"
                : "px-3 py-1 rounded border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }
            onClick={() => onChange(opt)}
          >
            {opt}x
          </button>
        ))}
      </div>
    </div>
  );
}

interface ControlBarProps {
  children?: ReactNode;
}

export default function ControlBar({ children }: ControlBarProps) {
  const running = useSimStore((s) => s.running);
  const speed = useSimStore((s) => s.speed);
  const traffic = useSimStore((s) => s.traffic);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const setTraffic = useSimStore((s) => s.setTraffic);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b">
      {running ? (
        <button
          type="button"
          className="px-3 py-1 rounded border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          onClick={() => runner.pause()}
        >
          ⏸ Pause
        </button>
      ) : (
        <button
          type="button"
          className="px-3 py-1 rounded border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          onClick={() => runner.start()}
        >
          ▶ Start
        </button>
      )}

      <button
        type="button"
        className="px-3 py-1 rounded border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        onClick={() => runner.stepOnce()}
      >
        ⏭ Step
      </button>

      <button
        type="button"
        className="px-3 py-1 rounded border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        onClick={() => runner.stop()}
      >
        ↺ Reset
      </button>

      <div className="w-px self-stretch bg-gray-300" />

      <Segmented label="Speed" value={speed} options={SPEED_OPTIONS} onChange={setSpeed} />
      <Segmented label="Traffic" value={traffic} options={TRAFFIC_OPTIONS} onChange={setTraffic} />

      <div className="w-px self-stretch bg-gray-300" />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">{children}</div>
    </div>
  );
}
