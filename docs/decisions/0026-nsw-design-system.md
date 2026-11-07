# 0026. NSW Design System adoption

Status: Accepted
Date recorded: 2026-11-07

## Context
The prototype is a public-facing NSW Government service. Visual alignment with the NSW Design System establishes trust and meets accessibility expectations. The app does not use the `@nswds/ui` React component library because it adds a heavy dependency and the app uses plain React without a design system framework.

## Decision
Adopt NSW DS visual patterns (typography, colours, spacing, component styling) in plain CSS:

- **Public Sans** typeface.
- **NSW DS colour tokens**: navy `#002664`, red `#D7153A`, link blue `#2E5299`, focus yellow `#FAAF05`.
- **Button variants**: primary, secondary, tertiary following NSW DS patterns.
- **Structural components**: header / masthead / footer, steps navigation, form input styling, focus indicators.
- **Domain-specific components stay custom**: evidence gallery, traffic signal timeline, speed scale and certificate coverage have no NSW DS equivalent.
- **Config scope limit**: configuration covers text, on/off switches and which program applies; layout stays in code.

## Consequences
- Consistent government look and feel without a runtime dependency.
- Accessible defaults (colour contrast, focus indicators) inherited from the design system specification.
- Custom domain-specific components need their own accessibility testing because they are not covered by NSW DS defaults.
