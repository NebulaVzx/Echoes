---
phase: 11
slug: ui-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E) + Jest (unit) |
| **Config file** | `web/playwright.config.ts` (exists); `web/jest.config.ts` (Wave 0) |
| **Quick run command** | `npx playwright test --project=chromium specs/layout.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=chromium specs/layout.spec.ts`
- **After every plan wave:** Run `npx playwright test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | REQ-11-12 | — | N/A | unit | `cat shared/design-tokens/colors.json` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | REQ-11-12 | — | N/A | unit | `grep -c '"spacing"' shared/design-tokens/spacing.json` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | REQ-11-01,09 | — | N/A | E2E | `npx playwright test specs/layout.spec.ts -g "desktop layout"` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | REQ-11-13 | — | N/A | E2E | `npx playwright test specs/layout.spec.ts -g "mobile dock"` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 1 | REQ-11-06 | — | N/A | unit | `grep -c "DensityProvider" web/app/providers/density-provider.tsx` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 1 | REQ-11-07 | — | N/A | unit | `grep -c "setProperty.*primary" web/app/providers/theme-color-provider.tsx` | ❌ W0 | ⬜ pending |
| 11-03-03 | 03 | 1 | REQ-11-05 | — | N/A | unit | `grep -c "LayoutProvider" web/app/providers/layout-provider.tsx` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | REQ-11-01,04 | T-11-01 | Auth gate via (main)/layout.tsx | E2E | `npx playwright test specs/layout.spec.ts -g "header"` | ❌ W0 | ⬜ pending |
| 11-05-01 | 05 | 2 | REQ-11-04 | T-11-02 | UserMenu behind AuthProvider | E2E | `npx playwright test specs/layout.spec.ts -g "header"` | ❌ W0 | ⬜ pending |
| 11-06-01 | 06 | 2 | REQ-11-04 | — | N/A | E2E | `npx playwright test specs/layout.spec.ts -g "sidebar"` | ❌ W0 | ⬜ pending |
| 11-07-01 | 07 | 2 | REQ-11-05 | — | N/A | E2E | `npx playwright test specs/layout.spec.ts -g "right panel"` | ❌ W0 | ⬜ pending |
| 11-07-02 | 07 | 2 | REQ-11-02 | — | N/A | E2E | `npx playwright test specs/layout.spec.ts -g "mobile dock"` | ❌ W0 | ⬜ pending |
| 11-08-01 | 08 | 3 | REQ-11-03 | T-11-03 | Command palette in modal, focus trap | E2E | `npx playwright test specs/command-palette.spec.ts` | ❌ W0 | ⬜ pending |
| 11-09-01 | 09 | 2 | REQ-11-07 | — | N/A | manual | Screenshot comparison for theme color switch | N/A | ⬜ pending |
| 11-10-01 | 10 | 3 | REQ-11-10 | — | N/A | manual | `npx serwist build` + verify cache | ❌ W0 | ⬜ pending |
| 11-11-01 | 11 | 1 | REQ-11-11 | — | N/A | unit | `cat apps/desktop/tauri.conf.json` | ❌ W0 | ⬜ pending |
| 11-12-01 | 12 | 4 | REQ-11-08 | T-11-20 | All pages behind (main)/layout.tsx auth gate | E2E | `npx playwright test specs/smoke.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/e2e/specs/layout.spec.ts` — covers REQ-11-01, 11-02, 11-04, 11-13
- [ ] `web/e2e/specs/command-palette.spec.ts` — covers REQ-11-03
- [ ] `web/e2e/specs/smoke.spec.ts` — covers REQ-11-08 (existing pages in new layout)
- [ ] `web/jest.config.ts` — Jest config for provider/hook unit tests (none found)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Theme transition animation smoothness | REQ-11-09 | Visual regression — requires human judgment | Toggle dark/light, verify 300ms fade on all surfaces |
| Accent color preset switching | REQ-11-07 | Screenshot comparison | Switch each accent preset, verify no flash or layout shift |
| Density toggle visual correctness | REQ-11-06 | Visual comparison across 3 modes | Switch compact/comfortable/loose, verify card sizing and spacing |
| Confetti animation at milestones | — | One-shot animation — hard to trigger in test | Simulate milestone state, verify particles render without blocking UI |
| Tauri window rendering | REQ-11-11 | Requires Rust toolchain + native build | `cargo tauri dev` — verify Next.js loads in frameless window |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
