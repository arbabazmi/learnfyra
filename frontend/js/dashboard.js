/**
 * @file frontend/js/dashboard.js
 * @description Dashboard data-fetching and rendering for student and teacher views.
 * Imported as an ES module by student/dashboard.html and teacher/dashboard.html.
 */

import { apiRequest, getUser, redirectIfNotAuth } from './auth.js';
import { renderBadgeCollection, renderStreakDisplay } from './rewards.js';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function scoreClass(pct) {
  if (pct >= 80) return 'great';
  if (pct >= 60) return 'ok';
  return 'poor';
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------
// Student Dashboard
// ---------------------------------------------------------------

export async function loadStudentDashboard() {
  redirectIfNotAuth();
  const user = getUser();

  // Welcome text
  const nameEl = document.getElementById('welcomeName');
  if (nameEl) nameEl.textContent = user?.displayName || user?.email || 'Student';

  // Avatar initials
  const avatarEl = document.getElementById('welcomeAvatar');
  if (avatarEl) avatarEl.textContent = initials(user?.displayName || user?.email || 'S');

  // Load history from API
  try {
    const data = await apiRequest('/api/progress/history');
    const attempts = data.attempts || [];
    renderAttemptHistory(attempts);
    renderSubjectBreakdown(attempts);
    renderStudentStats(attempts);
  } catch (err) {
    console.error('Failed to load student progress:', err);
    // Show empty states gracefully — no crash
    renderAttemptHistory([]);
    renderSubjectBreakdown([]);
    renderStudentStats([]);
  }

  // Load rewards data (badges + streak)
  try {
    const rewardsData = await apiRequest(`/api/rewards/student/${user.userId}`);
    renderBadgeCollection(rewardsData.badges || [], document.getElementById('badgeCollection'));
    renderStreakDisplay(rewardsData, document.getElementById('streakDisplay'));
  } catch (e) {
    console.error('Failed to load rewards:', e);
  }
}

export function renderStudentStats(attempts) {
  const totalEl   = document.getElementById('statTotal');
  const avgEl     = document.getElementById('statAvg');
  const bestEl    = document.getElementById('statBest');
  const streakEl  = document.getElementById('statStreak');

  if (!totalEl) return;

  const total = attempts.length;
  const avg   = total > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / total)
    : 0;
  const best  = total > 0
    ? Math.max(...attempts.map((a) => a.percentage || 0))
    : 0;

  totalEl.textContent  = total;
  if (avgEl)    avgEl.textContent    = avg + '%';
  if (bestEl)   bestEl.textContent   = best + '%';
  if (streakEl) streakEl.textContent = computeStreak(attempts);

  // Apply color classes to stat cards
  const avgCard = document.getElementById('statCardAvg');
  if (avgCard) {
    avgCard.className = avgCard.className.replace(/stat-card--\w+/, '');
    avgCard.classList.add('stat-card', 'stat-card--' + scoreClass(avg));
  }
}

function computeStreak(attempts) {
  // Count consecutive days with at least one attempt, ending today
  if (!attempts.length) return 0;
  const days = new Set(
    attempts.map((a) => a.submittedAt ? new Date(a.submittedAt).toDateString() : null).filter(Boolean)
  );
  let streak = 0;
  const d = new Date();
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function renderAttemptHistory(attempts) {
  const container = document.getElementById('attemptHistoryList');
  if (!container) return;

  if (!attempts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">&#128196;</span>
        No attempts yet.
        <span class="empty-state-hint">Generate a worksheet on the home page to get started!</span>
      </div>`;
    return;
  }

  const recent = attempts.slice(0, 10);

  const rows = recent.map((a) => {
    const pct   = a.percentage ?? 0;
    const cls   = scoreClass(pct);
    const score = a.totalScore != null ? `${a.totalScore}/${a.totalPoints}` : '—';
    return `
      <tr class="attempt-row">
        <td>${escapeHtml(a.subject || '—')}</td>
        <td>${escapeHtml(a.topic   || '—')}</td>
        <td>Grade ${escapeHtml(String(a.grade || '—'))}</td>
        <td>
          <span class="score-badge score-badge--${cls}">${pct}% (${score})</span>
        </td>
        <td>${formatDate(a.submittedAt)}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="attempt-table-wrap">
      <table class="attempt-table" aria-label="Recent worksheet attempts">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Topic</th>
            <th>Grade</th>
            <th>Score</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function renderSubjectBreakdown(attempts) {
  const container = document.getElementById('subjectBreakdown');
  if (!container) return;

  if (!attempts.length) {
    container.innerHTML = '<p class="empty-state" style="padding:var(--space-6)">No data yet.</p>';
    return;
  }

  // Group by subject and compute average
  const bySubject = {};
  for (const a of attempts) {
    const s = a.subject || 'Other';
    if (!bySubject[s]) bySubject[s] = [];
    bySubject[s].push(a.percentage || 0);
  }

  const cards = Object.entries(bySubject).map(([subject, pcts]) => {
    const avg = Math.round(pcts.reduce((sum, p) => sum + p, 0) / pcts.length);
    const cls = scoreClass(avg);
    return `
      <div class="subject-stat">
        <div class="subject-name">${escapeHtml(subject)}</div>
        <div class="subject-avg" style="color:var(--color-${cls === 'great' ? 'leaf' : cls === 'ok' ? 'sun' : 'coral'}-dark)">${avg}%</div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="subject-breakdown">${cards}</div>`;
}

// ---------------------------------------------------------------
// Teacher Dashboard
// ---------------------------------------------------------------

export async function loadTeacherDashboard() {
  redirectIfNotAuth();
  const user = getUser();

  // Redirect if not teacher/parent role
  if (user && user.role === 'student') {
    window.location.href = '/student/dashboard.html';
    return;
  }

  const nameEl = document.getElementById('welcomeName');
  if (nameEl) nameEl.textContent = user?.displayName || user?.email || 'Teacher';

  const avatarEl = document.getElementById('welcomeAvatar');
  if (avatarEl) avatarEl.textContent = initials(user?.displayName || user?.email || 'T');

  // Classes list — placeholder until GET /api/class is defined
  const classListEl = document.getElementById('classListContainer');
  if (classListEl) {
    classListEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">&#127979;</span>
        No classes yet.
        <span class="empty-state-hint">Create your first class using the button above.</span>
      </div>`;
  }

  // Wire up create class modal
  wireCreateClassModal();
}

function wireCreateClassModal() {
  const openBtn   = document.getElementById('openCreateClassBtn');
  const overlay   = document.getElementById('createClassModal');
  const closeBtn  = document.getElementById('closeClassModalBtn');
  const form      = document.getElementById('createClassForm');
  const success   = document.getElementById('inviteCodeSuccess');
  const codeEl    = document.getElementById('generatedInviteCode');

  if (!overlay) return;

  const openModal  = () => { overlay.hidden = false; };
  const closeModal = () => {
    overlay.hidden = true;
    if (success) success.hidden = true;
    if (form) form.reset();
  };

  if (openBtn)  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Close on overlay click (outside the modal card)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const className = document.getElementById('classNameInput')?.value.trim();
    const grade     = document.getElementById('classGradeInput')?.value.trim();
    const subject   = document.getElementById('classSubjectInput')?.value.trim();

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating…'; }

    try {
      const data = await apiRequest('/api/class', {
        method: 'POST',
        body: JSON.stringify({ className, grade, subject }),
      });

      // Show the generated invite code
      if (codeEl)    codeEl.textContent = data.inviteCode || 'N/A';
      if (success)   success.hidden = false;

      // Reload class list
      await loadTeacherDashboard();
    } catch (err) {
      console.error('Failed to create class:', err);
      alert(err.data?.error || err.message || 'Failed to create class. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Class'; }
    }
  });
}

// ---------------------------------------------------------------
// Utility
// ---------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
