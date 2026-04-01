/**
 * @file ScientificCalculator.tsx
 * @description Fully working on-screen calculator with standard + scientific modes.
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type CalcMode = 'standard' | 'scientific';

interface HistoryEntry {
  expression: string;
  result: string;
}

export default function ScientificCalculator() {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [mode, setMode] = useState<CalcMode>('standard');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [resetNext, setResetNext] = useState(false);

  const pushHistory = useCallback((expr: string, result: string) => {
    setHistory(prev => [{ expression: expr, result }, ...prev].slice(0, 5));
  }, []);

  const handleNumber = useCallback((num: string) => {
    setDisplay(prev => {
      if (resetNext || prev === '0') {
        setResetNext(false);
        return num;
      }
      return prev + num;
    });
  }, [resetNext]);

  const handleOperator = useCallback((op: string) => {
    setExpression(prev => {
      const expr = prev + display + ' ' + op + ' ';
      setDisplay('0');
      setResetNext(true);
      return expr;
    });
  }, [display]);

  const handleEquals = useCallback(() => {
    try {
      const fullExpr = expression + display;
      // Safe evaluation with basic math operations
      const sanitized = fullExpr
        .replace(/x/g, '*')
        .replace(/\u00f7/g, '/')
        .replace(/\u03c0/g, String(Math.PI))
        .replace(/e(?![xp])/g, String(Math.E));
      const result = new Function(`return (${sanitized})`)();
      const formatted = Number.isFinite(result) ? String(parseFloat(result.toFixed(10))) : 'Error';
      pushHistory(fullExpr, formatted);
      setDisplay(formatted);
      setExpression('');
      setResetNext(true);
    } catch {
      setDisplay('Error');
      setExpression('');
      setResetNext(true);
    }
  }, [display, expression, pushHistory]);

  const handleClear = () => { setDisplay('0'); setExpression(''); };
  const handleToggleSign = () => setDisplay(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev);
  const handlePercent = () => setDisplay(prev => String(parseFloat(prev) / 100));
  const handleDecimal = () => setDisplay(prev => prev.includes('.') ? prev : prev + '.');
  const handleBackspace = () => setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');

  const handleScientific = useCallback((fn: string) => {
    try {
      const val = parseFloat(display);
      let result: number;
      switch (fn) {
        case 'sin': result = Math.sin(val * Math.PI / 180); break;
        case 'cos': result = Math.cos(val * Math.PI / 180); break;
        case 'tan': result = Math.tan(val * Math.PI / 180); break;
        case 'log': result = Math.log10(val); break;
        case 'ln': result = Math.log(val); break;
        case 'sqrt': result = Math.sqrt(val); break;
        case 'sq': result = val * val; break;
        case 'pi': setDisplay(String(Math.PI)); setResetNext(true); return;
        case 'e': setDisplay(String(Math.E)); setResetNext(true); return;
        default: return;
      }
      setDisplay(String(parseFloat(result.toFixed(10))));
      setResetNext(true);
    } catch {
      setDisplay('Error');
      setResetNext(true);
    }
  }, [display]);

  const btnClass = 'flex items-center justify-center h-9 rounded-lg text-sm font-semibold transition-all active:scale-95';

  return (
    <div className="pt-3">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 p-0.5 bg-muted rounded-lg">
        {(['standard', 'scientific'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors capitalize',
              mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Display */}
      <div className="bg-surface-2 rounded-xl p-3 mb-3">
        <p className="text-[10px] text-muted-foreground h-4 truncate">{expression || '\u00A0'}</p>
        <p className="text-2xl font-bold text-foreground text-right truncate font-mono">{display}</p>
      </div>

      {/* Scientific buttons */}
      {mode === 'scientific' && (
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'sq', 'pi', 'e'].map(fn => (
            <button
              key={fn}
              type="button"
              onClick={() => handleScientific(fn)}
              className={cn(btnClass, 'bg-surface-2 text-foreground hover:bg-border text-xs')}
            >
              {fn === 'sqrt' ? '\u221A' : fn === 'sq' ? 'x\u00B2' : fn === 'pi' ? '\u03C0' : fn}
            </button>
          ))}
        </div>
      )}

      {/* Standard grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" onClick={handleClear} className={cn(btnClass, 'bg-muted text-foreground hover:bg-border')}>C</button>
        <button type="button" onClick={handleToggleSign} className={cn(btnClass, 'bg-muted text-foreground hover:bg-border')}>&plusmn;</button>
        <button type="button" onClick={handlePercent} className={cn(btnClass, 'bg-muted text-foreground hover:bg-border')}>%</button>
        <button type="button" onClick={() => handleOperator('\u00f7')} className={cn(btnClass, 'bg-primary text-white hover:bg-primary-hover')}>&divide;</button>

        {['7', '8', '9'].map(n => <button key={n} type="button" onClick={() => handleNumber(n)} className={cn(btnClass, 'bg-card border border-border text-foreground hover:bg-muted')}>{n}</button>)}
        <button type="button" onClick={() => handleOperator('x')} className={cn(btnClass, 'bg-primary text-white hover:bg-primary-hover')}>&times;</button>

        {['4', '5', '6'].map(n => <button key={n} type="button" onClick={() => handleNumber(n)} className={cn(btnClass, 'bg-card border border-border text-foreground hover:bg-muted')}>{n}</button>)}
        <button type="button" onClick={() => handleOperator('-')} className={cn(btnClass, 'bg-primary text-white hover:bg-primary-hover')}>&minus;</button>

        {['1', '2', '3'].map(n => <button key={n} type="button" onClick={() => handleNumber(n)} className={cn(btnClass, 'bg-card border border-border text-foreground hover:bg-muted')}>{n}</button>)}
        <button type="button" onClick={() => handleOperator('+')} className={cn(btnClass, 'bg-primary text-white hover:bg-primary-hover')}>+</button>

        <button type="button" onClick={() => handleNumber('0')} className={cn(btnClass, 'col-span-2 bg-card border border-border text-foreground hover:bg-muted')}>0</button>
        <button type="button" onClick={handleDecimal} className={cn(btnClass, 'bg-card border border-border text-foreground hover:bg-muted')}>.</button>
        <button type="button" onClick={handleEquals} className={cn(btnClass, 'bg-secondary text-white hover:bg-secondary-hover')}>=</button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-3 max-h-20 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground font-semibold mb-1">History</p>
          {history.map((h, i) => (
            <p key={i} className="text-[10px] text-muted-foreground truncate">
              {h.expression} = <span className="font-semibold text-foreground">{h.result}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
