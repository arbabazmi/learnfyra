/**
 * @file src/pages/DashboardPage.tsx
 * @description Student dashboard — guest mode with sample data + watermarks,
 * logged-in mode with real API data.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import { LogIn } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { SampleDataBanner } from '@/components/dashboard/SampleDataBanner';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { RecentWorksheets } from '@/components/dashboard/RecentWorksheets';
import { SubjectProgress } from '@/components/dashboard/SubjectProgress';
import { GenerateWorksheetBanner } from '@/components/dashboard/GenerateWorksheetBanner';
import { useDashboard } from '@/hooks/useDashboard';
import { usePageMeta } from '@/lib/pageMeta';

const DashboardPage: React.FC = () => {
  const dashboard = useDashboard();
  const navigate = useNavigate();

  const handleSignIn = () => navigate('/');

  usePageMeta({
    title: 'Dashboard',
    description: 'Your Learnfyra dashboard — view completed worksheets, track scores, and start new practice sessions.',
    keywords: 'student dashboard, worksheet progress, learning tracker',
  });

  return (
    <AppLayout pageTitle="Dashboard">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* Sample data banner — guest only */}
        <SampleDataBanner isGuest={dashboard.isGuest} onSignIn={handleSignIn} />

        {/* Welcome banner */}
        <WelcomeBanner
          greeting={dashboard.greeting}
          userName={dashboard.userName}
          worksheetCount={dashboard.stats.inProgress}
          isGuest={dashboard.isGuest}
        />

        {/* Stats row */}
        <section aria-label="Statistics">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Your Stats
          </h2>
          <StatsRow stats={dashboard.stats} isLoading={dashboard.isLoading} isGuest={dashboard.isGuest} />
        </section>

        {/* Two-column: recent worksheets + subject progress */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
          <RecentWorksheets
            worksheets={dashboard.recentWorksheets}
            isGuest={dashboard.isGuest}
            isLoading={dashboard.isLoading}
          />
          <SubjectProgress
            progress={dashboard.subjectProgress}
            isLoading={dashboard.isLoading}
          />
        </div>

        {/* Generate worksheet CTA */}
        <GenerateWorksheetBanner isGuest={dashboard.isGuest} />

      </div>

      {/* Floating sign-in button — guest only */}
      {dashboard.isGuest && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            variant="primary"
            size="lg"
            className="gap-2 shadow-xl rounded-full px-6"
            onClick={handleSignIn}
          >
            <LogIn className="size-4" />
            Sign In
          </Button>
        </div>
      )}
    </AppLayout>
  );
};

export default DashboardPage;
