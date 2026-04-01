/**
 * @file ToolsPanel.tsx
 * @description Collapsible right sidebar panel with subject-aware tools.
 */

import { useState } from 'react';
import { ChevronDown, Calculator, StickyNote, BookOpen, LineChart, Compass, BookType, FlaskConical, Wrench, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScientificCalculator from './ScientificCalculator';
import ScratchPad from './ScratchPad';
import FormulaSheet from './FormulaSheet';
import type { Subject } from '../../types';

interface ToolsPanelProps {
  subject: Subject;
  grade: number;
}

interface ToolItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode | null;
  comingSoon?: boolean;
  subjects?: Subject[];
}

export default function ToolsPanel({ subject, grade }: ToolsPanelProps) {
  const [openTool, setOpenTool] = useState<string | null>(null);

  const tools: ToolItem[] = [
    {
      id: 'calculator',
      label: 'Calculator',
      icon: <Calculator className="size-4" />,
      component: <ScientificCalculator />,
      subjects: ['Math'],
    },
    {
      id: 'scratchpad',
      label: 'Scratch Pad',
      icon: <StickyNote className="size-4" />,
      component: <ScratchPad />,
    },
    {
      id: 'formulas',
      label: 'Formula Sheet',
      icon: <BookOpen className="size-4" />,
      component: <FormulaSheet subject={subject} grade={grade} />,
      subjects: ['Math', 'Science'],
    },
    {
      id: 'graph',
      label: 'Graph Plotter',
      icon: <LineChart className="size-4" />,
      component: null,
      comingSoon: true,
      subjects: ['Math'],
    },
    {
      id: 'compass',
      label: 'Geometry Compass',
      icon: <Compass className="size-4" />,
      component: null,
      comingSoon: true,
      subjects: ['Math'],
    },
    {
      id: 'dictionary',
      label: 'Dictionary',
      icon: <BookType className="size-4" />,
      component: null,
      comingSoon: true,
      subjects: ['ELA'],
    },
    {
      id: 'periodic',
      label: 'Periodic Table',
      icon: <FlaskConical className="size-4" />,
      component: null,
      comingSoon: true,
      subjects: ['Science'],
    },
  ];

  const availableTools = tools.filter(
    t => !t.subjects || t.subjects.includes(subject),
  );

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-extrabold text-foreground">Tools</h3>
      </div>

      <div className="space-y-2">
        {availableTools.map(tool => (
          <div key={tool.id} className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => !tool.comingSoon && setOpenTool(prev => prev === tool.id ? null : tool.id)}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2.5 text-sm font-semibold transition-colors',
                tool.comingSoon ? 'text-muted-foreground/50 cursor-not-allowed' : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="flex items-center gap-2">
                {tool.icon}
                {tool.label}
                {tool.comingSoon && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <Lock className="size-2.5" /> Soon
                  </span>
                )}
              </span>
              {!tool.comingSoon && (
                <ChevronDown className={cn('size-3.5 transition-transform', openTool === tool.id && 'rotate-180')} />
              )}
            </button>
            {openTool === tool.id && tool.component && (
              <div className="px-3 pb-3 border-t border-border">
                {tool.component}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
