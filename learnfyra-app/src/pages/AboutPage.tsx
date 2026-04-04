/**
 * @file src/pages/AboutPage.tsx
 * @description Public About Us page for Learnfyra.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { BookOpen, Heart, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageMeta } from '@/lib/pageMeta';

const highlights = [
  {
    icon: Heart,
    title: 'Built to help students',
    description:
      'Learnfyra was created with one goal: make practice easier and more accessible for every student.',
  },
  {
    icon: BookOpen,
    title: 'Made for real learning',
    description:
      'The platform focuses on useful worksheets, simple practice, and steady improvement without extra clutter.',
  },
  {
    icon: Sparkles,
    title: 'Growing with purpose',
    description:
      'What started as a small idea keeps growing so more students can learn, practice, and succeed for free.',
  },
];

const AboutPage: React.FC = () => {
  usePageMeta({
    title: 'About Us',
    description:
      'Learn why Learnfyra was created and our mission to keep high-quality worksheet practice free for students.',
    keywords: 'about learnfyra, free worksheets, student learning, education platform',
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="bg-white border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-2">
              About Learnfyra
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight mb-4">
              A simple platform built to help students learn for free
            </h1>
            <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
              Learnfyra began from a real need: it was hard to find good free worksheet download
              pages online. So this platform was created to make learning support easier to access
              for every student.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <section className="bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8">
            <h2 className="text-xl font-extrabold text-foreground mb-4">Why I created Learnfyra</h2>
            <div className="space-y-4 text-sm text-foreground leading-relaxed">
              <p>
                I was not able to find enough free worksheet download pages that were truly helpful
                for students. That is what inspired me to create Learnfyra.
              </p>
              <p>
                The idea was simple: build a place where students can practice, improve, and keep
                learning without cost becoming a barrier. What started small continues to grow with
                that same purpose.
              </p>
              <p>
                The aim is clear and important to me: <strong>keep Learnfyra free forever for all students.</strong>
              </p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white rounded-2xl border border-border shadow-card p-5">
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-4">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-extrabold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </section>

          <section className="bg-primary-light rounded-2xl border border-primary/20 p-6 sm:p-8">
            <h2 className="text-xl font-extrabold text-foreground mb-3">Our promise</h2>
            <p className="text-sm text-foreground leading-relaxed mb-5 max-w-2xl">
              Learnfyra is here to support students with better practice tools, more access to
              learning, and a mission-first approach that stays focused on value — not paywalls.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to Home
              </Link>
              <Link
                to="/privacy"
                className="inline-flex items-center rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-foreground hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View Privacy Policy
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
