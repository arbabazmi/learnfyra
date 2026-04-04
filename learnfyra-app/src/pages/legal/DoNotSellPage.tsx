/**
 * @file src/pages/legal/DoNotSellPage.tsx
 * @description CCPA "Do Not Sell or Share My Personal Information" page.
 * Static informational page — no API calls required.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageMeta } from '@/lib/pageMeta';

const DoNotSellPage: React.FC = () => {
  usePageMeta({
    title: 'Do Not Sell My Personal Information',
    description:
      'Learnfyra does not sell, rent, or share personal information with third parties. Learn about your CCPA privacy rights.',
    keywords: 'do not sell, CCPA, privacy rights, personal information, opt-out',
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Page header */}
        <div className="bg-white border-b border-border">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
                <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-primary mb-1">
                  Privacy Rights
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                  Do Not Sell or Share My Personal Information
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Effective date: April 2026
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

          {/* Main statement */}
          <section
            className="bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8"
            aria-label="Our commitment"
          >
            <h2 className="text-lg font-extrabold text-foreground mb-4">
              Our Commitment to Your Privacy
            </h2>
            <p className="text-sm text-foreground leading-relaxed mb-4">
              <strong>Learnfyra does not sell, rent, or share your personal information</strong> with
              third parties for monetary consideration, other valuable consideration, or for targeted
              advertising purposes.
            </p>
            <p className="text-sm text-foreground leading-relaxed mb-4">
              This applies to all users of the Learnfyra platform, including students, teachers,
              parents, and tutors. We collect only the information needed to provide our educational
              service, and we keep it strictly for that purpose.
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              Because we do not sell or share personal information, there is nothing for you to
              opt out of. This page is provided as a transparency measure and to honor the spirit
              of the California Consumer Privacy Act (CCPA) and similar state privacy laws.
            </p>
          </section>

          {/* What we do not do */}
          <section
            className="bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8"
            aria-label="What we do not do"
          >
            <h2 className="text-lg font-extrabold text-foreground mb-4">
              What We Do Not Do
            </h2>
            <ul className="space-y-3">
              {[
                'Sell your personal information to data brokers or advertisers',
                'Share your personal information for targeted or behavioral advertising',
                'Rent your contact information to third parties for marketing',
                'Use student data to build advertising profiles',
                'Provide personal information to social media networks for ad targeting',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 w-5 h-5 rounded-full bg-secondary/15 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <svg
                      className="size-3 text-secondary"
                      fill="none"
                      viewBox="0 0 12 12"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  </span>
                  <span className="text-sm text-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Limited service providers */}
          <section
            className="bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8"
            aria-label="Service providers"
          >
            <h2 className="text-lg font-extrabold text-foreground mb-4">
              Limited Service Provider Sharing
            </h2>
            <p className="text-sm text-foreground leading-relaxed mb-4">
              We share minimal data with a small number of service providers who help us operate
              the platform. These providers are contractually bound to use your data only to
              perform services for us and are prohibited from using it for their own purposes.
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              For AI-powered worksheet generation, we use Anthropic's Claude API. We send only the
              grade level and subject you select — never your name, email, or any personal
              information — to generate worksheet content.
            </p>
          </section>

          {/* Your rights */}
          <section
            className="bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8"
            aria-label="Your rights"
          >
            <h2 className="text-lg font-extrabold text-foreground mb-4">
              Your California Privacy Rights
            </h2>
            <p className="text-sm text-foreground leading-relaxed mb-4">
              Under the California Consumer Privacy Act (CCPA), California residents have the right to:
            </p>
            <ul className="space-y-2 mb-4">
              {[
                'Know what personal information we collect and how we use it',
                'Request deletion of your personal information',
                'Opt out of the sale or sharing of your personal information (we do not sell or share)',
                'Non-discrimination for exercising your privacy rights',
              ].map((right) => (
                <li key={right} className="flex items-start gap-3">
                  <span className="text-primary font-bold text-sm shrink-0 mt-px">&#8250;</span>
                  <span className="text-sm text-foreground leading-relaxed">{right}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-foreground leading-relaxed">
              To exercise any of these rights, or to submit a data request on behalf of a child
              under 13, contact us at{' '}
              <a
                href="mailto:privacy@learnfyra.com"
                className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                privacy@learnfyra.com
              </a>
              . We will respond within 45 days as required by law.
            </p>
          </section>

          {/* Contact */}
          <section
            className="bg-primary-light rounded-2xl border border-primary/20 p-6 sm:p-8"
            aria-label="Contact information"
          >
            <h2 className="text-lg font-extrabold text-foreground mb-3">
              Contact Our Privacy Team
            </h2>
            <p className="text-sm text-foreground leading-relaxed mb-4">
              If you have questions about this page, our privacy practices, or wish to submit a
              data request, please reach out:
            </p>
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Email:</span>{' '}
                <a
                  href="mailto:privacy@learnfyra.com"
                  className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  privacy@learnfyra.com
                </a>
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Response time:</span> Within 45 days of receipt
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/privacy"
                className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                View Full Privacy Policy
              </Link>
              <span className="text-muted-foreground text-sm" aria-hidden="true">
                &middot;
              </span>
              <Link
                to="/terms"
                className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Terms of Service
              </Link>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DoNotSellPage;
