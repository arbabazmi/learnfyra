import * as React from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/ui/Logo';

const Footer: React.FC = () => (
  <footer className="bg-white border-t border-border">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Main row */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10">

        {/* Brand */}
        <div className="max-w-xs space-y-3">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Free AI-powered worksheets for every student, Grade&nbsp;1 through&nbsp;10.
            Built to help students learn — and kept free, forever.
          </p>
          <a
            href="mailto:admin@learnfyra.com"
            className="inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            admin@learnfyra.com
          </a>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-x-16 gap-y-8">
          {/* Explore — uses plain <a> so /#anchor links work from any route */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
              Explore
            </h4>
            <ul className="space-y-2">
              {[
                { label: 'Features',      href: '/#features' },
                { label: 'How It Works',  href: '/#how-it-works' },
                { label: 'For Schools',   href: '/#for-schools' },
                { label: 'About Us',      href: '/about' },
              ].map(({ label, href }) => (
                <li key={href}>
                  {href.startsWith('/#') ? (
                    <a
                      href={href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      to={href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
              Legal
            </h4>
            <ul className="space-y-2">
              {[
                { label: 'Privacy Policy',                    href: '/privacy' },
                { label: 'Terms of Service',                  href: '/terms' },
                { label: 'Do Not Sell My Personal Information', href: '/do-not-sell' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Learnfyra. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground">
          Made with ♥ for students everywhere.
        </p>
      </div>

    </div>
  </footer>
);

export { Footer };
