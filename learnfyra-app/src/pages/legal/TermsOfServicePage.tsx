/**
 * @file src/pages/legal/TermsOfServicePage.tsx
 * @description Terms of Service page for Learnfyra.
 * Covers acceptance, service description, accounts, AI content disclaimer,
 * intellectual property, liability, termination, and governing law.
 * Static content page — no API calls required.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { FileText } from 'lucide-react';
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

const BulletList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-2 mb-4">
    {items.map((item, i) => (
      // eslint-disable-next-line react/no-array-index-key
      <li key={i} className="flex items-start gap-3">
        <span className="text-primary font-bold text-sm shrink-0 mt-px">&#8250;</span>
        <span className="text-sm text-foreground leading-relaxed">{item}</span>
      </li>
    ))}
  </ul>
);

const Warning: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-4">
    <p className="text-sm text-foreground leading-relaxed">{children}</p>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────

const TermsOfServicePage: React.FC = () => {
  usePageMeta({
    title: 'Terms of Service',
    description:
      'Read the Learnfyra Terms of Service. Learn about acceptable use, AI-generated content, account responsibilities, and your rights as a user.',
    keywords:
      'terms of service, terms and conditions, acceptable use, AI content disclaimer, Learnfyra',
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
                <FileText className="size-6 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-primary mb-1">
                  Legal
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                  Terms of Service
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

            {/* 1. Acceptance of Terms */}
            <SectionHeading>1. Acceptance of Terms</SectionHeading>
            <Prose>
              These Terms of Service ("Terms") govern your access to and use of the Learnfyra
              website and platform (the "Service"), operated by Learnfyra ("we," "us," or "our").
              By creating an account, accessing the Service, or clicking "I agree," you confirm
              that you have read, understood, and agree to be bound by these Terms.
            </Prose>
            <Prose>
              If you are under 18, you represent that your parent or legal guardian has reviewed
              these Terms and consents to your use of the Service. If you do not agree to these
              Terms, you may not use the Service.
            </Prose>

            {/* 2. Description of Service */}
            <SectionHeading>2. Description of Service</SectionHeading>
            <Prose>
              Learnfyra is an AI-powered educational worksheet platform designed for K–10 students
              (Grades 1 through 10) in the United States. The Service allows users to:
            </Prose>
            <BulletList
              items={[
                'Generate printable and interactive practice worksheets aligned to U.S. curriculum standards (CCSS, NGSS)',
                'Solve worksheets online and receive instant automated scoring and feedback',
                'Track progress, scores, and learning streaks over time',
                'Download worksheets in PDF and DOCX formats for offline use or printing',
              ]}
            />
            <Prose>
              The Service is intended for educational practice and self-assessment. It is not a
              substitute for formal school instruction, credentialed tutoring, or official
              academic assessment.
            </Prose>

            {/* 3. User Accounts */}
            <SectionHeading>3. User Accounts</SectionHeading>
            <Prose>
              <strong>Age requirements.</strong> The Service is intended for students in Grades
              1–10 (typically ages 6–16). Users may be of any age, including teachers, tutors, and
              parents who access the Service on behalf of students.
            </Prose>
            <Prose>
              <strong>Parental consent for children under 13.</strong> In accordance with the
              Children's Online Privacy Protection Act (COPPA), children under 13 may only create
              an account with verifiable parental consent. Parents or legal guardians are
              responsible for supervising their child's use of the Service and for the accuracy
              of information provided during account creation.
            </Prose>
            <Prose>
              <strong>Account responsibilities.</strong> You are responsible for:
            </Prose>
            <BulletList
              items={[
                'Keeping your login credentials confidential and not sharing them with others',
                'All activity that occurs under your account',
                'Providing accurate and truthful information when creating or updating your account',
                'Notifying us immediately at support@learnfyra.com if you suspect unauthorized access to your account',
              ]}
            />
            <Prose>
              We reserve the right to suspend or terminate accounts that violate these Terms or
              that are used in a manner that harms other users or the integrity of the Service.
            </Prose>

            {/* 4. AI-Generated Content Disclaimer */}
            <SectionHeading>4. AI-Generated Content Disclaimer</SectionHeading>
            <Warning>
              <strong>Important:</strong> Worksheets, questions, answers, and explanations on
              Learnfyra are generated by an AI system (Anthropic Claude). While we strive for
              accuracy and curriculum alignment, AI-generated content may contain errors,
              inaccuracies, or outdated information.
            </Warning>
            <BulletList
              items={[
                'Content generated by AI may occasionally be incorrect, incomplete, or inconsistent with your school\'s specific curriculum',
                'Scores and feedback are provided for self-assessment and practice purposes only',
                'Scores do not constitute official academic records and should not be submitted as such to any school, institution, or organization',
                'Teachers and parents should review AI-generated content before relying on it for formal instruction',
                'We continuously work to improve the accuracy and quality of generated content, but we cannot guarantee it is error-free',
              ]}
            />
            <Prose>
              By using the Service, you acknowledge and accept that AI-generated content is
              provided "as is" for practice purposes, and that Learnfyra is not liable for any
              academic or educational decisions made based on that content.
            </Prose>

            {/* 5. Intellectual Property */}
            <SectionHeading>5. Intellectual Property</SectionHeading>
            <Prose>
              <strong>Our property.</strong> The Learnfyra platform, including its software,
              design, trademarks, logos, and the underlying AI prompting and scoring systems, are
              owned by or licensed to Learnfyra. Nothing in these Terms grants you ownership of
              any Learnfyra intellectual property.
            </Prose>
            <Prose>
              <strong>Your input data.</strong> You retain ownership of the input data you provide
              to generate worksheets (such as the grade level and subject you select). By using
              the Service, you grant Learnfyra a limited, non-exclusive license to use that input
              data for the sole purpose of generating content and providing the Service to you.
            </Prose>
            <Prose>
              <strong>Generated worksheets.</strong> Worksheets generated through the Service are
              provided to you for personal educational use. You may download, print, and share
              worksheets for non-commercial educational purposes. You may not resell, republish,
              or commercially distribute worksheets generated by the Service.
            </Prose>

            {/* 6. Limitation of Liability */}
            <SectionHeading>6. Limitation of Liability</SectionHeading>
            <Prose>
              To the maximum extent permitted by applicable law, Learnfyra and its officers,
              directors, employees, agents, and licensors shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including but not limited
              to loss of data, loss of educational opportunity, or reliance on AI-generated
              content, even if Learnfyra has been advised of the possibility of such damages.
            </Prose>
            <Prose>
              In no event shall Learnfyra's total liability to you for all claims arising out of
              or relating to the Service exceed the greater of (a) the amount you paid for the
              Service in the 12 months preceding the claim, or (b) $50 USD.
            </Prose>
            <Prose>
              The Service is provided "as is" and "as available" without warranties of any kind,
              express or implied, including warranties of merchantability, fitness for a particular
              purpose, or non-infringement.
            </Prose>

            {/* 7. Termination */}
            <SectionHeading>7. Termination</SectionHeading>
            <Prose>
              <strong>By you.</strong> You may close your account at any time by going to Settings
              and selecting "Delete Account," or by contacting us at support@learnfyra.com. Upon
              closure, your personal data will be deleted in accordance with our{' '}
              <Link to="/privacy" className="text-primary font-semibold hover:underline">
                Privacy Policy
              </Link>
              .
            </Prose>
            <Prose>
              <strong>By us.</strong> We reserve the right to suspend or terminate your access to
              the Service at any time, with or without notice, for conduct that violates these
              Terms, is harmful to other users, or that we believe is fraudulent or illegal.
            </Prose>
            <Prose>
              Upon termination for any reason, your right to access the Service immediately
              ceases. Provisions of these Terms that by their nature should survive termination
              (including Sections 4, 5, 6, and 8) will survive.
            </Prose>

            {/* 8. Governing Law */}
            <SectionHeading>8. Governing Law</SectionHeading>
            <Prose>
              These Terms are governed by and construed in accordance with the laws of the United
              States, without regard to conflict of law provisions. Any disputes arising under
              these Terms shall be subject to the exclusive jurisdiction of the courts of the
              United States.
            </Prose>
            <Prose>
              If any provision of these Terms is found to be unenforceable, the remaining
              provisions will remain in full force and effect.
            </Prose>

            {/* 9. Changes to Terms */}
            <SectionHeading>9. Changes to These Terms</SectionHeading>
            <Prose>
              We may update these Terms from time to time. For material changes, we will notify
              you by email at least 30 days before the new Terms take effect. Continued use of
              the Service after the effective date of updated Terms constitutes your acceptance
              of the changes.
            </Prose>

            {/* 10. Contact */}
            <SectionHeading>10. Contact Us</SectionHeading>
            <Prose>
              If you have questions about these Terms or need support, please contact us:
            </Prose>
            <div className="bg-surface rounded-xl border border-border p-4 space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-semibold">General support:</span>{' '}
                <a
                  href="mailto:support@learnfyra.com"
                  className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  support@learnfyra.com
                </a>
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Privacy and data requests:</span>{' '}
                <a
                  href="mailto:privacy@learnfyra.com"
                  className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  privacy@learnfyra.com
                </a>
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Response time:</span> Within 5 business days
              </p>
            </div>

            {/* Related links */}
            <div className="mt-8 pt-6 border-t border-border flex flex-wrap gap-4">
              <Link
                to="/privacy"
                className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Privacy Policy
              </Link>
              <span className="text-muted-foreground text-sm" aria-hidden="true">&middot;</span>
              <Link
                to="/do-not-sell"
                className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Do Not Sell My Personal Information
              </Link>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfServicePage;
