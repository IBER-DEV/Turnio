---
name: Multi-Tenant Booking Framework
colors:
  surface: '#fdf7ff'
  surface-dim: '#ded8e0'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f2fa'
  surface-container: '#f2ecf4'
  surface-container-high: '#ece6ee'
  surface-container-highest: '#e6e0e9'
  on-surface: '#1d1b20'
  on-surface-variant: '#494551'
  inverse-surface: '#322f35'
  inverse-on-surface: '#f5eff7'
  outline: '#7a7582'
  outline-variant: '#cbc4d2'
  surface-tint: '#6750a4'
  primary: '#4f378a'
  on-primary: '#ffffff'
  primary-container: '#6750a4'
  on-primary-container: '#e0d2ff'
  inverse-primary: '#cfbcff'
  secondary: '#63597c'
  on-secondary: '#ffffff'
  secondary-container: '#e1d4fd'
  on-secondary-container: '#645a7d'
  tertiary: '#765b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c9a74d'
  on-tertiary-container: '#503d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#cfbcff'
  on-primary-fixed: '#22005d'
  on-primary-fixed-variant: '#4f378a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cdc0e9'
  on-secondary-fixed: '#1f1635'
  on-secondary-fixed-variant: '#4b4263'
  tertiary-fixed: '#ffdf93'
  tertiary-fixed-dim: '#e7c365'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#fdf7ff'
  on-background: '#1d1b20'
  surface-variant: '#e6e0e9'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
This design system is a polymorphic framework engineered to support three distinct brand identities within a unified SaaS booking ecosystem. The architecture utilizes a "Themed Core" approach where functional logic remains constant while the visual expression pivots across three specific design directions:

- **Barbería Tradicional (Vintage/Dark):** A high-contrast, masculine aesthetic inspired by traditional craftsmanship. It uses deep blacks and gold accents to evoke exclusivity and heritage.
- **Spa Holístico (Minimalist/Light):** A soft, airy experience centered on wellness. It prioritizes white space, sage tones, and organic curves to reduce cognitive load and induce calm.
- **Clínica Dental (Professional/Clean):** A systematic, high-legibility interface that emphasizes hygiene and reliability. It uses a structured medical blue palette to build patient trust.

The system transitions between these identities by swapping the global design tokens defined in the subsequent sections.

## Colors
The color strategy employs a semantic token mapping system. Each brand maps its specific hex codes to functional roles:
- **Primary:** Action color for buttons, active states, and focus indicators.
- **Background:** The base canvas color for the application.
- **Surface:** Used for cards, modals, and navigation bars to create layered depth.
- **On-Surface:** The primary high-contrast text color.

For the **Barbería** theme, use a gold-tinted overlay (5% opacity) on surfaces to maintain the "vintage" warmth within the dark mode. For **Spa** and **Dental**, use pure neutrals to ensure a clinical and clean appearance.

## Typography
The typography system uses a dual-font strategy:
1.  **Libre Caslon Text:** Reserved for the **Barbería** headlines to provide a sophisticated, editorial feel. For **Spa** and **Dental**, substitute all Serif headlines with **Inter** (Semi-Bold/Bold) to maintain a modern, clean look.
2.  **Inter:** Used across all brands for body text, inputs, and labels to ensure maximum legibility and functional clarity in the booking flow.

**Scaling Note:** On mobile devices, `display-lg` should scale down to 32px to prevent layout breaking. All "On-Primary" text must maintain a contrast ratio of at least 4.5:1 against the brand's primary color.

## Layout & Spacing
The design system utilizes an **8px base grid** for all structural elements and a **4px soft grid** for minor icon and label alignments.

- **Mobile:** Single column layout with 16px side margins.
- **Tablet/Desktop:** 12-column fluid grid. Content containers are capped at 1200px wide for readability.
- **Gaps:** Use `md` (16px) for spacing between related items in a list and `lg` (24px) for spacing between distinct sections or card groups.

## Elevation & Depth
Elevation is handled differently per brand to reinforce their unique personality:

- **Barbería:** Uses **Tonal Layers**. Depth is created by lightening the surface color (e.g., `#1E1E1E` on `#121212`). Avoid shadows; use 1px solid borders in `#D4AF37` (20% opacity) for card definition.
- **Spa:** Uses **Soft Ambient Shadows**. Shadows are very diffused, using the primary sage green tinted at a very low opacity (e.g., `box-shadow: 0 10px 30px rgba(122, 139, 123, 0.1)`).
- **Dental:** Uses **Low-Contrast Outlines**. High-precision 1px borders in a soft gray-blue (`#E2E8F0`) differentiate containers, with a slight 2px vertical shadow only for active elements like buttons.

## Shapes
Corner radius is the primary identifier of brand "mood":
- **Barbería:** 6px (Medium-Sharp) – conveys precision and traditional structure.
- **Spa:** 16px (Extra Rounded) – conveys comfort, approachability, and organic flow.
- **Dental:** 8px (Standard Rounded) – conveys modernity and a balanced, professional tone.

Buttons and input fields must inherit these values globally.

## Components
Consistent styling rules for the SaaS booking components:

- **Buttons:** All primary buttons must have a **minimum height of 44px** to ensure touch-target compliance.
  - *Barbería:* Gold background, black text, 6px radius.
  - *Spa:* Sage background, white text, 16px radius.
  - *Dental:* Blue background, white text, 8px radius.
- **Cards:**
  - *Barbería:* Solid surface color with a thin gold top-border.
  - *Spa:* Pure white with soft green-tinted shadow.
  - *Dental:* White with a subtle grey border.
- **Bottom Sheets:**
  - Used for service selection on mobile.
  - Must include a drag-handle (40x4px) at the top.
  - Top corners must be rounded according to the brand's `rounded-xl` equivalent (12px for Barberia, 32px for Spa, 16px for Dental).
- **Input Fields:**
  - 44px height.
  - Active state: 2px border using the `primary` color.
  - Label: `label-md` placed above the field.
- **Chips:**
  - Used for time-slot selection.
  - Selected state uses a fill of `primary` color; unselected uses a subtle `surface` variation.