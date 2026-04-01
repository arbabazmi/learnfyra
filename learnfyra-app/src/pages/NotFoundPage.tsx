/**
 * @file src/pages/NotFoundPage.tsx
 * @description 404 Not Found — consistent with the Learnfyra design system.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { usePageMeta } from '@/lib/pageMeta';

const NotFoundPage: React.FC = () => {
  usePageMeta({
    title: '404 — Page Not Found',
    description: "The page you're looking for doesn't exist. Return to Learnfyra and keep learning.",
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top logo */}
      <header className="px-6 py-5 border-b border-border bg-white">
        <Link to="/" aria-label="Learnfyra home">
          <Logo size="nav" />
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md space-y-6">
          {/* Decorative number */}
          <div className="relative inline-block">
            <span className="text-[8rem] font-black text-foreground/[0.05] leading-none select-none">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-primary-light flex items-center justify-center">
                <BookOpen className="size-10 text-primary" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-foreground">Page not found</h1>
            <p className="text-muted-foreground leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or may have moved.
              Let&apos;s get you back on track.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" size="md" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" />
                Back to Home
              </Link>
            </Button>
            <Button variant="outline" size="md" asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;
