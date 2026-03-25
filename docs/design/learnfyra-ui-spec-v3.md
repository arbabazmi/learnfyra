# Learnfyra UI/UX Design Specification v3.0
## Complete Visual & Experience Redesign — School Kids Aesthetic
**Document Version:** 3.0  
**Date:** March 24, 2026  
**Design Phase:** Specification (No Code)  
**Target Audience:** Teachers, Tutors, Students (Grades 1–10, ages 6–16)

---

## Table of Contents
1. [Design Benchmark Summary](#1-design-benchmark-summary)
2. [Learnfyra Visual Direction](#2-learnfyra-visual-direction)
3. [Page-by-Page UX Specification](#3-page-by-page-ux-specification)
4. [Responsive Behavior](#4-responsive-behavior)
5. [Accessibility Requirements](#5-accessibility-requirements)
6. [Three Key Design Decisions](#6-three-key-design-decisions)

---

## 1. Design Benchmark Summary

### 1.1 EduSheets.io Analysis

**Visual Identity:**
- **Color Palette:** Professional blue-dominant scheme (#3B82F6 primary, white backgrounds)
- **Typography:** Clean sans-serif system, likely Inter or similar, medium weight hierarchy
- **Layout Pattern:** SaaS landing page structure — hero, features grid, social proof, CTA repeats
- **Illustrations:** Custom vector graphics showing worksheets, people, abstract education concepts
- **Button Style:** Rounded rectangles (8–10px radius), solid fills, clear hierarchy
- **Spacing:** Generous whitespace, 80–120px vertical rhythm between sections
- **Card Design:** Subtle shadows (0 4px 6px rgba), white surfaces, thin borders
- **Hero Treatment:** Large headline + subtext + dual CTAs, minimal decoration

**Strengths:**
- Clear value proposition ("Generate Practice in Seconds")
- Strong trust signals (1,000+ standards, security badges)
- Feature-benefit clarity with icons
- Professional, credible tone suitable for institutions

**Weaknesses:**
- Generic SaaS aesthetic — doesn't communicate "kids learning"
- Limited color personality — very blue-heavy
- No playful or energetic elements for student engagement
- Illustrations are corporate, not classroom-friendly

**Key Pattern to Avoid:** The overly-corporate SaaS tone. Learnfyra serves teachers but delights students — must feel warmer.

---

### 1.2 EduSheetHub.com Analysis

**Visual Identity:**
- **Color Palette:** Warmer palette with oranges/reds (#ff6b35 range), softer blues, cream backgrounds
- **Typography:** Rounded sans-serif for headings (possibly Nunito or similar), playful feel
- **Layout Pattern:** WordPress blog/content hub — card grid, sidebar, article listings
- **Illustrations:** Kid-themed graphics (rocket, circle decorations), festive/seasonal themes
- **Button Style:** Rounded buttons with moderate radius (12–14px), CTA orange
- **Spacing:** Tighter rhythm, more content-dense
- **Card Design:** Image-heavy cards with overlays, stronger shadows, colored borders
- **Hero Treatment:** Large banner image with text overlay, more traditional

**Strengths:**
- Fun, approachable tone suitable for parents and kids
- Seasonal/thematic content strategy (Christmas worksheets, dinosaurs)
- Strong use of warm colors creates friendly vibe
- Icons and decorative elements add personality

**Weaknesses:**
- Cluttered information architecture — too many article cards
- Weak hierarchy — hard to find primary action
- Theme-based design limits brand uniqueness
- Not tool-focused — feels like a blog, not a generator

**Key Pattern to Avoid:** Content overload and lack of focus. Learnfyra is a tool first, content second.

---

### 1.3 Competitive Synthesis

| Element | EduSheets.io | EduSheetHub.com | Learnfyra Should Be |
|---------|--------------|-----------------|---------------------|
| **Primary Color** | Professional blue | Warm orange | **Vibrant blue with energy** |
| **Accent Colors** | Minimal (gray) | Multiple warm tones | **Multi-color system (school supplies)** |
| **Typography** | Corporate sans | Rounded friendly | **Rounded display + clean body** |
| **Illustration Style** | SaaS vector art | Kid clipart | **CSS-only geometric decoration** |
| **Personality** | Trustworthy, serious | Fun, casual | **Joyful meets trustworthy** |
| **Layout Density** | Spacious | Crowded | **Balanced with focus** |
| **Call-to-Action** | Subtle buttons | Bold buttons | **Prominent, celebratory CTAs** |

**Positioning Opportunity:**  
Neither site occupies the "joyful + professional" space. EduSheets.io skews too corporate. EduSheetHub.com feels amateur. Learnfyra can own the intersection: **trusted by teachers, loved by students.**

---

## 2. Learnfyra Visual Direction

### 2.1 Design Philosophy

**Core Thesis:**  
Learnfyra worksheets are where **learning becomes play**. The design should feel like walking into the best classroom — organized, colorful, energetic, and safe. Think: **school supplies come to life.**

**Personality Pillars:**
- **Energetic:** Bright primaries, bouncy motion, celebration
- **Trustworthy:** Clear hierarchy, readable type, professional structure
- **Joyful:** Rounded shapes, multi-color accents, surprise details
- **Educational:** Standards-aligned, curriculum-focused, outcome-driven

**Visual Metaphor:**  
A desk full of perfectly organized school supplies: bright pencils, colored highlighters, a fresh notebook with ruled lines, sticky notes marking pages.

---

### 2.2 Color System — School Supplies Palette

#### 2.2.1 Primary Colors (Functional Identity)

```
--color-sky:       #3B82F6   /* Bright blue — trust, focus, primary actions */
--color-sky-dark:  #1D4ED8   /* Deep blue — hover states, depth */
--color-sky-soft:  #DBEAFE   /* Pale blue — backgrounds, tints */

--color-sun:       #FBBF24   /* Amber yellow — energy, highlights, stars */
--color-sun-dark:  #D97706   /* Dark amber — hover */
--color-sun-soft:  #FEF3C7   /* Pale yellow — warning states */

--color-leaf:      #10B981   /* Emerald green — correct, success, go */
--color-leaf-dark: #059669   /* Deep green — hover */
--color-leaf-soft: #D1FAE5   /* Pale green — success backgrounds */

--color-coral:     #F97316   /* Orange — solve button, hot CTAs */
--color-coral-dark:#EA580C   /* Deep orange — hover */
--color-coral-soft:#FFEDD5   /* Pale orange — tints */

--color-berry:     #8B5CF6   /* Purple — premium, answer keys */
--color-berry-dark:#7C3AED   /* Deep purple — hover */
--color-berry-soft:#EDE9FE   /* Pale lavender — tints */
```

#### 2.2.2 Neutrals (Typography & Surfaces)

```
--color-chalk:     #F8FAFC   /* Near-white — page background */
--color-white:     #FFFFFF   /* Cards, surfaces */
--color-cloud:     #E2E8F0   /* Borders, dividers */
--color-cloud-dark:#CBD5E1   /* Disabled states */
--color-ink:       #1E293B   /* Deep navy — body text */
--color-ink-soft:  #475569   /* Muted text — hints, labels */
```

#### 2.2.3 Semantic Mapping

```
Primary Action:    var(--color-sky)       /* Generate, submit, proceed */
Secondary Action:  var(--color-white)     /* Cancel, dismiss, back */
Success/Correct:   var(--color-leaf)      /* Score, checkmarks */
Warning/Timer:     var(--color-sun)       /* Time running low */
Error/Incorrect:   #EF4444               /* Red — mistakes, alerts */
Hot CTA:           var(--color-coral)     /* Solve Online — must pop */
Premium:           var(--color-berry)     /* Answer keys, special features */
```

**Color Psychology:**
- Blue = Trust and focus (teacher confidence)
- Yellow = Energy and optimism (student motivation)
- Green = Achievement and growth (correct answers)
- Orange = Action and excitement (solve mode)
- Purple = Wisdom and creativity (answer keys)

---

### 2.3 Typography System

#### 2.3.1 Font Families

```css
/* Display (Headlines, Titles, Buttons) */
--font-display: 'Nunito', system-ui, -apple-system, sans-serif;
  Weight: 700 (bold), 800 (extra-bold), 900 (black)
  Character: Rounded, friendly, highly legible for ages 6–16
  Usage: Hero titles, card headers, section labels, button text

/* Body (Paragraphs, Form Labels, Instructions) */
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
  Weight: 400 (regular), 500 (medium), 600 (semi-bold)
  Character: Clean, professional, trusted by teachers
  Usage: All body copy, form fields, descriptions

/* Monospace (Code, Timers, Answer Keys) */
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  Weight: 500 (medium), 700 (bold)
  Usage: Timer displays, worksheet IDs, technical details
```

#### 2.3.2 Type Scale

```css
/* Mobile-first responsive scale */
--text-xs:    0.75rem   /* 12px — field hints, fine print */
--text-sm:    0.875rem  /* 14px — labels, small UI text */
--text-base:  1rem      /* 16px — body copy, form inputs */
--text-lg:    1.125rem  /* 18px — large body, student question text */
--text-xl:    1.25rem   /* 20px — card titles, mode button labels */
--text-2xl:   1.5rem    /* 24px — page section headers */
--text-3xl:   2rem      /* 32px — hero title (mobile) */
--text-4xl:   2.5rem    /* 40px — hero title (desktop) */

/* Line Heights */
--leading-tight:   1.2   /* Headlines */
--leading-snug:    1.4   /* Subheadings */
--leading-normal:  1.6   /* Body copy */
--leading-relaxed: 1.75  /* Student question text */
```

#### 2.3.3 Font Loading Strategy

- Use `<link rel="preconnect">` for Google Fonts CDN
- Load `Nunito` (weights 700, 800, 900) and `Inter` (weights 400, 500, 600) in single request
- Specify `font-display: swap` to prevent invisible text during load
- System font stack fallback ensures instant render

---

### 2.4 Shape Language — Rounded & Layered

#### 2.4.1 Border Radius System

```css
--radius-xs:   6px    /* Small badges, tags */
--radius-sm:   8px    /* Input fields, small buttons */
--radius:      10px   /* Default — form inputs, cards (inner) */
--radius-md:   14px   /* Buttons, mode cards */
--radius-lg:   20px   /* Primary cards, hero sections */
--radius-xl:   28px   /* Extra-large panels, results screens */
--radius-pill: 999px  /* Pills, circles, status badges */
```

**Usage Rules:**
- Cards: `--radius-lg` (20px) — feels like paper on desk
- Buttons: `--radius-md` (14px) — inviting, not too round
- Inputs: `--radius` (10px) — approachable, but structured
- Badges: `--radius-pill` — playful accent elements

#### 2.4.2 Shadow & Depth System

```css
/* Elevation layers */
--shadow-xs:   0 1px 3px rgb(0 0 0 / 0.07);
--shadow-sm:   0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
--shadow:      0 10px 24px -4px rgb(0 0 0 / 0.10), 0 4px 8px -4px rgb(0 0 0 / 0.06);
--shadow-hover:0 16px 32px -4px rgb(0 0 0 / 0.14), 0 6px 12px -4px rgb(0 0 0 / 0.08);

/* Colored button shadows — add personality */
--shadow-btn-blue:   0 4px 12px rgb(59 130 246 / 0.35);
--shadow-btn-orange: 0 6px 20px rgb(249 115 22 / 0.45);
--shadow-btn-green:  0 4px 14px rgb(16 185 129 / 0.40);
```

**Paper-on-Desk Metaphor:**
- Base cards: `--shadow` (moderate lift)
- Hover state: `--shadow-hover` (lift more, like picking up paper)
- Buttons: Colored shadows that match button hue (glow effect)

---

### 2.5 Motion & Animation — Bouncy, Not Boring

#### 2.5.1 Timing Functions

```css
--ease-in:     cubic-bezier(0.32, 0, 0.67, 0);         /* Acceleration */
--ease-out:    cubic-bezier(0.33, 1, 0.68, 1);         /* Deceleration */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);      /* Overshoot bounce */
--ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);   /* Natural ease-in-out */

--duration-fast:    180ms;   /* Hover states, small UI changes */
--duration-medium:  280ms;   /* Button clicks, form validation */
--duration-slow:    400ms;   /* Page sections, modal entrances */
```

#### 2.5.2 Micro-Interactions

**Buttons:**
```css
/* Lift on hover */
transform: translateY(-2px);
box-shadow: var(--shadow-hover);

/* Slight compression on click */
transform: scale(0.97);
```

**Cards:**
```css
/* Hover lift (subtle) */
transform: translateY(-3px);
box-shadow: var(--shadow-hover);
transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Success States:**
```css
/* Pop-in animation for results */
@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); opacity: 1; }
}
animation: popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
```

**Page Load:**
```css
/* Fade + rise for sections */
@keyframes fadeRise {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
animation: fadeRise 460ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
```

#### 2.5.3 Performance Notes

- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `margin`, `padding` (triggers reflow)
- Add `will-change: transform` only during active hover
- Remove `will-change` after interaction completes

---

### 2.6 Decorative Elements — CSS-Only, No Images

Goal: Add personality without image dependencies. All decoration via CSS gradients, shapes, and patterns.

#### 2.6.1 Background Treatments

**Page Background (Global):**
```css
body {
  background:
    /* Diagonal pencil stripes (subtle) */
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 28px,
      rgb(59 130 246 / 0.022) 28px,
      rgb(59 130 246 / 0.022) 29px
    ),
    /* Warm glow top-right (sun) */
    radial-gradient(
      ellipse 60% 40% at 90% 0%,
      rgb(251 191 36 / 0.12) 0%,
      transparent 60%
    ),
    /* Cool glow top-left (sky) */
    radial-gradient(
      ellipse 50% 35% at 5% 5%,
      rgb(59 130 246 / 0.10) 0%,
      transparent 55%
    ),
    /* Base gradient */
    linear-gradient(180deg, #F8FAFC 0%, #EEF4FF 100%);
}
```

#### 2.6.2 Header Accent Strip (Notebook Tabs)

```css
.site-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--color-sky)   0%   20%,
    var(--color-sun)   20%  40%,
    var(--color-leaf)  40%  60%,
    var(--color-coral) 60%  80%,
    var(--color-berry) 80%  100%
  );
}
```

**Rationale:** Mimics colored notebook tabs — instantly communicates "school supplies" without images.

#### 2.6.3 Hero Ruled Lines (Notebook Paper)

```css
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    transparent,
    transparent calc(2rem - 1px),
    rgb(59 130 246 / 0.07) calc(2rem - 1px),
    rgb(59 130 246 / 0.07) 2rem
  );
  pointer-events: none;
  z-index: -1;
  opacity: 0.6;
}
```

**Rationale:** Subtle ruled lines behind hero text — like writing on notebook paper.

#### 2.6.4 Card Left Edge (Folder Tabs)

```css
.card::before {
  content: '';
  position: absolute;
  top: 1.5rem;
  bottom: 1.5rem;
  left: -1.5px;
  width: 4px;
  background: linear-gradient(
    180deg,
    var(--color-sky) 0%,
    var(--color-berry) 100%
  );
  border-radius: 0 6px 6px 0;
}
```

**Rationale:** Colored tab on card edge — like folder dividers in a binder.

#### 2.6.5 Icon Backgrounds (Gradient Fills)

```css
.logo-icon {
  width: 2.4rem;
  height: 2.4rem;
  background: linear-gradient(135deg, var(--color-sky) 0%, var(--color-berry) 100%);
  border-radius: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-btn-blue);
}
```

**Rationale:** No SVG dependencies — pure CSS gradient boxes with Unicode emojis/symbols.

---

### 2.7 Icon Strategy — Unicode + Semantic HTML

**No icon fonts. No SVGs (unless necessary). Use Unicode characters + ARIA labels.**

| Context | Character | Unicode | Color |
|---------|-----------|---------|-------|
| Logo | &#9998; | U+270E | White on gradient box |
| Generate button | &#9997; | U+2710 | White |
| Success checkmark | &#10003; | U+2713 | var(--color-leaf) |
| Timer (timed mode) | &#9201; | U+23F1 | White on blue |
| Book (untimed mode) | &#128214; | U+1F4D6 | Blue on white |
| Star accent | &#9733; | U+2605 | var(--color-sun) |
| Warning | &#9888; | U+26A0 | var(--color-sun-dark) |
| Error | &#10005; | U+2715 | var(--color-error) |

**Accessibility:** Always pair with `aria-hidden="true"` and adjacent screen-reader text.

---

## 3. Page-by-Page UX Specification

### 3.1 Generator Page (index.html)

#### 3.1.1 Information Architecture

```
Header (Global Navigation)
  ├─ Logo + Tagline
  └─ No menu yet (future: Pricing, Login, etc.)

Main Content
  ├─ Hero Section
  │   ├─ Kicker badge ("Built for Teachers and Tutors")
  │   ├─ Main headline (H1)
  │   ├─ Subtitle (benefits)
  │   └─ No CTA here — form is immediate below
  │
  ├─ Form Card
  │   ├─ Card header (title + subtitle)
  │   ├─ Worksheet Setup section
  │   │   ├─ Grade (select)
  │   │   ├─ Subject (select, disabled until grade chosen)
  │   │   ├─ Topic (select, disabled until subject chosen)
  │   │   ├─ Difficulty (select)
  │   │   ├─ Question Count (select)
  │   │   ├─ Format (select)
  │   │   └─ Include Answer Key (checkbox)
  │   │
  │   ├─ Student & Class Details section (Optional)
  │   │   ├─ Student Name (text input)
  │   │   ├─ Date (date picker)
  │   │   ├─ Teacher Name (text input)
  │   │   ├─ Period (text input)
  │   │   └─ Class Name (text input)
  │   │
  │   └─ Form actions
  │       └─ Generate Worksheet button (primary, full-width on mobile)
  │
  ├─ Loading Section (shown during generation)
  │   ├─ Animated spinner
  │   ├─ Status text ("Generating your worksheet…")
  │   └─ Time estimate ("This usually takes 10–20 seconds.")
  │
  ├─ Results Section (shown after success)
  │   ├─ Success badge + headline
  │   ├─ Description line (grade, subject, topic, format)
  │   ├─ Download buttons grid (PDF, DOCX, HTML, Answer Key)
  │   ├─ "Solve Online" button (hot CTA — coral color)
  │   └─ "Generate Another Worksheet" button (secondary)
  │
  └─ Error Section (shown on failure)
      ├─ Error icon + message
      └─ "Try Again" button (secondary)

Footer
  └─ Standards alignment note + copyright
```

#### 3.1.2 Hero Section — Energetic but Focused

**Layout:**
- Centered content, max-width 720px
- Kicker badge at top (inline-flex, sky-soft background, sky-dark text)
- Headline uses `clamp()` for fluid scaling: 24px mobile → 40px desktop
- Subtitle max-width 660px, color-ink-soft, line-height 1.65

**Kicker Badge:**
```
Text: "★ Built for Teachers and Tutors"
Style: Pill shape, sky-soft bg, sky-dark border, uppercase tiny text
Purpose: Sets authority + audience targeting
```

**Headline (H1):**
```
Text: "Create polished classroom worksheets in under a minute"
Style: Nunito 800, 2.5rem desktop / 1.6rem mobile, color-ink, -0.025em tracking
Purpose: Clear value prop — speed + quality
```

**Subtitle:**
```
Text: "Choose grade, subject, and topic — then personalize with optional student and class details before downloading."
Style: Inter 500, 1.0625rem, color-ink-soft, line-height 1.65
Purpose: Explain the process — reduce friction
```

**Decoration:**
- Notebook-ruled lines behind hero text (CSS repeating-linear-gradient, subtle)
- No button — immediate scroll to form (frictionless)

#### 3.1.3 Form Card — Guided & Progressive

**Visual Treatment:**
- Large card with `--shadow` (paper-on-desk feel)
- Left edge colored tab (blue-to-purple gradient)
- White background, 20px border-radius, 1.5px cloud border
- Internal sections separated by subtle headings, not dividers

**Card Header:**
```
Title: "Generate a Worksheet" (Nunito 800, 1.5rem, color-ink)
Subtitle: "Required fields define the worksheet content. Student and class details are optional and prefill the worksheet header."
Style: color-ink-soft, 0.9375rem, line-height 1.55
```

**Section 1: Worksheet Setup (Required)**

**Section Title Styling:**
```
Text: "WORKSHEET SETUP" (uppercase, 0.8rem, letter-spacing 0.1em)
Style: Nunito 800, sky-dark color, flex with dot accent (:before)
Dot: 6px circle, sky color, margin-right 0.5rem
```

**Form Grid Layout:**
- Desktop: 2 columns (Grade | Subject, Difficulty | Question Count, Format | Checkbox)
- Mobile: 1 column (stacked)
- Gap: 1.25rem
- Topic field spans full width (form-group--full)

**Input Field Styling:**

*Selects:*
```css
.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--color-cloud);
  border-radius: var(--radius);
  font: 500 1rem var(--font-body);
  color: var(--color-ink);
  background: var(--color-white);
  transition: border-color 180ms, box-shadow 180ms;
}

.form-select:focus {
  outline: none;
  border-color: var(--color-sky);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.12);
}

.form-select:disabled {
  background: var(--surface-soft);
  cursor: not-allowed;
  opacity: 0.6;
}
```

*Text Inputs (Student Name, Date, etc.):*
```css
.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--color-cloud);
  border-radius: var(--radius);
  font: 400 1rem var(--font-body);
  color: var(--color-ink);
  background: var(--color-white);
  transition: border-color 180ms, box-shadow 180ms;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-sky);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.12);
}

.form-input::placeholder {
  color: var(--color-ink-soft);
  opacity: 0.6;
}
```

*Checkbox (Include Answer Key):*
```css
/* Custom checkbox design — school-style checkmark */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  /* Hide native checkbox */
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.checkbox-custom {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-cloud);
  border-radius: 6px;
  background: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 180ms;
}

.checkbox-input:checked + .checkbox-custom {
  background: var(--color-sky);
  border-color: var(--color-sky);
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '✓';
  color: white;
  font-size: 1rem;
  font-weight: 700;
}

.checkbox-input:focus + .checkbox-custom {
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.12);
}

.checkbox-text {
  font: 600 1rem var(--font-body);
  color: var(--color-ink);
}
```

**Field Labels:**
```css
.form-label {
  display: block;
  font: 600 0.875rem var(--font-body);
  color: var(--color-ink);
  margin-bottom: 0.5rem;
  letter-spacing: 0.01em;
}

.required {
  color: var(--color-error);
  font-weight: 700;
}

.optional-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-ink-soft);
  background: var(--color-cloud);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  text-transform: lowercase;
}
```

**Field Hints:**
```css
.field-hint {
  display: block;
  font: 400 0.8rem var(--font-body);
  color: var(--color-ink-soft);
  margin-top: 0.375rem;
  line-height: 1.4;
}
```

**Validation Errors:**
```css
.field-error {
  display: block;
  font: 600 0.8125rem var(--font-body);
  color: var(--color-error);
  margin-top: 0.5rem;
  line-height: 1.4;
}

.form-select.error,
.form-input.error {
  border-color: var(--color-error);
  background: var(--color-error-bg);
}
```

**Section 2: Student & Class Details (Optional)**

**Section Title:**
```
Text: "STUDENT & CLASS DETAILS (Optional)"
Style: Same as Worksheet Setup, but with opacity-reduced "(Optional)" suffix
Purpose: Signal this is skippable — reduce abandonment
```

**Fields:**
- Student Name (autocomplete="name", placeholder="e.g., Ava Johnson")
- Date (type="date", defaults to today via JS)
- Teacher Name (autocomplete="name", placeholder="e.g., Ms. Carter")
- Period (placeholder="e.g., 2nd")
- Class Name (placeholder="e.g., Algebra Readiness", full-width)

**Behavior:**
- All fields 100% optional — no validation
- Hints explain where data appears ("Prefills the Name field on the printed worksheet.")
- No red asterisks, only "optional" badges

#### 3.1.4 Generate Button — Money Shot

**Visual Styling:**
```css
.btn--primary {
  width: 100%;
  padding: 0.9rem 2rem;
  font: 800 1.0625rem var(--font-display);
  color: white;
  background: linear-gradient(145deg, var(--color-sky) 0%, var(--color-sky-dark) 100%);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-btn-blue);
  cursor: pointer;
  transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn--primary:hover:not(:disabled) {
  background: linear-gradient(145deg, #2563EB 0%, #1E40AF 100%);
  box-shadow: 0 8px 24px rgb(59 130 246 / 0.50);
  transform: translateY(-2px);
}

.btn--primary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn--primary:disabled {
  background: var(--color-cloud);
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.5;
}
```

**Button Text:**
```
"&#9997; Generate Worksheet"
Icon: Unicode pencil (U+2710)
Alignment: Center with icon left
```

**States:**
- **Disabled (initial):** Gray, no hover, "Please select required fields" ARIA label
- **Enabled:** Blue gradient, glowing shadow
- **Loading:** Text changes to "Generating…", spinner replaces icon
- **Focus:** 3px sky-soft ring around button

#### 3.1.5 Loading Section — Reassure & Entertain

**Layout:**
- Replaces form card with a centered card
- Spinner at top (CSS-animated rotating gradient circle — no GIF)
- Primary text: "Generating your worksheet…"
- Secondary text: "This usually takes 10–20 seconds."

**Spinner Design:**
```css
.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid var(--color-sky-soft);
  border-top-color: var(--color-sky);
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Text Styling:**
```css
.loading-text {
  font: 600 1.125rem var(--font-display);
  color: var(--color-ink);
}

.loading-subtext {
  font: 400 0.9375rem var(--font-body);
  color: var(--color-ink-soft);
}
```

**Purpose:** Manage expectations — generation can take 15–20 seconds. Reduces perceived wait time.

#### 3.1.6 Results Section — Celebration & Action

**Layout:**
- Card with success badge (checkmark) + headline
- Description line: "Grade 3 Math: Multiplication • 10 questions • PDF with Answer Key"
- Download buttons grid (2×2 on desktop, 2×1 on tablet, 1×1 on mobile)
- Hot CTA: "Solve Online" button (coral, full-width on mobile)
- Secondary: "Generate Another Worksheet" button

**Success Badge:**
```css
.success-badge {
  width: 3.5rem;
  height: 3.5rem;
  background: linear-gradient(135deg, var(--color-leaf) 0%, var(--color-leaf-dark) 100%);
  border-radius: var(--radius-md);
  color: white;
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgb(16 185 129 / 0.40);
  animation: popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```

**Download Buttons Design:**

Each button represents a file format with a unique color:

```css
/* PDF Button — Red */
.btn--download-pdf {
  background: linear-gradient(145deg, #EF4444 0%, #DC2626 100%);
  color: white;
  box-shadow: 0 4px 12px rgb(239 68 68 / 0.35);
}

/* DOCX Button — Blue */
.btn--download-docx {
  background: linear-gradient(145deg, var(--color-sky) 0%, var(--color-sky-dark) 100%);
  color: white;
  box-shadow: var(--shadow-btn-blue);
}

/* HTML Button — Green */
.btn--download-html {
  background: linear-gradient(145deg, var(--color-leaf) 0%, var(--color-leaf-dark) 100%);
  color: white;
  box-shadow: 0 4px 12px rgb(16 185 129 / 0.35);
}

/* Answer Key Button — Purple */
.btn--download-key {
  background: linear-gradient(145deg, var(--color-berry) 0%, var(--color-berry-dark) 100%);
  color: white;
  box-shadow: 0 4px 14px rgb(139 92 246 / 0.40);
}
```

Visual structure:
```css
.download-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.btn--download {
  padding: 0.85rem 1.25rem;
  font: 700 0.9375rem var(--font-display);
  text-align: center;
  border-radius: var(--radius-md);
  transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.btn--download:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.25);
}
```

**Solve Online Button (Hot CTA):**
```css
.btn--solve {
  background: linear-gradient(145deg, var(--color-coral) 0%, var(--color-coral-dark) 100%);
  color: white;
  box-shadow: var(--shadow-btn-orange);
  font: 800 1.0625rem var(--font-display);
  padding: 1rem 2rem;
  border-radius: var(--radius-md);
  width: 100%;
  margin-bottom: 1rem;
}

.btn--solve:hover {
  background: linear-gradient(145deg, #EA580C 0%, #C2410C 100%);
  box-shadow: 0 8px 28px rgb(249 115 22 / 0.55);
  transform: translateY(-3px) scale(1.01);
}
```

Purpose: Make "Solve Online" feel like a prize — more exciting than download.

**Generate Another Button:**
```css
.btn--secondary {
  background: var(--color-white);
  color: var(--color-sky);
  border: 2px solid var(--color-cloud);
  font: 700 1rem var(--font-display);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  transition: all 180ms;
}

.btn--secondary:hover {
  background: var(--color-sky-soft);
  border-color: var(--color-sky);
  transform: translateY(-1px);
}
```

#### 3.1.7 Error Section — Calm & Actionable

**Layout:**
- Red-orange alert box (not harsh red, more coral-tinted)
- Error icon (⚠️ U+26A0) + bold title
- Error message (plain language, no tech jargon)
- "Try Again" button (secondary style)

**Visual Treatment:**
```css
.error-box {
  background: var(--color-error-bg);
  border: 2px solid var(--color-error-border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;
}

.error-box__title {
  font: 800 1.25rem var(--font-display);
  color: var(--color-error);
  margin-bottom: 0.75rem;
}

.error-box__message {
  font: 500 1rem var(--font-body);
  color: var(--color-ink);
  line-height: 1.6;
}
```

**Purpose:** Errors happen (API limits, network issues). Make recovery easy — single click to retry.

---

### 3.2 Solve Page (solve.html)

#### 3.2.1 Information Architecture

```
Header (Same as Generator)
  ├─ Logo (links back to /)
  └─ Dynamic tagline showing worksheet metadata

Main Content
  ├─ Loading Section (initial load)
  │   ├─ Spinner
  │   └─ "Loading worksheet…"
  │
  ├─ Error Section (if worksheet not found)
  │   ├─ Error message
  │   └─ "Back to Generator" button
  │
  ├─ Mode Selection Screen
  │   ├─ Headline: "Ready to solve?"
  │   ├─ Subtext: "[Topic] • [Question Count] questions • [Estimated Time]"
  │   └─ Two mode buttons:
  │       ├─ Timed Mode (blue, clock icon)
  │       └─ Untimed Mode (white, book icon)
  │
  ├─ Solve Section (after mode chosen)
  │   ├─ Timer Bar (timed mode only)
  │   │   ├─ Label: "Time remaining"
  │   │   └─ Timer display: "12:34"
  │   │
  │   ├─ Questions Container
  │   │   └─ Question Cards (generated dynamically per type)
  │   │       ├─ Question number + type badge
  │   │       ├─ Question text (large, readable)
  │   │       ├─ Input field(s) — varies by question type
  │   │       └─ (No correct answer shown yet)
  │   │
  │   └─ Submit button (full-width, coral)
  │
  └─ Results Section (after submission)
      ├─ Score Header
      │   ├─ Score circle (large percentage)
      │   ├─ Fraction: "8/10"
      │   ├─ Emoji celebration (if > 70%)
      │   └─ Time taken display
      │
      ├─ Question Results List
      │   └─ Each question shows:
      │       ├─ Correct (✅) or Incorrect (❌)
      │       ├─ Student answer
      │       ├─ Correct answer (if wrong)
      │       ├─ Explanation
      │       └─ Points earned / possible
      │
      └─ Actions
          ├─ "Try Again" button (reset, same worksheet)
          └─ "Generate New Worksheet" button (back to /)

Footer
  └─ Same as generator page
```

#### 3.2.2 Mode Selection Screen — Big, Inviting Choice

**Visual Design:**

Card layout with two large mode buttons side-by-side (desktop) or stacked (mobile).

**Headline:**
```
Text: "Ready to solve?"
Style: Nunito 800, 1.75rem, color-ink, centered
```

**Subtitle (Dynamic):**
```
Text: "Grade 3 Math: Multiplication • 10 questions • Estimated time: 15 minutes"
Style: Inter 500, 1rem, color-ink-soft, centered
Purpose: Set expectations before choosing mode
```

**Mode Buttons:**

*Timed Mode Button:*
```css
.mode-btn--timed {
  background: linear-gradient(145deg, var(--color-sky) 0%, var(--color-sky-dark) 100%);
  color: white;
  padding: 2.25rem 1.5rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-btn-blue);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  border: 2.5px solid transparent;
}

.mode-btn--timed:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 32px rgb(59 130 246 / 0.50);
}

.mode-btn__icon {
  font-size: 2.5rem;
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: rgb(255 255 255 / 0.2);
}

.mode-btn__label {
  font: 800 1.2rem var(--font-display);
  letter-spacing: -0.01em;
}

.mode-btn__desc {
  font: 600 0.875rem var(--font-body);
  opacity: 0.85;
}
```

*Untimed Mode Button:*
```css
.mode-btn--untimed {
  background: var(--color-white);
  color: var(--color-ink);
  border: 2.5px solid var(--color-cloud);
  box-shadow: var(--shadow-sm);
  /* Rest same as timed */
}

.mode-btn--untimed:hover {
  background: var(--color-sky-soft);
  border-color: var(--color-sky);
  box-shadow: var(--shadow-hover);
}

.mode-btn--untimed .mode-btn__icon {
  background: var(--color-sky-soft);
  color: var(--color-sky);
}
```

**Behavior:**
- Clicking a mode button triggers immediate transition to solve section
- No separate "Start" button — one-click experience
- Animation: mode screen fades out, solve section fades in (400ms)

#### 3.2.3 Timer Bar — Urgent & Clear

**Layout:**
- Fixed at top of solve section (above questions)
- Flexbox: label on left, timer value on right
- Background color changes as time runs out (green → yellow → red)

**Visual States:**

*Normal (> 50% time remaining):*
```css
.timer-bar {
  background: var(--color-sky-soft);
  border: 2px solid rgb(59 130 246 / 0.25);
  border-radius: var(--radius-md);
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  transition: all 280ms;
}

.timer-label {
  font: 800 0.8rem var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-sky-dark);
}

.timer-display {
  font: 800 2rem var(--font-display);
  color: var(--color-sky-dark);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
```

*Warning (25–50% time remaining):*
```css
.timer-bar--warning {
  background: var(--color-sun-soft);
  border-color: rgb(251 191 36 / 0.40);
}

.timer-bar--warning .timer-label,
.timer-bar--warning .timer-display {
  color: var(--color-sun-dark);
}
```

*Urgent (< 25% time remaining):*
```css
.timer-bar--urgent {
  background: var(--color-error-bg);
  border-color: var(--color-error-border);
  animation: pulse 1.5s infinite;
}

.timer-bar--urgent .timer-label,
.timer-bar--urgent .timer-display {
  color: var(--color-error);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
```

**Behavior:**
- Timer counts down: "12:34" format (MM:SS)
- When time expires: auto-submit form + show modal "Time's up!"
- In untimed mode: timer bar is hidden (`display: none`)

#### 3.2.4 Question Cards — Large, Kid-Friendly

**General Question Card Layout:**

Each question is a card within the questions container.

```css
.question-card {
  background: var(--color-white);
  border: 2px solid var(--color-cloud);
  border-radius: var(--radius-lg);
  padding: 1.75rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 180ms;
}

.question-card:hover {
  box-shadow: var(--shadow);
}

.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.question-number {
  font: 800 0.875rem var(--font-display);
  color: var(--color-sky);
  background: var(--color-sky-soft);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.question-type-badge {
  font: 600 0.75rem var(--font-body);
  color: var(--color-ink-soft);
  background: var(--color-cloud);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  text-transform: lowercase;
}

.question-text {
  font: 600 1.125rem var(--font-body);
  color: var(--color-ink);
  line-height: 1.75;
  margin-bottom: 1.25rem;
}
```

**Per-Type Input Fields:**

*Multiple Choice:*
```css
.mc-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mc-option-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 2px solid var(--color-cloud);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 180ms;
  user-select: none;
}

.mc-option-label:hover {
  background: var(--color-sky-soft);
  border-color: var(--color-sky);
}

.mc-option-input {
  /* Hidden radio button */
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.mc-option-input:checked + .mc-option-label {
  background: var(--color-sky-soft);
  border-color: var(--color-sky);
  border-width: 2.5px;
}

.mc-option-text {
  font: 500 1rem var(--font-body);
  color: var(--color-ink);
}
```

*True/False:*
```css
/* Same as multiple choice, but only two options */
.tf-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.tf-option-label {
  padding: 1rem;
  text-align: center;
  /* Rest same as mc-option-label */
}
```

*Fill-in-the-Blank / Short Answer:*
```css
.answer-input {
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid var(--color-cloud);
  border-radius: var(--radius);
  font: 500 1rem var(--font-body);
  color: var(--color-ink);
  background: var(--color-white);
  transition: border-color 180ms, box-shadow 180ms;
}

.answer-input:focus {
  outline: none;
  border-color: var(--color-sky);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.12);
}

.answer-input::placeholder {
  color: var(--color-ink-soft);
  opacity: 0.5;
}
```

*Textarea (Word Problems, Show Your Work):*
```css
.answer-textarea {
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  border: 2px solid var(--color-cloud);
  border-radius: var(--radius);
  font: 400 1rem var(--font-body);
  color: var(--color-ink);
  resize: vertical;
  transition: border-color 180ms, box-shadow 180ms;
}

.answer-textarea:focus {
  outline: none;
  border-color: var(--color-sky);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.12);
}
```

*Matching:*
```css
.matching-pairs {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.75rem;
  align-items: center;
}

.matching-item {
  padding: 0.75rem 1rem;
  background: var(--color-sky-soft);
  border-radius: var(--radius);
  font: 500 0.9375rem var(--font-body);
  color: var(--color-ink);
}

.matching-select {
  /* Dropdown to select matches */
  min-width: 120px;
  padding: 0.6rem 0.75rem;
  border: 2px solid var(--color-cloud);
  border-radius: var(--radius);
  font: 500 0.9375rem var(--font-body);
  background: white;
}
```

**Accessibility for Question Inputs:**
- All inputs have `aria-label` or associated `<label>` with question text
- Radio buttons grouped with `role="radiogroup"` and `aria-labelledby`
- Required inputs marked with `aria-required="true"`
- Error states announced with `aria-live="polite"` on validation

#### 3.2.5 Submit Button — Full-Width, Can't Miss

**Visual Styling:**
```css
.solve-actions {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid var(--color-cloud);
}

#submitBtn {
  width: 100%;
  padding: 1.1rem 2rem;
  font: 800 1.125rem var(--font-display);
  color: white;
  background: linear-gradient(145deg, var(--color-coral) 0%, var(--color-coral-dark) 100%);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-btn-orange);
  cursor: pointer;
  transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

#submitBtn:hover {
  background: linear-gradient(145deg, #EA580C 0%, #C2410C 100%);
  box-shadow: 0 10px 32px rgb(249 115 22 / 0.60);
  transform: translateY(-3px);
}

#submitBtn:active {
  transform: scale(0.98);
}
```

**Text:**
```
"Submit Answers"
```

**Behavior:**
- Clicking submits form + shows loading spinner briefly
- If timed mode and time expires: auto-click this button + show "Time's up!" modal

#### 3.2.6 Results Section — Big Score + Detailed Breakdown

**Score Header:**

Large, celebratory display at top of results card.

```css
.results-score-header {
  text-align: center;
  padding: 2.5rem 1.5rem;
  background: linear-gradient(135deg, var(--color-sky-soft) 0%, var(--color-leaf-soft) 100%);
  border-radius: var(--radius-lg);
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
  animation: fadeRise 460ms ease-out both;
}

/* Starburst decoration behind score */
.results-score-header::before {
  content: '★';
  position: absolute;
  top: -1rem;
  right: 1rem;
  font-size: 8rem;
  color: var(--color-sun);
  opacity: 0.15;
  transform: rotate(-15deg);
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: white;
  border: 6px solid var(--color-leaf);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  box-shadow: 0 8px 24px rgb(16 185 129 / 0.30);
  animation: popIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both 200ms;
}

.score-percent {
  font: 900 2.5rem var(--font-display);
  color: var(--color-leaf);
  letter-spacing: -0.02em;
}

.score-fraction {
  font: 700 1.25rem var(--font-display);
  color: var(--color-ink);
  margin-top: 0.5rem;
}

.score-emoji {
  font-size: 2rem;
  margin-top: 0.75rem;
  display: block;
}

.time-taken {
  font: 600 0.9375rem var(--font-body);
  color: var(--color-ink-soft);
  margin-top: 1rem;
}
```

**Emoji Logic (JS handles, CSS styles):**
```
Score >= 90%: "🎉" (celebration)
Score 70–89%: "😊" (happy)
Score 50–69%: "🙂" (neutral)
Score < 50%:  "📚" (study book)
```

**Question Results List:**

Each question shows:
- Correct/incorrect indicator
- Student answer vs. correct answer
- Explanation (from answer key)
- Points earned

```css
.question-results {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.result-item {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  border: 2px solid var(--color-cloud);
  background: var(--color-white);
  transition: box-shadow 180ms;
}

.result-item:hover {
  box-shadow: var(--shadow-sm);
}

.result-item--correct {
  border-color: var(--color-leaf);
  background: var(--color-leaf-soft);
}

.result-item--incorrect {
  border-color: var(--color-error);
  background: var(--color-error-bg);
}

.result-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.result-content {
  flex: 1;
}

.result-question-num {
  font: 700 0.8125rem var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-ink-soft);
  margin-bottom: 0.5rem;
}

.result-answer {
  font: 600 0.9375rem var(--font-body);
  color: var(--color-ink);
  margin-bottom: 0.375rem;
}

.result-explanation {
  font: 400 0.875rem var(--font-body);
  color: var(--color-ink-soft);
  line-height: 1.6;
}

.result-points {
  font: 700 0.875rem var(--font-display);
  color: var(--color-ink);
}
```

**Action Buttons:**

Below results list:

```css
.results-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.btn--try-again {
  /* Same as btn--primary, but secondary style */
  flex: 1;
  min-width: 200px;
}

.btn--new-worksheet {
  /* Same as btn--primary */
  flex: 1;
  min-width: 200px;
}
```

---

## 4. Responsive Behavior

### 4.1 Breakpoint System

```css
/* Mobile-first approach */
:root {
  --container-xs: 100%;       /* 0–374px */
  --container-sm: 100%;       /* 375–767px */
  --container-md: 720px;      /* 768–1023px */
  --container-lg: 960px;      /* 1024–1279px */
  --container-xl: 1120px;     /* 1280px+ */
}

/* Breakpoints */
@media (min-width: 375px) { /* Mobile portrait */ }
@media (min-width: 768px) { /* Tablet portrait */ }
@media (min-width: 1024px) { /* Tablet landscape / small desktop */ }
@media (min-width: 1280px) { /* Desktop */ }
```

### 4.2 Mobile (375px) — Touch-First

**Generator Page:**
- Form grid: 1 column (all fields stacked)
- Generate button: Full width, 44px height minimum (touch target)
- Download buttons grid: 1 column (PDF, DOCX, HTML, Answer Key stacked)
- Hero title: 1.6rem (24px)
- Card padding: 1.5rem
- Gap between sections: 2rem

**Solve Page:**
- Mode selection: 1 column (timed above, untimed below)
- Question cards: Full width, 1.5rem padding
- Multiple choice options: Stacked, 44px height minimum
- Submit button: Full width, 50px height
- Score circle: 100px diameter
- Results list: Single column

**Header:**
- Logo + tagline: Wraps to 2 rows if needed
- Tagline: Hide on very small screens (< 375px) with `display: none` at 320px

**Spacing:**
- Padding: 1.25rem on container
- Section gap: 2rem
- Card padding: 1.5rem

### 4.3 Tablet (768px) — Balanced Layout

**Generator Page:**
- Form grid: 2 columns where logical (Grade | Subject, Difficulty | Question Count)
- Topic and Include Answer Key: Full width still
- Download buttons: 2×2 grid (PDF/DOCX on row 1, HTML/Answer Key on row 2)
- Hero title: 2rem (32px)
- Card padding: 2rem
- Gap between sections: 2.5rem

**Solve Page:**
- Mode selection: 2 columns (timed | untimed side by side)
- Question cards: Full width, 1.75rem padding
- Multiple choice: 2 columns for options if 4 options
- Results list: Single column still (better readability)
- Score circle: 120px diameter

**Header:**
- Logo + tagline: Single row
- Tagline: Visible, left-border separator

**Spacing:**
- Padding: 2rem on container
- Section gap: 2.5rem
- Card padding: 2.25rem

### 4.4 Desktop (1280px) — Maximum Efficiency

**Generator Page:**
- Form grid: 2 columns (optimized distribution)
- Download buttons: 4 columns (all in one row)
- Hero title: 2.5rem (40px)
- Container max-width: 960px (centered)
- Card padding: 2.25rem
- Gap between sections: 3rem

**Solve Page:**
- Mode selection: 2 columns with more generous padding
- Question cards: Max-width 880px, centered
- Multiple choice: 2 columns for cleaner layout
- Results list: Could optionally show 2 columns if many questions (> 15)
- Score circle: 140px diameter

**Header:**
- Logo larger (1.75rem icon, 36px text)
- Tagline: Visible, 16px font

**Spacing:**
- Padding: Max-width container handles this
- Section gap: 3rem
- Card padding: 2.25rem

### 4.5 Focus/Hover States at All Sizes

**Touch Devices (no hover support):**
- Buttons show `:active` state (scale down 0.97) on tap
- No hover shadows — rely on tap feedback
- Ensure all interactive elements are 44×44px minimum

**Mouse Devices (hover support):**
- Buttons lift on hover (+shadow, translateY -2px)
- Cards lift slightly on hover
- MC options highlight on hover

---

## 5. Accessibility Requirements

### 5.1 WCAG 2.1 Level AA Compliance

**Color Contrast:**
- Body text (#1E293B) on white (#FFFFFF): 13.28:1 ✓ (AAA)
- Muted text (#475569) on white: 7.41:1 ✓ (AAA)
- Blue button text (white) on blue (#3B82F6): 4.88:1 ✓ (AA large text)
- All interactive text meets 4.5:1 minimum

**Focus Indicators:**
- All interactive elements show visible focus ring: `box-shadow: 0 0 0 3px rgb(59 130 246 / 0.12)`
- Keyboard navigation order follows visual order
- Skip link at top for keyboard users: "Skip to main content"

**ARIA Landmarks:**
```html
<header role="banner">
<main role="main">
<footer role="contentinfo">
<nav role="navigation"> (if added in future)
<form role="form" aria-labelledby="form-title">
```

**ARIA Labels:**
- All form inputs have associated `<label>` or `aria-label`
- Error messages linked with `aria-describedby`
- Live regions for dynamic content: `aria-live="polite"` on loading/error sections
- Buttons have descriptive labels (not just "Submit" — "Submit Answers")

**Screen Reader Support:**
- Decorative elements marked `aria-hidden="true"`
- Icon-only buttons have `aria-label` text alternative
- Status updates announced with `aria-live` regions
- Form validation errors announced immediately

**Keyboard Navigation:**
- Tab order: logo → form fields → buttons → download links
- Enter submits forms
- Space/Enter activates buttons
- Arrow keys navigate radio groups
- Escape dismisses modals (if added)

### 5.2 Semantic HTML

Use proper elements for their purpose:
- `<header>` for site header
- `<main>` for main content (only one per page)
- `<section>` for major content sections
- `<form>` for all forms
- `<button>` for buttons (not `<div>` with click handlers)
- `<label>` for all form inputs
- `<fieldset>` + `<legend>` for radio groups
- Heading hierarchy: H1 → H2 → H3 (no skipping levels)

### 5.3 Motion & Reduced Motion

Respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Users who enable reduced motion see instant state changes, no animations.

### 5.4 Text Scaling

- All font sizes in `rem` (not `px`) — respects user's browser font size preference
- Layout doesn't break at 200% zoom (WCAG requirement)
- No horizontal scrolling at 200% zoom on mobile
- Min font size: 0.75rem (12px) — only for fine print, not body copy

### 5.5 Touch Target Sizes

- All buttons/links: Minimum 44×44px (iOS guideline)
- Form inputs: Minimum 44px height
- Checkbox/radio custom styles: 24×24px (large enough for touch)
- Adequate spacing between interactive elements (1rem minimum gap)

---

## 6. Three Key Design Decisions

### 6.1 Decision 1: Multi-Color Accent System (Not Single-Brand-Blue)

**Rationale:**

Most education SaaS tools use a single-color brand identity (EduSheets.io = blue, Khan Academy = teal, Quizlet = purple). This creates a professional but sterile feel — acceptable for teacher-facing tools, but alienating for student-facing experiences.

Learnfyra serves **two audiences with different needs:**
- **Teachers:** Want professionalism, trust, efficiency
- **Students:** Want energy, fun, motivation

**Solution: School Supplies Color Palette**

Instead of a single primary color, Learnfyra adopts a **five-color system** inspired by physical school supplies:
- Blue (sky) = Trust, learning
- Yellow (sun) = Energy, highlights
- Green (leaf) = Correct, success
- Orange (coral) = Hot CTAs, action
- Purple (berry) = Premium, answer keys

Each color has a **purpose and emotion** tied to it. This creates:
1. **Visual hierarchy** — important actions (Solve Online) use hot orange, less critical actions (secondary buttons) use neutral gray
2. **Emotional connection** — kids associate colors with meaning (green = good, red = careful, yellow = pay attention)
3. **Differentiation** — no competitor uses this multi-color system; most stick to corporate blues

**Implementation:**
- Header accent strip shows all five colors (notebook tabs metaphor)
- Download buttons each have unique colors (PDF=red, DOCX=blue, HTML=green, Answer Key=purple)
- Score results use green for correct, red for incorrect
- Timer bar changes color as urgency increases (blue → yellow → red)

**Risk Mitigation:**
- Too many colors can feel chaotic → mitigated by using **tints/pastels** for backgrounds and **saturated colors** only for accents
- Could feel childish → balanced with professional typography (Nunito + Inter) and structured grid layouts

---

### 6.2 Decision 2: CSS-Only Decoration (No Image Dependencies)

**Rationale:**

Both inspiration sites use illustrations/images heavily:
- EduSheets.io: Custom vector graphics showing people, worksheets, abstract shapes
- EduSheetHub.com: Stock photos, kid-themed clipart, seasonal banners

Problems with image-heavy designs:
1. **Performance:** Images add 200–500KB per page load
2. **Maintenance:** Updating visuals requires design work + new image exports
3. **Scalability:** Different images needed for each theme/season
4. **Accessibility:** Images need alt text, are often decorative clutter

**Solution: Pure CSS Decoration**

All visual personality comes from:
- **Gradients:** Linear/radial gradients for backgrounds, glows, button fills
- **Patterns:** Repeating-linear-gradient for ruled lines, diagonal stripes, textures
- **Shapes:** Border-radius, box-shadow, pseudo-elements (::before, ::after)
- **Unicode symbols:** ✓ ✗ ★ ☑ ⚠ (instead of icon fonts or SVGs)

Examples:
- **Hero ruled lines:** `repeating-linear-gradient` mimics notebook paper
- **Header accent strip:** 5-color gradient mimics colored tabs
- **Card left edge tab:** Gradient on `::before` pseudo-element
- **Logo icon:** Gradient background + Unicode pencil emoji
- **Success badge:** Gradient circle + Unicode checkmark

**Benefits:**
1. **Zero HTTP requests** for decoration (faster load)
2. **Themable:** Change colors via CSS custom properties
3. **Print-friendly:** Gradients print fine, images often fail
4. **Responsive:** Scales perfectly at any resolution
5. **Maintainable:** No Figma/Illustrator needed for updates

**Trade-off:**
- Less visually rich than custom illustrations → mitigated by **bold color use** and **thoughtful micro-animations**

---

### 6.3 Decision 3: Joyful Micro-Animations (Bouncy, Not Clinical)

**Rationale:**

Most education tools use **generic easing** (linear or ease-in-out) for animations. This feels mechanical and corporate. Example: a button that fades in on click with `transition: all 200ms ease` — it works, but it's boring.

Students (ages 6–16) respond emotionally to **personality in motion**:
- A button that bounces slightly when hovered feels inviting
- A score that pops in with overshoot feels celebratory
- A card that lifts when you hover feels tactile (like picking up a paper)

**Solution: Custom Cubic-Bezier Curves with Bounce**

Define distinct easing functions:
```css
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Overshoot bounce */
--ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Natural ease */
```

Apply to:
- **Buttons on hover:** `transform: translateY(-2px)` + bounce easing → feels springy
- **Cards on hover:** Lift slightly with shadow increase → feels like lifting paper
- **Success states:** Pop in with scale overshoot (0.85 → 1.03 → 1) → feels like celebration
- **Page load:** Sections fade + rise with smooth easing → feels fluid, not jarring

**Micro-Interaction Examples:**

*Button Click:*
```css
.btn:hover {
  transform: translateY(-2px);
  transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.btn:active {
  transform: scale(0.97);
}
```
Effect: Button lifts on hover (inviting), compresses on click (tactile feedback).

*Score Circle Pop-In:*
```css
@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  50% { transform: scale(1.03); } /* Overshoot */
  100% { transform: scale(1); opacity: 1; }
}
.score-circle {
  animation: popIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```
Effect: Score appears with a bounce — feels celebratory, like a prize pop-up.

*Card Hover Lift:*
```css
.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
  transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```
Effect: Card lifts when you point at it — feels like you're about to pick it up.

**Accessibility:**
- Respects `prefers-reduced-motion` — users who enable this setting see instant transitions (0.01ms duration)
- Animations never block interaction — all are decorative enhancements

**Psychological Impact:**
- Joyful motion = engagement → students more likely to complete worksheets
- Tactile feedback = confidence → users feel in control
- Overshoot bounce = delight → memorable brand experience

---

## Appendix: Component Inventory

**Buttons:**
- `.btn--primary` — Main actions (Generate, Submit)
- `.btn--secondary` — Cancel, back, dismiss
- `.btn--solve` — Hot CTA for Solve Online (coral orange)
- `.btn--download-pdf` — Red
- `.btn--download-docx` — Blue
- `.btn--download-html` — Green
- `.btn--download-key` — Purple

**Form Elements:**
- `.form-select` — Dropdowns
- `.form-input` — Text inputs
- `.form-textarea` — Large text areas
- `.checkbox-input` + `.checkbox-custom` — Custom checkboxes
- `.radio-input` + `.radio-custom` — Custom radio buttons

**Cards:**
- `.card` — Base card with shadow + left tab
- `.card--center` — Centered content (loading, error)
- `.question-card` — Solve page question cards
- `.result-item` — Results list items

**Status Elements:**
- `.spinner` — Loading animation
- `.success-badge` — Green checkmark circle
- `.error-box` — Error alert box
- `.timer-bar` — Timer display (timed mode)

**Typography:**
- `.hero-title` — Page H1
- `.card-title` — Section H2
- `.form-label` — Input labels
- `.field-hint` — Helper text below inputs
- `.field-error` — Validation error text

**Layout:**
- `.container` — Max-width content wrapper
- `.form-grid` — 2-column form layout
- `.download-grid` — Download buttons grid
- `.mode-selection` — Mode choice buttons grid

---

## Next Steps (Implementation Phase)

1. **Update CSS custom properties** in `styles.css` with new color tokens
2. **Refine typography scale** — ensure Nunito 800 and Inter 500 loaded
3. **Rebuild button system** with gradient fills, colored shadows, bounce animations
4. **Update form inputs** with focus rings, error states, disabled styling
5. **Build solve page components** — mode buttons, timer bar, question cards, results display
6. **Test responsive behavior** at 375px, 768px, 1280px breakpoints
7. **Verify WCAG AA compliance** with contrast checker + screen reader
8. **Add `prefers-reduced-motion` support** to all animations
9. **Print stylesheet** — ensure worksheets print cleanly (separate CSS file)

---

**End of Specification Document**