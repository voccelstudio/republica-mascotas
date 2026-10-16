---
name: Friendly Clinical Modernism
colors:
  surface: '#f4fafd'
  surface-dim: '#d4dbdd'
  surface-bright: '#f4fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f7'
  surface-container: '#e8eff1'
  surface-container-high: '#e2e9ec'
  surface-container-highest: '#dde4e6'
  on-surface: '#161d1f'
  on-surface-variant: '#414751'
  inverse-surface: '#2b3234'
  inverse-on-surface: '#ebf2f4'
  outline: '#717783'
  outline-variant: '#c1c7d3'
  surface-tint: '#0060ac'
  primary: '#005da7'
  on-primary: '#ffffff'
  primary-container: '#2976c7'
  on-primary-container: '#fdfcff'
  inverse-primary: '#a4c9ff'
  secondary: '#775a00'
  on-secondary: '#ffffff'
  secondary-container: '#fecb49'
  on-secondary-container: '#715600'
  tertiary: '#006a35'
  on-tertiary: '#ffffff'
  tertiary-container: '#008645'
  on-tertiary-container: '#f6fff4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a4c9ff'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#004883'
  secondary-fixed: '#ffdf99'
  secondary-fixed-dim: '#f1c03f'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4300'
  tertiary-fixed: '#6bfe9c'
  tertiary-fixed-dim: '#4ae183'
  on-tertiary-fixed: '#00210c'
  on-tertiary-fixed-variant: '#005228'
  background: '#f4fafd'
  on-background: '#161d1f'
  surface-variant: '#dde4e6'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.05em
  code-price:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1280px
---

## Brand & Style

The design system for this veterinary clinic management platform balances professional medical reliability with a warm, approachable personality. The target audience includes veterinary doctors, clinical staff, and pet owners who require a tool that feels both technically robust and emotionally supportive.

The visual style is a hybrid of **Corporate Modern** and **Soft Minimalism**. It prioritizes high-density data organization necessary for medical records while using soft geometry and a welcoming color palette to reduce the "clinical coldness" often associated with medical software. The interface is optimized for Spanish-speaking users, specifically tailored for the Paraguayan market, utilizing a clear hierarchy that ensures critical pet health information is never obscured.

## Colors

The palette is derived from the core brand identity:
- **Primary (#4A90E2):** A trustworthy, "Clinical Blue" used for primary actions, navigation, and signifying stability.
- **Secondary (#F5C342):** A "Warm Amber" used for highlighting pet-centric features, status alerts, and accents that add a friendly touch.
- **Tertiary (#2ECC71):** A "Health Green" specifically for positive medical outcomes, successful payments in ₲ (Gs.), and "Active" patient statuses.
- **Neutral (#2D3436):** A deep charcoal for high-contrast typography, ensuring maximum legibility on white surfaces.

The default mode is **Light**, utilizing a tiered grayscale (from #F8FAFC to #E2E8F0) to create a clean, airy workspace that minimizes cognitive load during long shifts.

## Typography

The design system utilizes **Plus Jakarta Sans** across all levels. This font family was chosen for its modern, geometric construction that remains friendly due to its slightly rounded terminals.

- **Headlines:** Set with tight tracking and bold weights to establish clear section boundaries.
- **Body Text:** Generous line-height (1.5x) is maintained to ensure that dense medical notes and history are readable.
- **Price Formatting:** For the ₲ (Guaraníes) currency, a bold weight is always used to ensure financial clarity in billing modules.
- **Localization:** All type styles are tested for Spanish character lengths (e.g., "Información del Paciente" vs "Patient Info"), ensuring no truncation in tight UI areas.

## Layout & Spacing

This design system uses a **Fluid Grid** model based on an 8px square baseline. 

- **Desktop (1200px+):** A 12-column grid with 24px gutters. Sidebars are fixed at 280px for management tools, while the content area expands fluidly.
- **Tablet (768px - 1199px):** An 8-column grid. Complex data tables may trigger horizontal scrolling or collapse into card-based views.
- **Mobile (<767px):** A 4-column grid with 16px margins.
- **Data Density:** In "Clinical View" (medical records), vertical spacing between list items is reduced to 12px to allow more information to be visible without scrolling. In "User View" (pet owner facing), spacing is increased to 24px+ for a more relaxed, friendly experience.

## Elevation & Depth

To maintain a clean and reliable feel, this design system uses **Tonal Layers** and **Soft Ambient Shadows**.

- **Level 0 (Background):** #F8FAFC - The base canvas.
- **Level 1 (Cards/Surface):** #FFFFFF - Primary content containers with a very soft, 10% opacity blue-tinted shadow (0px 4px 20px rgba(74, 144, 226, 0.1)).
- **Level 2 (Modals/Popovers):** #FFFFFF - Higher elevation with a more pronounced shadow to focus attention on critical tasks like "Añadir Nueva Mascota."
- **Interactive States:** Buttons use a subtle "press" effect where the shadow is removed and the element shifts 1px down to simulate physical tactile feedback.

## Shapes

The shape language is **Rounded (Level 2)**. 

- **Standard Elements:** Buttons, input fields, and small cards use an 8px (0.5rem) radius.
- **Large Elements:** Featured pet profiles and main dashboard containers use a 16px (1rem) radius.
- **Avatars:** Pet profile images should always be perfectly circular to contrast against the structured, rectangular grid of the medical data.
- **Iconography:** Use "Linear Rounded" icons to match the softened edges of the UI components.

## Components

### Buttons
- **Primary:** Solid #4A90E2 with white text. High-contrast, bold weight.
- **Secondary:** White background with #4A90E2 border and text.
- **Actionable Icons:** Used for "Editar" or "Eliminar," utilizing the Secondary yellow or a soft Red (#E74C3C) for destructive actions.

### Input Fields
- Use a 1px border (#E2E8F0). On focus, the border changes to Primary Blue with a 3px soft blue glow. Labels are always persistent above the field in `label-sm`.

### Chips & Tags
- **Patient Status:** "En Consulta" (Blue), "Estable" (Green), "Urgencia" (Yellow/Orange).
- Chips utilize a semi-transparent background of the text color (15% opacity) for a modern, layered look.

### Cards
- Pet Profile cards include a high-contrast header. Financial summary cards emphasize the ₲ (Guaraníes) amount in the top-right corner using the `code-price` typography style.

### Tables
- Clinical tables use alternating row stripes (Zebra striping) in #F8FAFC to assist eye-tracking across long rows of medical data. Header cells are pinned (sticky) for long records.