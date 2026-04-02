/**
 * @file src/components/ui/OtpInput.tsx
 * @description Reusable 6-digit OTP input with auto-advance and paste support.
 */

import * as React from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ length = 6, value, onChange, disabled = false, autoFocus = true }) => {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, '').split('').slice(0, length);

  const focusAt = (i: number) => {
    const target = refs.current[Math.min(Math.max(i, 0), length - 1)];
    target?.focus();
    target?.select();
  };

  const handleChange = (i: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
    if (char && i < length - 1) focusAt(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      focusAt(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      focusAt(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, '').slice(0, length));
    focusAt(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d === ' ' ? '' : d}
          onChange={(e) => handleChange(i, e.target.value.slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          className="w-11 h-13 text-center text-xl font-extrabold rounded-xl border-2 border-border bg-surface text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

export { OtpInput };
