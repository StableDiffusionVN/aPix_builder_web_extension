import { Boxes, Cloud, Server } from "lucide-react";

export const MODES = [
  { id: "comfy", label: "ComfyUI", shortLabel: "Comfy", icon: Server },
  { id: "runninghub-workflow", label: "RH Workflow", shortLabel: "RH Wf", icon: Boxes },
  { id: "runninghub-app", label: "RH App", shortLabel: "RH App", icon: Cloud }
];

export function ModeTabs({ value, onChange }) {
  return (
    <nav className="mode-tabs" aria-label="Chế độ xử lý">
      {MODES.map(mode => {
        const Icon = mode.icon;
        const active = value === mode.id;
        return (
          <button key={mode.id} className={active ? "active" : ""} onClick={() => onChange(mode.id)} aria-pressed={active}>
            <Icon size={14} />
            <span className="mode-label">{mode.label}</span>
            <span className="mode-label-short">{mode.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
