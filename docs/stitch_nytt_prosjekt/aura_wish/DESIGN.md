---
name: Aura Wish
colors:
  surface: '#faf9fe'
  surface-dim: '#dad9df'
  surface-bright: '#faf9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#eeedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#3d494b'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f5'
  outline: '#6d797b'
  outline-variant: '#bcc9cb'
  surface-tint: '#006973'
  primary: '#006973'
  on-primary: '#ffffff'
  primary-container: '#2fb2c1'
  on-primary-container: '#003f46'
  inverse-primary: '#5fd7e6'
  secondary: '#5c5f60'
  on-secondary: '#ffffff'
  secondary-container: '#e1e3e4'
  on-secondary-container: '#626566'
  tertiary: '#5f5e60'
  on-tertiary: '#ffffff'
  tertiary-container: '#a4a2a4'
  on-tertiary-container: '#39393b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#90f1ff'
  primary-fixed-dim: '#5fd7e6'
  on-primary-fixed: '#001f23'
  on-primary-fixed-variant: '#004f57'
  secondary-fixed: '#e1e3e4'
  secondary-fixed-dim: '#c5c7c8'
  on-secondary-fixed: '#191c1d'
  on-secondary-fixed-variant: '#454748'
  tertiary-fixed: '#e4e2e4'
  tertiary-fixed-dim: '#c8c6c8'
  on-tertiary-fixed: '#1b1b1d'
  on-tertiary-fixed-variant: '#474649'
  background: '#faf9fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style
The design system is built on a foundation of clarity, joy, and weightlessness. It aims to evoke the feeling of "daydreaming about possibilities" through an airy, light-filled interface. The target audience spans from casual shoppers to meticulous event planners, requiring a UI that feels both lifestyle-oriented and highly functional.

The chosen style is **Modern Minimalism with a Tactile Edge**. It utilizes generous white space, soft shadows, and high-quality product imagery to create a premium, editorial feel. The "cloud-like" metaphor is reinforced through hyper-rounded corners and soft, translucent layers, ensuring the app feels approachable and optimistic rather than strictly corporate.

## Colors
This design system uses a high-key light palette to maintain a "fresh" and "clean" aesthetic. The primary teal (#2FB2C1) acts as the single point of energy, reserved for key actions and brand moments. 

- **Primary Teal:** Used for the main call-to-action buttons, active navigation states, and floating action buttons.
- **Surface Strategy:** The background is a slightly off-white cream to reduce eye strain, while active containers use pure white with soft shadows to appear elevated.
- **Status Icons:** Icons use a semantically clear but slightly desaturated palette to ensure they don't clash with the primary teal.

## Typography
The typography system relies on **Plus Jakarta Sans** for its modern, friendly, and geometric proportions. It provides a perfect balance between professional utility and a welcoming "lifestyle" vibe.

- **Weight Usage:** Bold weights (700) are used sparingly for page titles to create a strong hierarchy. Medium (500) and Semibold (600) are preferred for functional labels to maintain legibility without the "heaviness" of a black weight.
- **Hierarchy:** Use `display-lg` for marketing-heavy onboarding screens and `headline-lg` for standard view titles. 
- **Readability:** Body text uses a standard 16px size with a comfortable 1.5x line height to ensure long descriptions are easy to digest.

## Layout & Spacing
The layout follows a **Fluid Grid** model with high internal margins to emphasize the "airy" brand pillar.

- **Mobile:** A 4-column grid with 20px outside margins and 16px gutters. Elements should generally span the full width or 2 columns for card grids.
- **Desktop:** A 12-column centered grid with a max-width of 1200px. 
- **Spacing Rhythm:** All spacing is based on a 4px baseline. Use 16px (`md`) for standard element grouping and 24px (`lg`) for section separation. 
- **Safe Areas:** Ensure content never touches the screen edges, maintaining a "floating" feel within the viewport.

## Elevation & Depth
Depth is created through soft, multi-layered ambient shadows rather than harsh borders.

- **Level 0 (Background):** Flat, used for the primary app canvas.
- **Level 1 (Cards/Items):** A very subtle 4px blur shadow with 5% opacity. This differentiates product cards from the background.
- **Level 2 (Modals/Overlays):** A more pronounced 16px blur shadow with 10% opacity, often accompanied by a light backdrop blur (10px) on the surface below to focus attention.
- **Visual Distinction:** Surfaces should use subtle tonal shifts (off-white to pure white) to indicate hierarchy before resorting to shadows.

## Shapes
The shape language is extremely soft and approachable. 
- **Containers & Cards:** Use a `2xl` (1.5rem / 24px) corner radius to create a friendly, modern look.
- **Buttons:** Primary buttons should be fully rounded (pill-shaped) to maximize the "friendly" aesthetic and make them feel more "clickable."
- **Small Elements:** Chips and status tags use a 12px radius. 
- **Images:** All product imagery must follow the 24px corner radius of their parent containers to maintain visual harmony.

## Components

### Buttons
- **Primary:** Pill-shaped, Primary Teal background with White text. Use a subtle inner-glow rather than a heavy drop shadow.
- **Secondary:** Transparent background with a Teal outline or a light gray tint.
- **Action Icons:** Placed inside circular containers with a white background and Level 1 elevation.

### Cards
- **Product Cards:** Must have a pure white background, 24px corner radius, and Level 1 shadow. Title and price should be left-aligned below the image.
- **List Items:** Use horizontal layouts with a 12px gap between the image and text metadata.

### Inputs
- **Field Style:** Soft gray background (#F2F4F5) with a 12px radius. No border in resting state; a 2px Teal border on focus.
- **Checkboxes:** Rounded squares (6px radius) rather than sharp corners.

### Status Icons & Badges
- **Wish Status:** Use small circular badges with icons (e.g., a "cloud+" icon) to indicate adding to a list.
- **Price Alerts:** Use the `success` green for price drops and `neutral` for standard pricing.

### Navigation
- **Bottom Bar:** Use a blurred white background (Glassmorphism) with 20px top corner radius. The active state is indicated by a Primary Teal icon and a small dot below the icon.