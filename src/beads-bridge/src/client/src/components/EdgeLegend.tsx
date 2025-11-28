import type { BeadsDependencyType } from '../types';

interface LegendItem {
  type: BeadsDependencyType;
  label: string;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
}

const legendItems: LegendItem[] = [
  { type: 'parent-child', label: 'Parent-Child', color: '#3b82f6', style: 'solid' },
  { type: 'blocks', label: 'Blocks', color: '#ef4444', style: 'solid', animated: true },
  { type: 'related', label: 'Related', color: '#6b7280', style: 'dashed' },
  { type: 'discovered-from', label: 'Discovered From', color: '#f59e0b', style: 'dotted' },
];

export function EdgeLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur supports/backdrop-blur:bg-white/95">
      <div className="mb-2 text-xs font-semibold text-slate-700">Edge Types</div>
      <div className="flex flex-col gap-2">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <svg width="32" height="12" className="flex-shrink-0">
              <line
                x1="0"
                y1="6"
                x2="32"
                y2="6"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={
                  item.style === 'dashed' ? '5,5' : item.style === 'dotted' ? '3,3' : undefined
                }
              >
                {item.animated && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="10"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                )}
              </line>
            </svg>
            <span className="text-xs text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
