# Learnfyra Reward-Based Engagement System — UX Specification
**Version:** 1.0  
**Date:** March 24, 2026  
**Status:** Design Proposal — No Code  
**Owner:** UI/UX Agent  

---

## Design Philosophy

Learnfyra's reward system follows three core principles:

1. **Learning-First, Not Gamification-First**  
   - Rewards celebrate actual mastery and effort, not just completion
   - No addictive mechanics — we're building study habits, not Candy Crush
   - Progress is always visible, never hidden behind "loot boxes" or random rewards

2. **Parent & Teacher Approved**  
   - Transparent metrics — adults can see exactly what's being rewarded
   - No distracting animations during work time
   - Celebrations happen at natural breakpoints (after submit, after review)
   - Optional "Focus Mode" to hide all reward UI during practice

3. **Inclusive & Accessible**  
   - Rewards are not punitive — struggling students still earn progress
   - Multiple reward types (visual, textual, auditory cues) for different learners
   - Color-blind safe palettes, screen reader friendly
   - Never shame low scores — always frame as "keep practicing!"

---

## Competitive Landscape Analysis

### What edusheets.io Does:
- Dashboard with per-student analytics
- Standards coverage tracking
- "Smart Review" personalized practice
- **NOT doing:** visible rewards, badges, points, celebrations

### What edusheethub.com Does:
- Content marketing, blog, shop
- **NOT doing:** any digital tracking or engagement features

### Learnfyra's Opportunity:
Create the first **educationally-sound, parent-approved reward system** in the worksheet space that:
- Motivates students without manipulation
- Gives teachers actionable insights
- Makes parents feel good about screen time

---

## 1. Screen/Section Inventory

### 1.1 Student Dashboard (New — Primary Reward Surface)
```
┌──────────────────────────────────────────────────────────────┐
│  STUDENT DASHBOARD                                   [Focus] │
│                                                              │
│  Hi Alex! 👋                                 Streak: 5 days  │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ┌─ Quick Stats ────────────────────────────────────────┐  │
│  │  📊 12 worksheets completed this week                │  │
│  │  ⏱️  Total practice time: 3h 24m                      │  │
│  │  ✅ 87% average score                                │  │
│  │  🎯 4/5 weekly goals met                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Current Progress ──────────────────────────────────┐   │
│  │  Grade 5 Math — Fractions                           │   │
│  │  [████████████████░░░░░░░░░░] 65% complete          │   │
│  │  Next: Comparing Fractions                          │   │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Recent Activity ───────────────────────────────────┐   │
│  │  📝 Multiplication Practice         8/10  🌟🌟🌟    │   │
│  │  📝 Word Problems                   10/10 ⭐⭐⭐⭐   │   │
│  │  📝 Division with Remainders        6/10  🌟🌟      │   │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Achievements ──────────────────────────────────────┐   │
│  │  🏆 Math Master (12/50 stars)   [View All →]        │   │
│  │  [⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐░░░░...]                       │   │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Start New Practice] [Review Mistakes] [View All Stats]    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Solve Page — During Worksheet (Minimal Interruption)
- **Header bar:** Current streak icon (static, no animation)
- **Progress indicator:** Question counter (5/10) 
- **Timer display** (if timed mode) — changes color as time gets low
- **NO reward UI during active work** — all celebrations happen AFTER submit

### 1.3 Results Page — Primary Celebration Surface
```
┌──────────────────────────────────────────────────────────────┐
│                    ✨ Worksheet Complete! ✨                  │
│                                                              │
│                          85%                                 │
│                       ────────                               │
│                   You got 17/20!                             │
│                                                              │
│  🌟 +10 stars earned  •  ⚡ 5-day streak maintained          │
│                                                              │
│  ┌─ What You Earned ─────────────────────────────────────┐ │
│  │  🏅 Quick Thinker (completed in 12 min)               │ │
│  │  🎯 Fraction Expert (level 2 → level 3)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Progress to next level: [████████░░] 80%                   │
│                                                              │
│  ┌─ Review Your Work ────────────────────────────────────┐ │
│  │  Question 1:  ✅ Correct    +1 star                   │ │
│  │  Question 2:  ❌ Incorrect  Keep practicing!          │ │
│  │  Question 3:  ✅ Correct    +1 star                   │ │
│  │  ...                                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Try Another] [Review Mistakes] [Back to Dashboard]        │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Teacher Dashboard (New — Insights & Controls)
```
┌──────────────────────────────────────────────────────────────┐
│  TEACHER DASHBOARD                                           │
│                                                              │
│  Mrs. Johnson's Class • Grade 3 Math                         │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ┌─ Class Overview ──────────────────────────────────────┐  │
│  │  👥 24 students  •  📊 18 active this week             │  │
│  │  📈 Class average: 82%  •  🎯 78% standards coverage  │  │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Student Engagement ──────────────────────────────────┐  │
│  │  High:      12 students  (5+ worksheets/week)         │  │
│  │  Moderate:   8 students  (2-4 worksheets/week)        │  │
│  │  Low:        4 students  (0-1 worksheets/week)        │  │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Recent Student Activity ─────────────────────────────┐  │
│  │  Alex M.     Multiplication Practice    10/10  ⭐⭐⭐⭐ │  │
│  │  Emma L.     Word Problems              8/10   🌟🌟🌟  │  │
│  │  Jordan P.   Division Basics            6/10   🌟🌟    │  │
│  │  [Needs attention 🔔]                                  │  │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Standards Progress ──────────────────────────────────┐  │
│  │  CCSS.MATH.3.OA.C.7  Multiplication facts [██████░░]  │  │
│  │  CCSS.MATH.3.NF.A.1  Fractions          [████░░░░░░]  │  │
│  │  [View full standards map →]                          │  │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Controls:                                                   │
│  □ Enable reward system for this class                      │
│  □ Show student leaderboards (rank by improvement)          │
│  □ Send weekly progress emails to parents                   │
│                                                              │
│  [Assign Worksheet] [View Full Reports] [Parent Portal]     │
└──────────────────────────────────────────────────────────────┘
```

### 1.5 Parent View (Read-Only Dashboard)
- Simplified version of student dashboard
- Shows child's progress, recent scores, time spent
- NO ability to see other students (privacy)
- Weekly email digest with celebration highlights
- Access via unique parent code (no login required for quick checks)

---

## 2. Reward Surfaces — Where to Show Points, Badges, Progress

### 2.1 Primary Reward Currency: ⭐ Stars

**Why stars?**
- Universally understood by ages 6-16
- Already associated with quality/achievement in education
- Can be displayed as emoji (⭐ vs 🌟 for visual hierarchy)
- Works in any color scheme (gold, white, outlined)

**How stars are earned:**
```
Per worksheet completion:
  - 1 star per correct answer (e.g., 8/10 quiz = 8 stars)
  - Bonus stars for achievements:
    • Speed bonus:     +2 stars (completed quickly without rushing)
    • Perfect score:   +5 stars (10/10)
    • Streak bonus:    +1 star per day (up to +7 for weekly streak)
    • Comeback bonus:  +3 stars (improved score on retry)
    • First try:       +2 stars (first worksheet of new topic)

Total possible per worksheet: ~1-20 stars depending on length and performance
```

**Star display hierarchy:**
```
⭐ Filled gold star   = full point earned
🌟 Glowing star      = bonus/special achievement
⭐ (outlined)        = not yet earned / locked
```

### 2.2 Secondary Reward: Achievement Badges

**Badge categories (6 families):**

1. **📚 Subject Mastery Badges**  
   - "Multiplication Master" — complete 10 multiplication worksheets with 80%+  
   - "Word Problem Wizard" — solve 15 word problems correctly  
   - "Fraction Fanatic" — master all fraction topics for your grade  
   - Always tied to curriculum standards (CCSS alignment visible to teachers)

2. **⚡ Habit Badges**  
   - "5-Day Streak" → "10-Day Streak" → "30-Day Dynamo"  
   - "Early Bird" — complete 5 worksheets before 10am  
   - "Weekend Warrior" — practice 2x on weekends  

3. **🎯 Improvement Badges**  
   - "Comeback Kid" — retake a worksheet and improve by 30%  
   - "Growth Mindset" — attempt a harder difficulty level  
   - "Practice Makes Perfect" — retry the same topic 3 times  

4. **⏱️ Efficiency Badges**  
   - "Speed Reader" — complete ahead of estimated time (with 70%+ accuracy)  
   - "Focus Champion" — no pause/distraction in timed mode  

5. **🏆 Milestone Badges**  
   - "First Worksheet!" — complete your first worksheet  
   - "Century Star" — earn 100 total stars  
   - "Grade Champion" — master 80% of grade-level standards  

6. **🤝 Encouragement Badges (for struggling students)**  
   - "Never Give Up" — complete 5 worksheets even with low scores  
   - "Brave Learner" — attempt 3 topics outside your comfort zone  
   - "Question Asker" — [future: when help feature exists]  

**Badge display rules:**
- Earned badges show in full color on dashboard
- Locked badges show as grayscale outlines with unlock condition
- Badges are NOT ranked — no "rare epic legendary" tiers (avoids FOMO)
- Max 3 badges per completion (prevents overwhelm)

### 2.3 Progress Bars & Skill Trees

**Topic Progress (per-subject):**
```
Grade 5 Math — Fractions
┌───────────────────────────────────────┐
│ 1. Understanding Fractions      ✅    │
│ 2. Comparing Fractions          ⏳ 3/5│
│ 3. Adding Fractions             🔒    │
│ 4. Subtracting Fractions        🔒    │
│ 5. Multiplying Fractions        🔒    │
└───────────────────────────────────────┘

✅ = Mastered (80%+ on 3+ worksheets)
⏳ = In Progress (1-2 worksheets attempted)
🔒 = Locked (previous topics not mastered)
```

**Standards Coverage (for teachers):**
- Visual map of CCSS/NGSS standards
- Heatmap showing which standards have been practiced
- Red/yellow/green color coding for coverage depth

**Level System (Optional — Teacher Toggle):**
```
Student Level: 12 "Math Explorer"
[████████████░░░░░░░░] 234/300 stars to Level 13

Levels unlock new avatar decorations (not locked features)
Level names are aspirational, not competitive:
  - Level 1-5:   "Math Learner"
  - Level 6-10:  "Math Explorer"
  - Level 11-15: "Math Expert"
  - Level 16+:   "Math Mentor"
```

### 2.4 Streaks (The Most Powerful Motivator)

**Daily Practice Streak:**
- Visible on every page as a small flame icon: 🔥 5
- Breaks if student doesn't complete at least 1 worksheet per day
- **Weekend grace period:** Streak doesn't break on weekends (configurable by teacher)
- **Sick pass:** If student misses 1-2 days, they can "restore streak" with a comeback worksheet

**Streak display evolution:**
```
Days 1-2:   🔥 2  (gray flame, minimal emphasis)
Days 3-6:   🔥 5  (orange flame, growing)
Days 7-13:  🔥7+ (yellow flame, weekly milestone reached)
Days 14+:   🔥14 (gold flame, "You're on fire!" message once/week)
```

**Why streaks work:**
- Visual, easy to understand
- Creates a "don't break the chain" habit loop
- Feels personal (not compared to others)
- Grace periods prevent frustration

---

## 3. Notification & Microcelebration Patterns

### 3.1 Design Principles for Notifications

**The "No Dings During Dinner" Rule:**
- NO notifications during active worksheet solving
- NO push notifications to student devices
- NO pop-ups that interrupt thinking
- ALL celebrations happen at natural breakpoints

**The "One Celebration, One Focus" Rule:**
- Each completion shows max 1-2 reward animations
- Rest of rewards visible as static elements (user scrolls to see)
- No cascading/chaining rewards (prevents dopamine slot-machine effect)

**The "Parent in the Room" Rule:**
- Every notification should be something you'd be proud to show a parent
- No manipulative "you're falling behind!" messaging
- No comparison to other students (optional teacher-controlled leaderboard only)

### 3.2 Celebration Moments (When to Show Rewards)

| Trigger | Celebration Type | Example |
|---------|------------------|---------|
| **Worksheet submitted** | 🎉 Large score reveal + star count | "85%! You earned 10 stars!" |
| **Perfect score** | ⭐ Bonus star burst | "+5 bonus stars! Perfect score!" |
| **New badge earned** | 🏅 Badge card slide-in | "🏅 Multiplication Master unlocked!" |
| **Streak milestone** | 🔥 Flame animation | "🔥 7-day streak! Keep it up!" |
| **Level up** | ✨ Subtle sparkle around avatar | "Level 6 reached! You're a Math Explorer." |
| **First worksheet of day** | 🌅 Morning greeting | "Good morning Alex! Ready to practice?" |
| **Comeback success** | 🎯 Improvement highlight | "+30% improvement! Growth mindset badge earned!" |
| **Weekly goal met** | 📊 End-of-week summary | "This week: 12 worksheets, 85 stars. Great work!" |

### 3.3 Animation Guidelines

**Celebration Animations (post-submit only):**
```css
/* Score reveal — scale in with bounce */
@keyframes scoreReveal {
  0%   { transform: scale(0.3); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
Duration: 600ms
Easing: cubic-bezier(0.34, 1.56, 0.64, 1) /* bounce */

/* Star burst — radial explosion */
@keyframes starBurst {
  0%   { transform: scale(0) rotate(0deg); opacity: 1; }
  100% { transform: scale(3) rotate(180deg); opacity: 0; }
}
Duration: 800ms
Stars: 5-8 particles
Trigger: Only on perfect score or badge unlock

/* Badge slide-in — from top */
@keyframes badgeSlide {
  0%   { transform: translateY(-100px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
Duration: 500ms
Badge stays on screen for 3s, then fades to dashboard
```

**Progress Animations (always visible):**
```css
/* Progress bar fill */
@keyframes progressFill {
  from { width: 0%; }
  to   { width: var(--target-percent); }
}
Duration: 1200ms
Easing: ease-out
Visual: Fill bar with gradient (sky → leaf color)

/* Streak flame flicker (subtle) */
@keyframes flameFlicker {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50%      { transform: scale(1.05) rotate(2deg); }
}
Duration: 2000ms
Iteration: infinite
Trigger: Only when streak is 7+ days
```

**NEVER animate:**
- During active worksheet (timer, question navigation)
- On page load (except initial fade-in)
- Repeatedly without user action
- Faster than 300ms (too aggressive)

### 3.4 Sound Design (Optional — User Toggle)

**Sound On by Default for Ages 6-9 (configurable):**
- ✅ Correct answer: soft "ding" (C note, 0.3s)
- ❌ Incorrect answer: gentle "hmm" (lower tone, no harsh buzz)
- 🎉 Worksheet complete: gentle chime progression (C-E-G major chord)
- 🏅 Badge unlock: triumphant 3-note fanfare
- 🔥 Streak milestone: warm crackle sound

**Sound Off by Default for Ages 10+ (configurable):**
- Haptic feedback on mobile/tablet instead
- Visual-only celebrations

**Volume:**
- Max 40% of system volume
- Fade in/out (no abrupt starts)
- One-shot sounds only (no loops)

---

## 4. Parent & Teacher Friendly Tone

### 4.1 Messaging Principles

**For Students (Voice: Encouraging Coach):**
```
✅ Good: "You got 8 out of 10! That's 80% — great job!"
❌ Avoid: "Only 8 out of 10. You can do better."

✅ Good: "Let's try that again. Practice makes progress!"
❌ Avoid: "Wrong! You failed this worksheet."

✅ Good: "You've practiced multiplication 5 times this week!"
❌ Avoid: "You've only done 5 worksheets. Emma did 12."

✅ Good: "Take your time. Every question is a chance to learn."
❌ Avoid: "Hurry up! The timer is running out!"
```

**For Teachers (Voice: Data-Informed Colleague):**
```
✅ Good: "4 students may need extra support on CCSS.MATH.3.NF.A.1 (fractions)"
❌ Avoid: "These students are failing fractions."

✅ Good: "Class engagement up 15% this week with reward system enabled"
❌ Avoid: "Students aren't motivated without rewards."

✅ Good: "Jordan improved from 60% to 85% on retry — Growth Mindset badge earned"
❌ Avoid: "Jordan is now ranked #12 in the class."
```

**For Parents (Voice: Trusted Partner):**
```
✅ Good: "Alex practiced 12 minutes today and earned 8 stars on multiplication!"
❌ Avoid: "Alex only scored 70% today."

✅ Good: "This week's focus: Word Problems (3 worksheets, 80% avg)"
❌ Avoid: "Alex is behind in word problems."

✅ Good: "Keep up the great routine! 5-day practice streak 🔥"
❌ Avoid: "Alex needs to practice more to catch up."
```

### 4.2 Email Digest Templates

**Weekly Student Summary (to Parents):**
```
Subject: Alex's Practice Week — March 18-24

Hi Parent,

Great week! Here's what Alex accomplished:

📊 This Week's Stats
   • 12 worksheets completed
   • 87% average score
   • 3h 24m total practice time
   • 5-day streak maintained! 🔥

🏆 New Achievements
   • Multiplication Master badge earned
   • Level 12 reached (Math Explorer)
   • 45 stars earned this week

📚 Focus Areas
   ✅ Multiplication: Mastered (90% avg)
   ⏳ Division: In Progress (70% avg)
   🎯 Next topic: Fractions

💡 Tip for Parents
   Alex is doing great with multiplication! Consider using
   real-world examples (cooking measurements, sharing items)
   to reinforce learning.

[View Full Progress] [Download This Week's Work]

Keep up the awesome work!
— Learnfyra Team
```

**Teacher Weekly Report (Automated):**
```
Subject: Class Summary — Mrs. Johnson's Grade 3 Math

This Week's Highlights:

👥 Class Engagement
   • 18/24 students active (75%)
   • 156 worksheets completed (class total)
   • 82% class average score

📈 Improvement Stars
   • Jordan P: +25% improvement on division
   • Emma L: 7-day streak maintained
   • Alex M: Perfect score on word problems

🔔 Students to Check In With
   • 4 students completed 0-1 worksheets this week
   • 3 students below 60% on fractions (CCSS.MATH.3.NF.A.1)

🎯 Standards Coverage
   • 12 of 15 Grade 3 standards practiced this week
   • Strong: Multiplication, Place Value
   • Needs work: Fractions, Measurement

[View Full Class Dashboard] [Assign Targeted Practice]
```

### 4.3 Teacher Control Panel

**Reward System Settings (per-class toggles):**
```
□ Enable star rewards
□ Show student levels
□ Display achievement badges
□ Enable daily streaks
□ Allow retakes for higher scores
□ Show leaderboard (rank by improvement, not score)
□ Send parent email digests

Privacy & Sharing:
□ Allow students to see own stats only (default)
□ Allow students to see classmates' achievements (with parent consent)
□ Include student names in teacher reports

Difficulty Balancing:
Star multiplier: [1.0x] (adjust if you want to give more/fewer stars)
Perfect score bonus: [+5 stars] (customize celebration rewards)
Streak grace days: [2 days] (weekend/sick day policy)
```

---

## 5. Accessibility Considerations

### 5.1 Visual Accessibility

**Color Blindness (Deuteranopia, Protanopia, Tritanopia):**
```
Standard palette:
  --color-success: #10B981  (green) 
  --color-warning: #FBBF24  (yellow)
  --color-error:   #EF4444  (red)

Color-blind safe palette (automatic detection via prefers-color-scheme):
  --color-success: #0EA5E9  (blue — uses shape + color)
  --color-warning: #F97316  (orange — distinct from success)
  --color-error:   #DC2626  (red — paired with ❌ icon)

Icons ALWAYS paired with color:
  ✅ Correct (green checkmark)
  ❌ Incorrect (red X)
  Never color-only indicators
```

**Low Vision:**
```
Minimum font sizes:
  - Body text: 16px (1rem)
  - Student question text: 18px (1.125rem)
  - Score display: 48px (3rem)
  - Badge text: 14px (0.875rem)

Contrast ratios (WCAG AAA):
  - Body text: 7:1 minimum
  - Large text (24px+): 4.5:1 minimum
  - UI components: 3:1 minimum

High contrast mode support:
  - Detects prefers-contrast: high
  - Increases all borders to 2px
  - Removes subtle shadows
  - Increases icon weights
```

**Animation Sensitivity (prefers-reduced-motion):**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  /* Show celebration content immediately, no animation */
  .score-reveal { 
    transform: scale(1); 
    opacity: 1; 
  }
  
  /* Disable star burst particles */
  .star-particle { 
    display: none; 
  }
}
```

### 5.2 Cognitive Accessibility

**For Students with ADHD:**
- Focus Mode toggle (hides all reward UI during solving)
- Timer optional (not required — untimed mode always available)
- Progress visible but not distracting (top-right corner, small)
- One-task-at-a-time design (no competing UI elements)

**For Students with Dyslexia:**
- Option to use OpenDyslexic font (teacher/parent toggle)
- Generous line height (1.6-1.8)
- Left-aligned text (never justified)
- No long paragraphs in questions (max 3 sentences)

**For Students with Processing Delays:**
- No time pressure messaging ("Hurry up!")
- No auto-advance after answer selection
- Clear "Next" button for self-pacing
- Replay button on instructions/explanations

**For Anxious Learners:**
- No countdown sound effects
- No red "wrong!" flashes (gentle fade to neutral state)
- "It's okay to make mistakes" reminder on first incorrect answer
- Option to hide score until student is ready to see it

### 5.3 Screen Reader Support

**ARIA Labels for All Reward Elements:**
```html
<!-- Score display -->
<div class="score-display" aria-label="Your score: 17 out of 20, which is 85 percent">
  <span aria-hidden="true">85%</span>
</div>

<!-- Star count -->
<div class="star-count" aria-label="You earned 10 stars">
  <span aria-hidden="true">⭐ 10</span>
</div>

<!-- Badge unlock -->
<div class="badge" role="img" aria-label="Achievement unlocked: Multiplication Master. Complete 10 multiplication worksheets with 80 percent or higher.">
  <img src="badge-mult-master.svg" alt="" aria-hidden="true">
  <span>Multiplication Master</span>
</div>

<!-- Progress bar -->
<div class="progress" role="progressbar" 
     aria-valuenow="65" aria-valuemin="0" aria-valuemax="100"
     aria-label="Fractions progress: 65 percent complete">
  <div class="progress-fill" style="width: 65%"></div>
</div>

<!-- Streak display -->
<div class="streak" aria-label="Current practice streak: 5 days in a row">
  <span aria-hidden="true">🔥 5</span>
</div>
```

**Keyboard Navigation:**
```
Tab order (results page):
1. Score headline
2. Star count
3. Badge cards (if any)
4. Review your work section
5. Action buttons (Try Another, Review Mistakes, Dashboard)

Focus indicators:
- 3px solid outline on all interactive elements
- High contrast color (sky blue #3B82F6)
- Visible on all background colors

Shortcuts (optional, with on-screen legend):
- R: Retry this worksheet
- N: Try another worksheet  
- D: Go to dashboard
- M: Review mistakes
```

### 5.4 Mobile & Touch Accessibility

**Touch Target Sizes (minimum):**
```
Mobile phone (320px-767px):
  - Buttons: 48px height, 100% width
  - Badge cards: 72px height (stacked)
  - Star icons: 32px tap area
  - Toggle switches: 48px width

Tablet (768px-1023px):
  - Buttons: 44px height, min 120px width
  - Badge cards: 64px height (2-column grid)
  - Star icons: 28px tap area

Desktop (1024px+):
  - Buttons: 40px height, auto width
  - Badge cards: 56px height (3-column grid)
  - Hover states: all interactive elements
```

**Responsive Reward Display:**
```
Mobile (portrait):
- Stack all badges vertically
- Score takes 60% of viewport
- Hide streak icon during solving (show on dashboard only)

Tablet (landscape): 
- 2-column badge grid
- Score takes 40% of viewport
- Streak visible in header

Desktop:
- 3-column badge grid
- Score alongside badges (side-by-side)
- Full reward panel visible
```

---

## 6. Implementation Phases (No Code — Planning Only)

### Phase 1: Core Metrics (MVP)
**Build first:**
- Student dashboard with basic stats (worksheets completed, average score, time)
- Star rewards (1 star per correct answer)
- Simple progress bars (per-topic completion)
- Results page with score reveal + star count
- Teacher view of student activity list

**Skip for now:**
- Badges, levels, animations
- Streaks
- Email digests
- Advanced analytics

**Goal:** Validate that students AND teachers want this feature before building complexity.

### Phase 2: Engagement Layer
**Add after Phase 1 validation:**
- Achievement badges (6 families, ~20 total badges)
- Daily practice streaks with grace periods
- Level system (optional teacher toggle)
- Celebration animations (score reveal, badge unlock)
- Sound effects (opt-in)

### Phase 3: Insights & Communication
**Add last:**
- Weekly email digests (parent & teacher)
- Standards coverage heatmap
- Improvement-based leaderboards (teacher toggle)
- Parent portal view
- Downloadable progress reports (PDF)

### Phase 4: Advanced Features (Future)
**Consider for v2.0:**
- Class-wide challenges ("Can we earn 500 stars this week?")
- Peer encouragement ("Give a classmate a ⭐ for helping you")
- Custom badges (teacher-created rewards)
- Integration with school LMS (Google Classroom, Canvas)
- Offline sync (practice without internet, sync later)

---

## 7. Success Metrics — How We'll Know This Works

### Student Engagement Metrics
```
Primary KPIs:
□ Worksheet completion rate (target: 20% increase vs. no-reward baseline)
□ Return visit rate (target: 3x/week average)
□ Retry rate (target: 15% of students retry low-score worksheets)
□ Streak maintenance (target: 30% of active students maintain 7+ day streak)

Secondary KPIs:
□ Average session duration (target: 12-18 minutes)
□ Questions answered per session (target: 15-20)
□ Perfect score rate (target: 10-15% of completions)
```

### Teacher Satisfaction Metrics
```
Primary KPIs:
□ Teacher dashboard usage (target: 80% of teachers check weekly)
□ Reward system opt-in rate (target: 70% keep it enabled)
□ Parent feedback requests (target: 50% enable parent emails)

Qualitative:
□ Teacher survey: "Reward system helps student motivation" (target: 4.2/5 avg)
□ Teacher survey: "Reports are actionable" (target: 4.0/5 avg)
```

### Learning Outcome Metrics (most important)
```
Primary KPI:
□ Score improvement on 2nd attempt (target: +20% avg vs. 1st attempt)
□ Standards mastery rate (target: 60% of practiced standards reach 80%+ avg)
□ Question accuracy over time (trend: positive slope)

Control test:
□ Compare classes with rewards ON vs. OFF (same teacher, same subject)
□ Measure: completion rate, accuracy, retention after 7 days

Negative indicators to watch for (kill switches):
□ Completion rate goes UP but accuracy goes DOWN (rushing for stars)
□ High-performing students disengage (rewards too childish)
□ Teacher complaints about "gaming the system" (retrying endlessly)
```

---

## 8. Design Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Students focus on stars, not learning** | High | Stars ONLY earned for correct answers (not just completion). Cap retry stars. Show accuracy % prominently alongside star count. |
| **Rewards feel childish to older students (8-10th grade)** | Medium | Age-based progression: younger grades see stars/badges, older grades see "proficiency levels" and standards mastery. Teacher toggle to switch language. |
| **Parents complain it's "too gamified"** | High | Transparent metrics visible to parents. Email digests focus on learning first, rewards second. Parent toggle to hide all reward UI for their child. |
| **Teachers don't use dashboard (too complex)** | Medium | Simplify to 3 primary views: Today's Activity, Weekly Summary, Needs Attention. Hide advanced analytics behind "View Full Report" link. |
| **Accessibility not maintained over time** | High | Automated accessibility tests in CI/CD. Annual audit with real screen reader users. WCAG AAA compliance required for merge. |
| **Students cheat/game the system** | Medium | Rate limit retries (max 3x per worksheet per day). Don't show correct answers until 24h after first attempt. Focus on improvement badges, not high-score badges. |
| **Streaks cause anxiety** | Medium | Grace periods (weekends, sick days). Option to hide streak counter. Never send "You broke your streak!" notifications. Reframe as "Start a new streak!" |

---

## 9. Visual Design Tokens (For Implementation)

```css
/* Reward-specific color tokens */
:root {
  /* Stars */
  --star-gold: #FBBF24;
  --star-glow: #FDE047;
  --star-outline: #D97706;
  
  /* Badges */
  --badge-bronze: #CD7F32;
  --badge-silver: #C0C0C0;
  --badge-gold: #FFD700;
  
  /* Progress */
  --progress-bg: #E2E8F0;
  --progress-fill-start: #3B82F6;  /* sky blue */
  --progress-fill-end: #10B981;    /* emerald green */
  
  /* Streaks */
  --streak-cold: #94A3B8;   /* gray - days 1-2 */
  --streak-warm: #F97316;   /* orange - days 3-6 */
  --streak-hot: #FBBF24;    /* yellow - days 7-13 */
  --streak-fire: #EAB308;   /* gold - days 14+ */
  
  /* Celebration */
  --celebration-confetti: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --celebration-sparkle: #FDE047;
  
  /* Status colors (color-blind safe) */
  --status-success: #10B981;  /* green */
  --status-success-bg: #D1FAE5;
  --status-warning: #F97316;  /* orange */
  --status-warning-bg: #FFEDD5;
  --status-error: #EF4444;    /* red */
  --status-error-bg: #FEE2E2;
  
  /* Shadows for celebration elements */
  --shadow-badge: 0 4px 12px rgba(147, 51, 234, 0.25);
  --shadow-score: 0 8px 24px rgba(59, 130, 246, 0.35);
  --shadow-star-burst: 0 0 20px rgba(251, 191, 36, 0.6);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  :root {
    --progress-bg: #334155;
    --progress-fill-start: #60A5FA;
    --progress-fill-end: #34D399;
    --status-success-bg: #064E3B;
    --status-warning-bg: #431407;
    --status-error-bg: #450A0A;
  }
}
```

---

## 10. Copywriting Library — Exact Text Strings

### Results Page Headlines (Randomized)
```javascript
const celebrationHeadlines = {
  perfect: [
    "🌟 Perfect Score! Outstanding work!",
    "💯 Flawless! You're a star!",
    "⭐ All correct! Incredible!",
  ],
  high: [ // 80-99%
    "✨ Excellent work!",
    "🎯 Great job! Almost perfect!",
    "👏 Well done!",
  ],
  medium: [ // 60-79%
    "📈 Good effort! Keep practicing!",
    "🌱 You're growing! Nice work!",
    "💪 Solid attempt!",
  ],
  low: [ // 40-59%
    "🌟 You tried! Let's review together.",
    "📚 Practice makes progress!",
    "🎯 Let's work on this together!",
  ],
  veryLow: [ // <40%
    "🌱 Every mistake is a learning opportunity!",
    "💡 Let's review and try again!",
    "🌟 You're brave for trying! Let's practice more.",
  ],
};
```

### Badge Unlock Copy
```javascript
const badgeMessages = {
  firstWorksheet: {
    title: "🎉 First Worksheet Complete!",
    body: "You've taken your first step. Keep going!",
  },
  multiplicationMaster: {
    title: "🏆 Multiplication Master",
    body: "You've mastered multiplication! 10 worksheets with 80%+. Impressive!",
  },
  fiveDayStreak: {
    title: "🔥 5-Day Streak!",
    body: "You practiced 5 days in a row. That's dedication!",
  },
  comebackKid: {
    title: "💪 Comeback Kid",
    body: "You improved by 30%! Growth mindset in action!",
  },
  // ... (20 total badges)
};
```

### Streak Milestone Messages (Toast Notifications)
```javascript
const streakMessages = {
  day3: "🔥 3-day streak! You're building a habit!",
  day5: "🔥 5-day streak! Consistency is key!",
  day7: "🔥 Weekly streak! You practiced every day! 🎉",
  day14: "🔥 2-week streak! You're unstoppable!",
  day30: "🔥 Monthly streak! You're a learning legend! 🎖️",
};
```

### Teacher Dashboard Copy
```javascript
const teacherInsights = {
  highEngagement: "✨ Great week! 18 students active. Class engagement up 15%.",
  needsAttention: "🔔 4 students completed 0-1 worksheets this week. Consider checking in.",
  improvementHighlight: "📈 Jordan improved +25% on division. Growth mindset badge earned!",
  standardsCoverage: "🎯 12 of 15 Grade 3 standards practiced this week. Strong: Multiplication. Focus: Fractions.",
};
```

---

## 11. Next Steps for Implementation

### For BA Agent:
- [ ] Convert this spec into user stories with acceptance criteria
- [ ] Define API requirements for reward data (what endpoints needed)
- [ ] Write test scenarios for each reward surface

### For DEV Agent:
- [ ] Design database schema for stars, badges, streaks, achievements
- [ ] Build reward calculation engine (src/rewards/calculator.js)
- [ ] Create webhook hooks in submitHandler.js to trigger rewards

### For DBA Agent:
- [ ] Define JSON schema for student progress data
- [ ] Plan S3 storage strategy for dashboard data
- [ ] Specify metadata fields for rewards tracking

### For QA Agent:
- [ ] Write accessibility tests (screen reader, keyboard nav, color contrast)
- [ ] Create test fixtures for reward scenarios (perfect score, streaks, badges)
- [ ] Define edge cases (student retries 10x, breaks streak, etc.)

### For IaC Agent:
- [ ] Plan Lambda functions needed (if any — might be frontend-only initially)
- [ ] Design S3 bucket for progress data (separate from worksheets)
- [ ] Consider caching strategy for dashboard loads

---

## Appendix: Research Notes from Competitor Analysis

### edusheets.io Observations:
- **What they do well:**  
  - Clean, professional dashboard layout  
  - Clear standards alignment messaging  
  - Per-student analytics visible to teachers  
  - "Smart Review" feature (adaptive practice)  

- **What they're missing:**  
  - No visible reward/gamification layer  
  - No student-facing dashboard (all for teachers)  
  - No celebration moments for students  
  - No streak/habit-building features  

- **Learnfyra differentiation:**  
  We can own the "student engagement" space while they focus on teacher productivity.  
  Our reward system becomes the reason teachers choose us over them.

### edusheethub.com Observations:
- **What they do well:**  
  - Strong content marketing (parent testimonials)  
  - Blog with educational tips  
  - Shop feature (monetization)  

- **What they're missing:**  
  - No digital platform (just PDF downloads)  
  - No tracking or analytics  
  - No student interaction layer  

- **Learnfyra differentiation:**  
  We're already 10x ahead with online solve + scoring.  
  Adding rewards makes us unbeatable in the "engaging students" category.

---

## Final Notes

This reward system is designed to:
1. ✅ **Motivate** students to practice more and build daily habits  
2. ✅ **Inform** teachers with actionable insights on student progress  
3. ✅ **Reassure** parents that screen time = productive learning time  
4. ✅ **Celebrate** growth mindset and improvement, not just high scores  
5. ✅ **Respect** accessibility, cognitive load, and educational integrity  

**Key Philosophy:**  
We're building features FOR educators, not AGAINST them. Every notification, every badge, every animation must pass the test: "Would a teacher approve of this interrupting their student's focus?"

If the answer is no, we don't ship it.

---

**End of UX Specification**  
**Ready for BA agent to convert to user stories.**  
**No code implementation yet — design validation first.**
