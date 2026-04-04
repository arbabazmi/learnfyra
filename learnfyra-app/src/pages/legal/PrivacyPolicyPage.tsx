/**
 * @file src/pages/legal/PrivacyPolicyPage.tsx
 * @description Privacy Policy page — COPPA + CCPA compliant.
 * Covers data collection, use, COPPA children's privacy, CCPA rights,
 * data retention, security, and contact information.
 * Static content page — no API calls required.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageMeta } from '@/lib/pageMeta';

// ── Reusable sub-components ──────────────────────────────────────────────────

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xl font-extrabold text-foreground mb-4 mt-10 first:mt-0 pt-6 first:pt-0 border-t border-border first:border-0">
    {children}
  </h2>
);

const Prose: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-foreground leading-relaxed mb-4 last:mb-0">{children}</p>
);

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2 mb-4">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-3">
        <span className="text-primary font-bold text-sm shrink-0 mt-px">&#8250;</span>
        <span className="text-sm text-foreground leading-relaxed">{item}</span>
      </li>
    ))}
  </ul>
);

const Highlight: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-primary-light border border-primary/20 rounded-xl p-4 my-4">
    <p className="text-sm text-foreground leading-relaxed">{children}</p>
  </div>
);

const ChildHighlight: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-4">
    <p className="text-sm text-foreground leading-relaxed">{children}</p>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────

const PrivacyPolicyPage: React.FC = () => {
  usePageMeta({
    title: 'Privacy Policy',
    description:
      'Read the Learnfyra Privacy Policy — COPPA and CCPA compliant. Learn how we collect, use, and protect your personal information.',
    keywords:
      'privacy policy, COPPA, CCPA, data collection, children privacy, personal information, Learnfyra',
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
                <Lock className="size-6 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-primary mb-1">
                  Legal
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                  Privacy Policy
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Last Updated:</span> April 2026
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Version:</span> 1.0
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 sm:p-10">

            <Prose>
              This Privacy Policy describes how Learnfyra ("we," "us," or "our") collects, uses,
              and protects information about you when you use the Learnfyra platform — an
              AI-powered educational worksheet service for students in Grades 1 through 10
              ("Service"). By using our Service, you agree to the practices described in this
              policy.
            </Prose>

            {/* 1. Information We Collect */}
            <SectionHeading>1. Information We Collect</SectionHeading>
            <Prose>We collect the following categories of information:</Prose>
            <BulletList
              items={[
                'Email address — used for account creation, login, and transactional communication',
                'Display name — the name shown within the platform (first name or chosen alias)',
                'Date of birth — collected solely for age verification to apply appropriate COPPA protections for users under 13',
                'Grade level (1–10) — used to generate age-appropriate worksheet content',
                'Worksheet answers and scores — your responses to practice worksheets and the resulting scores, stored to enable progress tracking and reporting',
                'Account creation method — whether you registered via email/password or Google OAuth',
              ]}
            />
            <Prose>
              We do not collect payment information, Social Security numbers, physical addresses,
              or phone numbers. We collect the minimum information necessary to provide the Service.
            </Prose>

            {/* 2. How We Use Your Information */}
            <SectionHeading>2. How We Use Your Information</SectionHeading>
            <BulletList
              items={[
                'Account management — creating and maintaining your account, authenticating your identity on login',
                'Educational content generation — your grade level and selected subject are sent to our AI provider to generate appropriate worksheets; no personal information is included',
                'Progress tracking — storing your worksheet scores over time to show you trends in your learning',
                'Streak and achievement features — tracking your activity to award badges and maintain learning streaks',
                'Transactional email — sending password reset emails, account confirmation, and material policy change notifications',
                'Service improvement — aggregated, anonymized analytics to understand how the platform is used and where it can be improved',
              ]}
            />
            <Prose>
              We do not use your information for marketing to third parties, behavioral advertising,
              or any purpose unrelated to providing the educational Service.
            </Prose>

            {/* 3. How We Share Your Information */}
            <SectionHeading>3. How We Share Your Information</SectionHeading>
            <Highlight>
              <strong>We do not sell, rent, or share your personal information</strong> with third
              parties for monetary consideration, advertising, or any commercial purpose. See our{' '}
              <Link to="/do-not-sell" className="text-primary font-semibold hover:underline">
                Do Not Sell page
              </Link>{' '}
              for more details.
            </Highlight>
            <Prose>
              We share information with a limited set of service providers strictly for operating
              the platform:
            </Prose>
            <BulletList
              items={[
                'Anthropic (AI provider) — receives only the grade level and subject you select to generate worksheet content; never receives your name, email, date of birth, or scores',
                'Amazon Web Services (AWS) — our cloud infrastructure provider; stores encrypted account data and worksheet files in the United States',
                'Authentication providers — if you sign in with Google, Google confirms your identity; we receive only your email and display name',
              ]}
            />
            <Prose>
              All service providers are contractually prohibited from using your data for their own
              purposes. We may also disclose information if required by law, court order, or to
              protect the safety of our users.
            </Prose>

            {/* 4. Children's Privacy (COPPA) */}
            <SectionHeading>4. Children's Privacy (COPPA Notice)</SectionHeading>
            <ChildHighlight>
              This section applies to users under the age of 13 and their parents or legal
              guardians. Learnfyra complies with the Children's Online Privacy Protection Act
              (COPPA).
            </ChildHighlight>
            <Prose>
              <strong>Verifiable Parental Consent.</strong> We do not knowingly collect personal
              information from children under 13 without verifiable parental consent. If a child
              under 13 registers for an account, we require a parent or legal guardian to provide
              consent before the account is activated.
            </Prose>
            <Prose>
              <strong>What we collect from children under 13.</strong> With parental consent, we
              collect only the minimum information necessary: a display name, grade level, and
              (optionally) an email address for account access. We do not collect date of birth
              in a way that is visible to other users.
            </Prose>
            <Prose>
              <strong>Parental rights.</strong> Parents and legal guardians may at any time:
            </Prose>
            <BulletList
              items={[
                'Review the personal information we have collected from their child',
                'Request a downloadable copy of their child\'s data',
                'Request deletion of their child\'s personal information',
                'Withdraw consent and have their child\'s account closed',
                'Refuse further collection or use of the child\'s information',
              ]}
            />
            <Prose>
              To exercise any of these rights, contact us at{' '}
              <a
                href="mailto:privacy@learnfyra.com"
                className="text-primary font-semibold hover:underline"
              >
                privacy@learnfyra.com
              </a>{' '}
              with the subject line "COPPA — Child Data Request." We will respond within 45 days.
            </Prose>
            <Prose>
              If we discover we have inadvertently collected personal information from a child under
              13 without parental consent, we will delete it promptly.
            </Prose>

            {/* 5. Data Retention */}
            <SectionHeading>5. Data Retention</SectionHeading>
            <BulletList
              items={[
                'Generated worksheets (PDF, DOCX, HTML files) — automatically deleted after 7 days from generation',
                'Worksheet scores and progress records — retained for the duration of your account, then deleted within 30 days of account closure',
                'Account information (email, display name, grade) — retained for the duration of your active account plus 30 days after account deletion to allow for reinstatement requests',
                'Audit and security logs — retained for 3 years to comply with security best practices and legal obligations',
                'Anonymized, aggregated analytics — retained indefinitely (contains no personal information)',
              ]}
            />

            {/* 6. Your Rights (CCPA) */}
            <SectionHeading>6. Your Rights (CCPA)</SectionHeading>
            <Prose>
              California residents have the following rights under the California Consumer Privacy
              Act (CCPA). Residents of other states may have similar rights under applicable state
              law.
            </Prose>
            <BulletList
              items={[
                'Right to Know — you may request a summary of the personal information we have collected about you, the categories of sources, the purposes for collection, and any third parties with whom we share it',
                'Right to Delete — you may request deletion of personal information we hold about you, subject to certain exceptions (such as completing a transaction or complying with legal obligations)',
                'Right to Opt Out of Sale — we do not sell personal information, so this right is already honored by default',
                'Right to Non-Discrimination — we will not deny you service, charge different prices, or provide a different quality of service because you exercised a privacy right',
              ]}
            />
            <Prose>
              To submit a rights request, email{' '}
              <a
                href="mailto:privacy@learnfyra.com"
                className="text-primary font-semibold hover:underline"
              >
                privacy@learnfyra.com
              </a>{' '}
              with the subject line "CCPA Rights Request." We will respond within 45 days. We may
              need to verify your identity before processing the request.
            </Prose>

            {/* 7. Security */}
            <SectionHeading>7. Security</SectionHeading>
            <Prose>
              We use industry-standard security measures to protect your information:
            </Prose>
            <BulletList
              items={[
                'Encryption in transit — all data transferred between your browser and our servers uses TLS (HTTPS)',
                'Encryption at rest — personal data stored on AWS is encrypted using AES-256',
                'Access controls — only authorized personnel and automated systems with a defined purpose can access user data',
                'Secrets management — API keys and credentials are stored in AWS Secrets Manager, never hardcoded',
                'Infrastructure isolation — each environment (development, staging, production) is fully isolated',
              ]}
            />
            <Prose>
              No system is perfectly secure. If you believe your account has been compromised,
              contact us immediately at{' '}
              <a
                href="mailto:privacy@learnfyra.com"
                className="text-primary font-semibold hover:underline"
              >
                privacy@learnfyra.com
              </a>
              .
            </Prose>

            {/* 8. Changes to This Policy */}
            <SectionHeading>8. Changes to This Policy</SectionHeading>
            <Prose>
              We may update this Privacy Policy from time to time to reflect changes in our
              practices or applicable law. For material changes, we will notify you by email at
              least 30 days before the change takes effect. Continued use of the Service after
              the effective date constitutes acceptance of the updated policy.
            </Prose>
            <Prose>
              Non-material updates (such as formatting corrections or clarifications that do not
              change the substance of our practices) will be noted with an updated "Last Updated"
              date at the top of this page.
            </Prose>

            {/* 9. Contact Us */}
            <SectionHeading>9. Contact Us</SectionHeading>
            <Prose>
              If you have questions, concerns, or requests related to this Privacy Policy or our
              data practices, please contact our privacy team:
            </Prose>
            <div className="bg-surface rounded-xl border border-border p-4 space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Privacy inquiries:</span>{' '}
                <a
                  href="mailto:privacy@learnfyra.com"
                  className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  privacy@learnfyra.com
                </a>
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">COPPA child data requests:</span>{' '}
                <a
                  href="mailto:privacy@learnfyra.com"
                  className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  privacy@learnfyra.com
                </a>{' '}
                — subject line: "COPPA — Child Data Request"
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">CCPA rights requests:</span>{' '}
                <a
                  href="mailto:privacy@learnfyra.com"
                  className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  privacy@learnfyra.com
                </a>{' '}
                — subject line: "CCPA Rights Request"
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Response time:</span> Within 45 days of receipt
              </p>
            </div>

            {/* Related links */}
            <div className="mt-8 pt-6 border-t border-border flex flex-wrap gap-4">
              <Link
                to="/do-not-sell"
                className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Do Not Sell My Personal Information
              </Link>
              <span className="text-muted-foreground text-sm" aria-hidden="true">&middot;</span>
              <Link
                to="/terms"
                className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Terms of Service
              </Link>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
