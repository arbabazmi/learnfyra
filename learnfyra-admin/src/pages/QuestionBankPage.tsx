/**
 * @file src/pages/QuestionBankPage.tsx
 * @description Browse, filter, flag, and soft-delete AI-generated questions.
 */

import { useState } from 'react';
import { Flag, FlagOff, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { Question, QuestionListResponse, QuestionStatus } from '@/types';

const statusBadge: Record<QuestionStatus, 'success' | 'warning' | 'destructive'> = {
  active: 'success',
  flagged: 'warning',
  deleted: 'destructive',
};

export function QuestionBankPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [actionTarget, setActionTarget] = useState<{ question: Question; action: 'flag' | 'unflag' | 'delete' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading, refetch } = useApi<QuestionListResponse>(
    () => api.getQuestions({
      status: (statusFilter || undefined) as QuestionStatus | undefined,
      grade: gradeFilter ? Number(gradeFilter) : undefined,
      subject: subjectFilter || undefined,
    }),
    [statusFilter, gradeFilter, subjectFilter]
  );

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const { question, action } = actionTarget;
      if (action === 'flag') await api.flagQuestion(question.questionId);
      else if (action === 'unflag') await api.unflagQuestion(question.questionId);
      else if (action === 'delete') await api.softDeleteQuestion(question.questionId);
      toast(`Question ${action === 'delete' ? 'deleted' : action === 'flag' ? 'flagged' : 'unflagged'}`, 'success');
      setActionTarget(null);
      refetch();
    } catch { toast('Action failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const columns: Column<Question>[] = [
    {
      key: 'question',
      header: 'Question',
      render: (q) => <p className="text-sm max-w-md truncate">{q.question}</p>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (q) => <Badge variant="muted">{q.type}</Badge>,
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (q) => <span className="text-sm">{q.grade}</span>,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (q) => <span className="text-sm">{q.subject}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (q) => <Badge variant={statusBadge[q.status]}>{q.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (q) => (
        <div className="flex gap-1">
          {q.status === 'active' && (
            <Button variant="ghost" size="icon-sm" onClick={() => setActionTarget({ question: q, action: 'flag' })} title="Flag">
              <Flag className="size-4 text-amber-500" />
            </Button>
          )}
          {q.status === 'flagged' && (
            <Button variant="ghost" size="icon-sm" onClick={() => setActionTarget({ question: q, action: 'unflag' })} title="Unflag">
              <FlagOff className="size-4 text-green-500" />
            </Button>
          )}
          {q.status !== 'deleted' && (
            <Button variant="ghost" size="icon-sm" onClick={() => setActionTarget({ question: q, action: 'delete' })} title="Delete">
              <Trash2 className="size-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Question Bank</h2>
        <p className="text-muted-foreground text-sm mt-1">Review and moderate generated questions</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.questions ?? []}
        isLoading={isLoading}
        hasMore={!!data?.lastKey}
        filters={
          <>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-32">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="flagged">Flagged</option>
              <option value="deleted">Deleted</option>
            </Select>
            <Select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="w-28">
              <option value="">All Grades</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Grade {i + 1}</option>
              ))}
            </Select>
            <Select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="w-36">
              <option value="">All Subjects</option>
              <option value="Math">Math</option>
              <option value="ELA">ELA</option>
              <option value="Science">Science</option>
              <option value="Social Studies">Social Studies</option>
              <option value="Health">Health</option>
            </Select>
          </>
        }
        emptyTitle="No questions found"
        emptyDescription="Try adjusting your filters."
      />

      {actionTarget && (
        <ConfirmModal
          open={!!actionTarget}
          onClose={() => setActionTarget(null)}
          onConfirm={handleAction}
          title={
            actionTarget.action === 'flag' ? 'Flag Question' :
            actionTarget.action === 'unflag' ? 'Unflag Question' :
            'Delete Question'
          }
          description={
            actionTarget.action === 'delete'
              ? 'This will soft-delete the question. It will no longer appear in generated worksheets.'
              : actionTarget.action === 'flag'
                ? 'Flagged questions will be excluded from worksheet generation within 60 seconds.'
                : 'This will restore the question to active status.'
          }
          confirmText={actionTarget.action === 'delete' ? 'Delete' : actionTarget.action === 'flag' ? 'Flag' : 'Unflag'}
          variant={actionTarget.action === 'delete' ? 'danger' : 'warning'}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
