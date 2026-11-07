# SHL NEXUS — design and component foundation

## Product direction

A private operations workspace for SHL INTERNATIONAL GROUP. Decisions and accountable work come before decoration. The existing application, API, MFA/session boundary and V1–V26 schema remain the foundation. This increment does not replace the trading system or introduce another project.

The codebase uses Next.js 16 / React 19 / TypeScript and plain CSS, a BFF proxy layer, Java 25 / Spring Boot and PostgreSQL/Flyway. Tailwind and shadcn were not installed; migrating frameworks would add churn without improving this delivery. Lucide React is the single new production dependency, justified by the requested shared icon language. No remote fonts, paid APIs, analytics or AI service were added.

No verified standalone SHL logo asset was found in the repository. The sidebar uses a typographic SHL wordmark with a NEXUS label; it does not claim to be an approved logo asset.

## Tokens

Source: `apps/web/src/app/nexus.css`; scoped under `.nx-shell` to avoid changing login and mandatory MFA enrollment.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nx-bg` | `#f4f7fb` | `#080d16` | Application canvas |
| `--nx-surface` | `#ffffff` | `#111e30` | Panels and forms |
| `--nx-subtle` | `#f3f6fa` | `#18283d` | Secondary surfaces |
| `--nx-ink` | `#162338` | `#eff5ff` | Main text |
| `--nx-muted` | `#42546b` | `#afc1d9` | Secondary text |
| `--nx-primary` | `#2858d5` | `#75adff` | Navigation and interaction |
| `--nx-success` | `#167353` | `#41c9a5` | Confirmed internal success |
| `--nx-warning` | `#965500` | `#f2be65` | Attention |
| `--nx-danger` | `#bb3544` | `#f18796` | Urgent/error |
| `--nx-line` | `#dce4ee` | `#29394f` | Borders |

Base rhythm: 8px, with 16/24/32px panel gaps; 12px surfaces, 7–10px controls, restrained shadows and 140ms hover transitions. Typography uses the existing Inter/system sans-serif stack, with no font download. Main headings are 26–30px; data density favors compact rows and bounded lists. Priority lists initially show five records with an explicit expand control; order snapshots show the four latest source rows. Lower cards do not stretch to fill unrelated empty space. Reduced-motion settings disable motion. Status always has text; color is supplementary. The authenticated workspace defaults to Executive Black; an explicit light preference persists in the existing theme cookie. Login and MFA enrollment stay outside this theme scope.

## Executive Black V3

`/workspace/command-center` uses the existing management-only team projection. Its six KPI cards are open team tasks, active leads, open RFQs, independent reviews awaiting the current reviewer, active line shipments, and overdue entries in the bounded alert feed. It does not project revenue, margin, cash exposure, or commissions. The priority table uses the existing bounded record snapshot; approvals continue through their original independent-action routes. At mobile widths it reduces to the matter and due date columns, while the pipeline keeps its own horizontal scroll region. Five disposable-browser viewport captures and axe results live under the ignored `.nexus-evidence/after/` directory.

## Reusable structure

- `WorkspaceIdentity`: existing shared authenticated identity and explicit commission access.
- `NexusShell`: one visible sidebar/topbar, breadcrumbs, current role, quick-create, alerts link, real logout and theme. Theme is a non-sensitive preference cookie read by the server to avoid a light flash on a dark reload. No authentication data is stored in browser storage.
- `OperationsCommand`: existing Ctrl/Cmd+K module finder, moved into the top bar; keyboard trap and focus restoration retained. It searches modules, not all company records.
- `NexusOverview`: My Day and management overview using the same projection and layout, with server-enforced personal/team scope.
- `WorkspaceDialog`: existing dialog focus/scroll behavior, reused by profile/import and existing forms.
- `NexusProfile`: saved customer/supplier contact snapshot and links to relevant existing desks.
- `ContactImport` + `contact-import.ts`: bounded CSV parsing, field mapping, validation, normalized-name duplicate review, explicit approval and truthful partial-save results.
- `ShipmentTimeline`: estimated dates and staff report timestamps; never presented as verified carrier ATD/ATA.
- Existing directory, CRM, RFQ, quotation, PO, compliance, shipment, finance and account components retain their business code. Scoped CSS adapters remove their duplicate visible navigation and map their surfaces into the shared theme.

## Six implemented review compositions

| Screen | Route | Composition |
|---|---|---|
| My Day | `/workspace` | Personal tasks/leads, permitted shared RFQs, source metrics, priorities, action center, stage links, orders and shipping watch |
| Executive Overview | `/workspace/command-center` | Team scope, independent quote/order/PO review links, task workload, nonfinancial stage metrics; management only |
| Customer CRM | `/workspace?view=customers` | Searchable directory, real create/edit, profile drawer, customer RFQ search, CSV review |
| Supplier Intelligence | `/workspace?view=suppliers` | Directory/profile, evidence-review deep link, CSV review; commercial review remains in the compliance desk |
| Trading / comparison | `/workspace/rfqs` | Existing RFQ/items workflow, side-by-side latest supplier revisions, sourced landed-cost scenarios and links to line quotations |
| Shipment control | `/workspace/shipments/line` | Eligible PO booking, milestones, document checklist, exceptions and staff-reported delivery |

The running screens are the high-fidelity implementations; screenshots are captured from Chromium, not generated mockups. The local before/after gallery is `.nexus-evidence/review/index.html`. Separate E2E screenshots use an isolated synthetic database and are clearly evidence, not live SHL metrics.

## Interaction and accessibility

One role-filtered navigation list; sidebar collapses behind a labeled mobile control. The menu has no truck-master, document-vault or report buttons pretending to be implemented. Existing specialist routes remain available where authorized.

Quick-create opens real existing customer/supplier/RFQ forms and supports repeated use on the same route. Profile dialogs restore focus to the triggering record. Lead priority links open the existing qualification triage, activity and consent detail; the read-only dialog takes initial focus at its heading rather than scrolling to a later input, with Tab/Shift+Tab containment and Escape dismissal. Import cannot save before validation and an explicit checkbox; failures do not masquerade as success. Date filters affect priority/alert lists, not all KPI counts. Source links remain available for full records outside bounded snapshots.

The responsive gates are 1440×1000, 820×1180 and 390×844. Axe scans target WCAG 2 A/AA, 2.1 AA and 2.2 AA tags on six core screens in both themes, plus the existing dashboard/alerts gate and a scoped dark lead-detail dialog scan. Passing these scans is not a full WCAG certification or physical-device/Safari review.
