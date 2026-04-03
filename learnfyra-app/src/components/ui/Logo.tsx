/**
 * @file src/components/ui/Logo.tsx
 * @description Learnfyra logo image component.
 *
 * The logo image already contains the full brand name.
 * Do NOT render text alongside it — withText is intentionally removed.
 *
 * Size guide:
 *   sm  → h-20  (80px)   sidebar, footer, compact contexts
 *   nav → h-28  (112px)  sticky navbar  ← default for Navbar
 *   md  → h-32  (128px)  page headers, auth cards
 *   lg  → h-40  (160px)  splash / hero contexts
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type LogoSize = 'sm' | 'nav' | 'md' | 'lg';

interface LogoProps {
  size?: LogoSize;
  /** Use the transparent/white variant for dark backgrounds */
  dark?: boolean;
  className?: string;
}

const heightMap: Record<LogoSize, string> = {
  sm:  'h-32',
  nav: 'h-44',
  md:  'h-48',
  lg:  'h-60',
};

const Logo: React.FC<LogoProps> = ({ size = 'nav', dark = false, className }) => {
  const src = dark
    ? '/images/Logos/transparent-logo.png'
    : '/images/Logos/colored-logo.png';

  return (
    <img
      src={src}
      alt="Learnfyra"
      className={cn(heightMap[size], 'w-auto object-contain select-none', className)}
      draggable={false}
    />
  );
};

export { Logo };
