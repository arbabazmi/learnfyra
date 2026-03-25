/**
 * @file frontend/js/rewards.js
 * @description Reward display utilities for Learnfyra
 */

/**
 * Render the reward summary (points earned, streak, new badges, gaming warning)
 * after a worksheet submission.
 * @param {Object} rewards - The rewards object from /api/progress/save response
 * @param {HTMLElement} container - The element to render into (will be unhidden)
 */
export function renderRewardSummary(rewards, container) {
  if (!rewards || !container) return;

  const { pointsEarned, totalPoints, newBadges, currentStreak, freezeTokens, gamingWarning } = rewards;

  let html = '<div class="reward-summary">';
  html += '<h3 class="reward-summary__title">&#11088; Your Rewards</h3>';

  // Gaming warning
  if (gamingWarning) {
    const msg = gamingWarning === 'RANDOM_PATTERN' || gamingWarning === 'ALTERNATING_PATTERN'
      ? '&#9888;&#65039; Take your time and read each question carefully. No points awarded for this submission.'
      : '&#9888;&#65039; Submission was too fast. No points awarded. Please take your time.';
    html += `<p class="gaming-warning">${msg}</p>`;
  }

  // Points
  html += `<div class="points-earned">+${pointsEarned ?? 0} pts</div>`;
  html += `<p class="points-total">Lifetime total: ${totalPoints ?? 0} pts</p>`;

  // Streak
  if (currentStreak > 0) {
    html += `<div class="streak-display">&#128293; <span class="streak-display__count">${currentStreak}</span> day streak`;
    if (freezeTokens > 0) {
      html += `&nbsp;<span class="freeze-tokens">${'&#10052;&#65039;'.repeat(Math.min(freezeTokens, 3))}</span>`;
    }
    html += '</div>';
  }

  // New badges
  if (newBadges && newBadges.length > 0) {
    html += `<h4 style="font-family:var(--font-display);font-size:1rem;font-weight:800;margin:var(--space-3) 0 var(--space-2);">&#127885; New Badges Unlocked!</h4>`;
    html += '<div class="badge-grid">';
    for (const badge of newBadges) {
      html += `<div class="badge-card badge-card--new">
        <span class="badge-card__emoji">${badge.emoji}</span>
        <span class="badge-card__name">${badge.name}</span>
        <span class="badge-card__desc">${badge.description}</span>
      </div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
  container.hidden = false;
}

/**
 * Render the student's full badge collection.
 * @param {Array} badges - Array of badge objects { id, name, emoji, description, earnedAt }
 * @param {HTMLElement} container
 */
export function renderBadgeCollection(badges, container) {
  if (!container) return;
  if (!badges || badges.length === 0) {
    container.innerHTML = '<p class="empty-state">No badges yet \u2014 complete worksheets to earn your first badge!</p>';
    return;
  }
  let html = '<div class="badge-grid">';
  for (const badge of badges) {
    html += `<div class="badge-card">
      <span class="badge-card__emoji">${badge.emoji}</span>
      <span class="badge-card__name">${badge.name}</span>
      <span class="badge-card__desc">${badge.description}</span>
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Render the streak display widget.
 * @param {{ currentStreak: number, longestStreak: number, freezeTokens: number }} streakData
 * @param {HTMLElement} container
 */
export function renderStreakDisplay(streakData, container) {
  if (!container) return;
  const { currentStreak = 0, longestStreak = 0, freezeTokens = 0 } = streakData || {};
  if (currentStreak === 0) {
    container.innerHTML = '<p class="empty-state">Start your streak \u2014 complete a worksheet today!</p>';
    return;
  }
  container.innerHTML = `
    <div class="streak-display">
      &#128293; <span class="streak-display__count">${currentStreak}</span> day streak
      ${freezeTokens > 0 ? `<span class="freeze-tokens">${'&#10052;&#65039;'.repeat(Math.min(freezeTokens, 3))}</span>` : ''}
    </div>
    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:var(--space-1);">Longest streak: ${longestStreak} days</p>
  `;
}
