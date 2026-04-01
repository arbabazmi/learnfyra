/**
 * @file ScratchPad.tsx
 * @description Freeform text scratchpad with auto-save to sessionStorage.
 */

import { useState, useEffect } from 'react';
import { Bold, Italic, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'learnfyra-scratchpad';

export default function ScratchPad() {
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, text); } catch { /* ignore */ }
  }, [text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="pt-3">
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => setText(prev => prev + '**')}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          title="Bold"
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setText(prev => prev + '*')}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          title="Italic"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setText('')}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          title="Clear"
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          title="Copy"
        >
          <Copy className="size-3.5" />
        </button>
        {copied && <span className="text-[10px] text-success font-medium">Copied!</span>}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Rough work, notes, calculations..."
        rows={6}
        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:border-primary"
      />
      <p className="text-[10px] text-muted-foreground text-right mt-1">{text.length} chars</p>
    </div>
  );
}
