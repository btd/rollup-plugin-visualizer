# Treemap v2 dependency inspector

Status: implemented and validated locally, 2026-11-22. The maintainer accepted the
UX direction and prototype, then confirmed output-group aggregation and individual
relationship rows. Following the instruction to continue refinement, the
coordinator selected the remaining defaults in D2–D7 and reviewed the revised
prototype. The maintainer subsequently required a separate template; use
`treemap-v2`, preserving existing `treemap` behavior and defaults. Production
implementation was authorized on 2026-11-21 and is complete in the working tree.
No commit, release, or hosted-viewer deployment was performed. Keep this feature's
design and implementation record in this document.

Code inspected: `fea6b017b2fbbbe9286cc437f900778657c1b6bb`. Reconcile the current
checkout before implementing; this is a reference baseline, not an instruction to
reset or overwrite later work. Follow [AGENTS.md](../AGENTS.md).

## Start here

- [Portable interactive prototype](prototypes/treemap-inspector.html): open locally
  in a current desktop browser. It has no build step, backend, or required external
  resources. Choose a **Prototype case** to inspect the stress states.
- [Agreed direction](#agreed-direction) records the maintainer's decisions.
- [Decisions](#decisions) records settled semantics and the reasons for them.
- [Acceptance scenarios](#acceptance-scenarios) defines observable outcomes.
- [Agent handoff](#agent-handoff) separates responsibilities and shared ownership.

The document controls intended behavior. The prototype illustrates interaction;
its styling is provisional. Reuse existing treemap rendering in the production
template. The prototype is not production implementation or a complete data contract.

## Problem and value

Help a developer investigate a large dependency directly from the treemap:

1. Notice a large package or group.
2. Find the application files that import it, without losing that answer among
   relationships internal to the package.
3. Follow **Imported by** and **Imports** in either direction, keeping paths and
   measurements readable and copyable.
4. Correct a mistaken selection or locate a tiny module without repeated zooming
   or precision clicks.

Moving the existing tooltip into a sidebar alone is insufficient. The additional
value is group-level relationship inspection, navigable file relationships, and
stable investigation context alongside the chart.

Relevant issues:

- [#183: Aggregated tooltip visual issue](https://github.com/btd/rollup-plugin-visualizer/issues/183)
  describes long module IDs making tooltips as wide as the viewport and large
  relationship lists growing taller than the viewport.
- [#179: Display imported by for groups](https://github.com/btd/rollup-plugin-visualizer/issues/179)
  asks where entire dependencies are imported. Its discussion also describes
  intermediary re-export modules absent from output rectangles.

## Agreed direction

| Decision | Reason |
| --- | --- |
| Optimize for developers investigating large codebases | Readable data, useful navigation, and chart space matter more than decorative styling. |
| Ship as a separate `treemap-v2` template | The maintainer requested an explicit template choice. Existing `treemap` keeps its behavior and remains the default. |
| Use an optional docked details inspector | Details must remain readable, selectable, copyable, and usable with long lists. |
| Hover previews; single click inspects; deliberate zoom is separate in `treemap-v2` | A missed click should be corrected directly, without undoing a zoom. The new interaction belongs to the separately selected template; existing `treemap` keeps single-click zoom. |
| Inspect files and groups | Package-level investigation is central to #179; individual-file tooltips alone do not solve it. |
| Support both Imported by and Imports | The maintainer explicitly prioritized reading/copying details and following relationships in both directions. |
| Following a relationship updates details without moving the chart | Investigating dependencies must not repeatedly rearrange the treemap. |
| Clear selection returns to the current view summary | Selection changes inspection; navigation moves chart and panel together, with a matching inverse. |
| Searchable group members provide an alternative to tiny rectangles | Known paths should be reachable without repeated drill-down or precision clicks. |
| Exercise realistic edge cases in the prototype and review | Long paths and large relationship lists are common working conditions, not deferred polish. |

Per-chart-node keyboard focus and browser-zoom improvements are not goals. Mobile
layouts, decorative redesign, and additional empty-report work were also excluded
from this discussion. Ordinary inspector controls should retain native keyboard
behavior; this does not imply tabbing through every chart node.

## Template selection and integration

Implement the inspector as `template: "treemap-v2"`, with display name **Treemap
v2**. This is an additional template, not a replacement or an option that changes
existing `treemap` behavior. Keep `treemap` as the plugin, CLI, and viewer defaults.
Plugin usage:

```js
visualizer({ template: "treemap-v2" });
```

Support the same template choice in CLI conversion, standalone HTML, and link
output. The shared viewer adds a Treemap v2 choice and a `treemap-v2/` report
route; its existing Treemap choice remains selected by default. Adding this
choice is the only planned change to the viewer's file-selection page.

Verified registration points in the current checkout:

- `plugin/template-types.ts` supplies the plugin type and CLI choices;
  `plugin/render-template/index.ts` dispatches standalone rendering.
- `rollup.config.js` and `rollup.config-dev.js` enumerate frontend builds.
  Use a dedicated `src/treemap-v2/` entry and scoped stylesheet rather than
  rewiring the existing treemap click handlers.
- `shared/share/url.ts` enumerates visual templates and creates per-template
  viewer URLs. `scripts/package-viewer.mjs` uses that enumeration to package
  report routes and chart assets. The report data format remains the same.
- `src/viewer/index.html` supplies diagram choices. Add the new choice without
  changing the existing default or redesigning that page.

Reuse existing helpers where behavior remains consistent, keeping new state and
styles isolated from the original template. Validate link output against a viewer
build containing the new route; hosted-viewer availability belongs to release
validation performed by the maintainer.

## UX contract

### Layout and inspection

- Keep the treemap as the primary workspace; details occupy a bounded side panel
  while enabled. Users can deliberately close and reopen it.
- Within a fixed viewport, size metric, visibility filter, panel configuration,
  and chart location, inspecting another node must not change chart geometry.
- Hover provides a brief path/size preview. It must not overwrite held inspector
  contents or make users chase controls to read or copy information.
- A single click holds the clicked target's details. Clicking the wrong target
  does not zoom. Clicking another target replaces the inspection directly.
- Double-clicking a group, or using an explicit chart-navigation action, zooms
  deliberately. Breadcrumbs permit direct ancestor navigation; Overview returns
  to the full report in one action.
- Opening/closing the panel or deliberately changing chart scope can alter chart
  geometry. This is different from an accidental reflow on every selection.
- Start with the inspector open on the root summary, labelled **All files**,
  without a chart selection highlight. **Clear selection** returns to the current
  chart scope's summary and resets local search, without changing chart zoom or
  visibility filters.
- Keep **Hide details / Show details** as an explicit chart-space control for now;
  the maintainer remains unsure whether the panel should be permanently visible.
  Hiding preserves the selection and local state. Clicking a chart target reopens
  details immediately. A group double-click still zooms the first clicked group,
  even when reopening the panel changes the layout between clicks.
- Group **Zoom to selection** and **Clear selection** as selection actions. Zoom
  enters the selected output occurrence/group in both chart and panel. The same
  button becomes **Undo zoom** when its effective selection is the current focus
  and zoom history exists; otherwise it offers **Zoom to selection**, disabled if
  already focused without an undo destination or no visible output is available.
  There is no separate Undo control. Inspecting another target makes the button
  offer Zoom; Clear selection returns to the current scope summary and exposes
  Undo again when history exists. Undo restores the previous chart scope and panel
  target, tab, query, list/identity/internal scroll, internal expansion, and chosen
  occurrence. A double-click captures the panel before its first click inspects
  the group; a hidden panel uses its last visible snapshot.
- Breadcrumbs and **Overview** move both chart and panel to the chosen location.
  A different breadcrumb starts a new location and discards obsolete zoom history;
  choosing the current breadcrumb restores its summary and keeps zoom undo.
  Undo does not revert independently changed metric, filters, or panel visibility. Keep readable action labels
  alongside Lucide SVG icons; do not use Unicode characters as icon substitutes.
- Allocate approximately 30% of workspace width to details, bounded to 300–380
  CSS pixels. Keep it beside the chart during desktop resizing and fit the
  available viewport height. The identity area and relationship list can scroll
  independently when necessary. D5 records the prototype evidence and tradeoff.

### Identity and sizes

- Distinguish a full module ID/path, its output chunk membership, and the displayed
  hierarchy path. A display path beginning with `root` is not a replacement for
  the module ID.
- Full IDs must remain available for reading and copying, including Unicode,
  spaces, literal percent escapes, virtual IDs, and identical basenames in
  different folders. Render paths and IDs as selectable monospace text, not form
  fields. Visual abbreviation must not alter the copied value.
- Use existing measurements and metric availability. Do not infer compressed
  measurements from a ratio or label an unavailable measurement as zero.
- State a percentage's denominator: the total measured module contributions in
  the containing output chunk, or in the report for a group spanning chunks.
  Use the selected metric and keep this denominator independent of interactive
  visibility filters and chart zoom. Label the chunk/report and measured scope;
  these totals need not equal the complete output file's byte size.
- Do not describe summed individual compression measurements as actual bundle
  transfer size. Distinguish graph-only membership from emitted size.

### Relationships

- For a file, **Imported by** lists its direct importers and **Imports** lists its
  direct dependencies available in the report. A file row displays the related module once. The selected file and active tab supply the other endpoint and direction. Hide any tab with zero items,
  including Files; select a nonempty section when the previous section is absent.
  Retain the section actually shown when following a relationship. Show counts in
  tab labels; repeat matching/total counts only during search.
  Search does not remove tabs. Internal relationships stay available even when
  Files is the only nonempty tab.
- For a selected group, default to relationships crossing its boundary: incoming
  edges originate outside and end inside; outgoing edges originate inside and
  end outside. Internal relationships remain separately accessible. Each internal
  relationship uses the same row component and styles as external relationships:
  a full-width primary path and secondary path with a directional arrow, with
  shared hover/focus highlighting. Internal endpoints are individually clickable.
  Long paths wrap within the same full-width layout; there is no separate grid.
- A group aggregates its descendant output files: sum their measured sizes and
  combine their recorded imports and importers. Use those same descendants for
  all three aggregations. Filesystem contents and matching directory/package
  paths do not add members. Related modules without output parts remain
  inspectable relationship endpoints.
- Show both ends of group relationships, for example
  `src/RevenueChart.tsx → node_modules/package/index.js`. The entry point matters,
  not just the fact that an outside file imports something in the group.
- Show one row per file-to-file relationship, preserving both endpoints; files in
  the same group may be imported by different entrypoints. Label counts as
  relationships. Full paths disambiguate identical basenames. D3 defines
  deduplication and ordering.
- Files default to largest first by the active size metric, with path order for ties and an explicit Path sort. Display NUL characters as `\0` in module names and accept that spelling in path search.
- Provide local path search for long relationship lists and group members. Keep
  it distinct from the report's include/exclude glob filters.
- A relationship row navigates the inspector to the related module. It does not
  zoom, change report visibility filters, or silently change a group boundary.
- A separate **Zoom to selection** action locates a target with output membership.
  Graph-only targets remain inspectable even when this action is unavailable.
- Keep dependency information within the report's known graph. A source import
  relationship is evidence of a relationship, not proof of a module's marginal
  contribution to downloaded bundle size.

### Selection and chart recovery

Selection changes only inspection. Following a relationship replaces the inspected
target and resets search; there is no inspector Back stack. Clear selection returns
to the current chart scope's summary. Navigation moves chart and panel together:
Zoom enters an exact output scope; Undo zoom restores the complete previous view;
breadcrumbs and Overview establish the chosen scope and its summary. Zoom history
records IDs and panel UI state, not mutable D3 nodes, measurements, or filters.
Traversing a cycle must not recursively expand an unbounded dependency tree.
Metric, viewport, and visibility changes retain the current target, section, query,
and scroll as closely as the layout permits.

Group members search must make tiny modules inspectable even when their rectangles
cannot display a label. Zoom to selection on an output file focuses that occurrence
alone, giving it usable chart space regardless of its share of the containing
chunk. Breadcrumbs restore its containing groups/chunk or Overview. The focused
file retains its real size and percentage denominator; focusing does not enlarge
the reported contribution. A group action focuses that group. D2 defines how to
choose among multiple output occurrences.

## Prototype and evidence

The prototype records the earlier interaction study. Its Back/history and
closed-panel behavior were superseded by the 2026-11-22 control refinement above.

The saved prototype contains these selectable examples:

| Case | What can be inspected |
| --- | --- |
| Many importers | 259 incoming relationships, a bounded scrolling list, search, and return to the previous list position. |
| Long Unicode path | A path over 200 JavaScript UTF-16 code units with Japanese, an emoji, and `café`; two files share `RevenueChart.tsx` as a basename. |
| No output rectangle | A re-export intermediary with usable incoming/outgoing relationships and no Zoom to selection action. |
| Tiny modules | 100 one-byte modules reached through group-members search; a nonzero size remains distinguishable from zero. |
| Hidden output selection | Details and relationships remain available while a chart visibility filter hides the target; clearing that filter explicitly restores chart navigation. |
| Entrypoints and import kinds | Several file-to-file relationships, an identical duplicate, and static/dynamic imports between the same endpoints. |
| Small report | The basic selection, relationship, and chart-navigation flow. |

In isolated Chrome, the prototype was checked for stable chart rectangles during
inspection/navigation, list/search/scroll restoration on Back, complete Unicode
path selection for clipboard fallback, duplicate-name disambiguation, graph-only
navigation, tiny-file search, and fitting its host at several widths. These checks
validate the sketch only. They are not production coverage, a large-codebase
performance result, or evidence for other browsers/bundlers.

The portable page was also opened directly from disk in Chrome and passed the
same stress-case checks without the conversation renderer. Browser assertions
must wait for asynchronous clipboard completion or the manual-copy state rather
than reading the status immediately after clicking Copy.

On 2026-11-21, the saved sketch passed 11 direct interaction/layout checks in
isolated Google Chrome 158.0.8127.36, opened from disk. Reproduce with:

```sh
node docs/prototypes/check-treemap-inspector.mjs
# For system Chrome instead of an installed Playwright Chromium:
CHROME_PATH=/usr/bin/google-chrome node docs/prototypes/check-treemap-inspector.mjs
```

The checks cover output-only group membership, both relationship endpoints,
static/dynamic deduplication, literal search/path ordering, closed-panel
selection/reopening, hover versus held selection, search/scroll restoration on
Back and metric changes, hidden-selection recovery, exact tiny-file focus,
Unicode copy completion, and resize retention. Screenshots were also visually
reviewed. Optional `INSPECTOR_SCREENSHOTS` saves review images to a chosen folder.

| Desktop viewport (CSS pixels) | Panel width | Chart width | Long-path relationship list height |
| --- | --- | --- | --- |
| 1440 × 900 | 380 | 1006 | 314.47 |
| 1024 × 768 | 300 | 670 | 182.47 |
| 800 × 600 | 300 | 446 | 60.58 |

All three fit without document overflow. The shortest desktop window shows a
small scrolling list; closing details recovers chart space. This validates the
chosen resizing policy for the sketch, not production geometry or performance.

Prototype shortcuts that must not become requirements or production code:

- A handwritten illustrative graph, synthetic file sizes, and compressed sizes
  calculated with fixed ratios; no production measurement claims follow from it.
- A single illustrative output chunk; real reports can contain multiple parts for
  one module.
- Synthetic output membership, a small layout implementation, and direct DOM
  rendering. The sketch now excludes its two explicitly graph-only modules from
  output groups. Production membership must come from serialized output parts;
  use the repository's Preact/D3 architecture.
- Page margins, review-case header, detailed styling, and optional host-state
  retention are illustrative. D5's panel bounds and viewport-fitting policy are
  chosen design defaults; the old fixed-height and stacked layout are superseded.
- Host-only optional state/design controls. The portable page works without them;
  the production report must not depend on the conversation host.
- Its scenario selector and example visibility checkbox are review aids, not
  additional product controls. Initial held targets belong to those scenarios;
  the production inspector starts without a held target. Mobile is out of scope.

## Verified repository constraints

| Area | Current evidence and implication |
| --- | --- |
| Frontend | Preact, TypeScript, D3 hierarchy, Sass. Treemap components live under `src/treemap/`; styles are `src/style/style-treemap.scss` and shared `src/style/_base.scss`. |
| Existing interactions | `src/treemap/chart.tsx` routes node clicks to `selectedNode`, and `main.tsx` uses that selection to alter layout sizes. Separating inspection from zoom requires separate state. |
| Data identity | `shared/types.ts` separates module metadata (`nodeMetas`) from output parts (`nodeParts`); one metadata record may have several `moduleParts`. Graph identity and a displayed chunk contribution are different concepts. |
| Group presentation | `plugin/data.ts` collapses single-child hierarchy paths. A group's visible name cannot automatically serve as a complete filesystem or package identity. |
| Current tooltip | `src/treemap/tooltip.tsx` shows Imported by only for leaves. It does not implement group boundary relationships or an Imports list. |
| Graph-only modules | A real Rollup 4 probe retained `src/main.js → package/index.js → package/internal.js` in metadata while the re-export `index.js` had no output part. Do not construct the inspector graph only from rendered leaves. This one probe does not establish all bundler cases. |
| Link direction | `ModuleMeta.imported` and `importedBy` contain adjacency. At this baseline dynamic flags are recorded on outgoing links; do not assume incoming adjacency carries equivalent flags. |
| Collection/filtering | `plugin/report.ts` collects source relationships separately from output membership. Configured filtering has a single selection stage; the inspector cannot recover nodes removed before serialization. |
| Measurements | `src/sizes.ts` controls available metrics. Current `plugin/sourcemap.ts` measures mapped spans in UTF-8 bytes while mapping columns/string offsets use UTF-16 code units. Existing tooltip copy referring to characters must not be copied as the measurement contract. |
| Delivery | Generated standalone HTML and the static viewer reuse chart code. Inspect `plugin/render-template/html.ts`, `src/viewer/report.ts`, and `src/viewer/template.html` when integrating. Preserve local processing and existing CSP. |
| Validation | Tests use generated `dist` files. Build before tests; frontend changes also require lint and frontend typechecking. Generated HTML snapshots are supporting checks, not interaction tests. |

Source contents and installed-package manifests are not part of the report data.
Do not promise to open source at an import line, infer exact package versions, or
fetch missing dependency information as part of this feature.

## Decisions

These rules are settled for the implementation handoff. D1 and D3's row/count
semantics were confirmed by the maintainer. The remaining defaults were selected
by the coordinator during the requested refinement, using the existing workflow,
serialized data, and prototype checks. Do not reopen routine presentation choices
when the product goal already supplies the answer. A concrete conflict discovered
in supported output should be investigated and recorded here rather than hidden
behind a new interpretation.

| ID | Status | Rule and rationale |
| --- | --- | --- |
| D1 | **Resolved** | A group aggregates the output files beneath it, using the same membership for sizes, imports, and importers. Do not expand membership from filesystem paths or package names. Graph-only modules can be related endpoints and navigated directly without becoming output members. This keeps group inspection consistent with the bundle represented in the chart. |
| D2 | **Settled default** | Read relationships from the report-wide module graph; label measurements by output chunk. The schema records adjacency on metadata without attributing each relationship to an output chunk, so do not invent chunk-local edges. A chart click selects that exact output part. Relationship navigation shows the target's available chunk contributions; with one occurrence, show its measurement, and with several, show separate labelled contributions without choosing or summing them into an unlabelled primary size. Zoom to selection focuses the sole occurrence or presents an explicit occurrence choice. Explicit chart navigation changes chart scope and panel target together. Percentages use the full measured containing-chunk total, or measured report total for a group spanning chunks; filters and zoom do not change this denominator. |
| D3 | **Resolved rows/counts; settled ordering/deduplication** | One row represents one file-to-file relationship and preserves both endpoints. Counts describe relationships, not unique importers or packages. Deduplicate identical source/target/import-kind tuples by metadata UID, retaining distinct static/dynamic relationships. Read kind from outgoing adjacency, which retains that information. Sort incoming rows by source path, target path, then kind; outgoing rows by target path, source path, then kind, using case-sensitive ordinal string ordering and UIDs as a stable tie-breaker. Static precedes dynamic when only kind differs. Search filters these rows without changing the count unit. A file's self-import appears in both direct lists; for a group it is one internal relationship. Following the currently inspected target is a no-op. |
| D4 | **Settled default** | Retain held details, output-group membership, measured totals, and report-wide relationships when interactive visibility filters change. Explain fully/partially hidden group membership and targets outside the current zoom. Zoom to selection may deliberately change zoom; a filtered-out occurrence is unavailable with an explanation until the user explicitly edits the filter. A partially visible group can be located with its remaining visible output and the hidden-members explanation. Filtering inspector lists as well would hide useful callers and change investigation context. Configured report filters still determine which data is available at all. |
| D5 | **Working default revised 2026-11-22** | Start with details open on the root All files summary. Clear selection returns to the current chart scope summary without zooming. Zoom, Undo zoom, and breadcrumbs follow the matched chart/panel navigation contract above. Retain explicit Hide details / Show details controls to recover chart space while permanent visibility remains undecided; node clicks reopen details. Group double-click still zooms the first clicked group. Details use about 30% of workspace width, bounded to 300–380 CSS pixels, beside the chart and within available viewport height. Identity content and lists scroll independently. |
| D6 | **Revised 2026-11-22** | Use case-insensitive literal substring search over full paths, matching either endpoint independently; whitespace is literal, with no glob/regex syntax or Unicode-normalization changes. Preserve D3 ordering. Tab labels show totals; show a separate matching/total count only during search. Hide zero-item tabs and retain the effective visible direction when navigating. A fresh target starts with an empty query at the top; a section change also clears search. Clear selection resets to the current scope summary. There is no inspector Back stack; zoom history restores the complete previous view, including panel tab/query/scroll/internal expansion and occurrence choice. Metric, viewport, chart zoom, and visibility changes preserve the current selection/query and retain scroll as layout permits. |
| D7 | **Separate template confirmed; settled communication** | Add `treemap-v2` for standalone HTML, CLI conversion, and shared-viewer/link output. Existing `treemap` retains its interactions and remains the plugin, CLI, and viewer default. Give Treemap v2 a visible hint: click to inspect, double-click a group to zoom; node clicks reopen hidden details, and Hide details / Show details explicitly controls chart space. Document explicit template selection, interactions, and the toggle in README usage, with a brief user-visible changelog entry alongside production implementation. Other diagram interactions remain as they are. No version or release action follows from this design discussion. |

### Worked examples (D1–D3)

These examples specify intended results, not bundler-fixture evidence. Suppose a
selected output group `package/` contains `a.js`, `b.js`, and `c.js`, measured at
10 KB, 20 KB, and 30 KB respectively. The report contains these relationships:

```text
entry-a.js → package/a.js
entry-b.js → package/b.js
entry-b.js → package/c.js
package/a.js → package/b.js
package/c.js → shared/helper.js
```

The group's measured size is 60 KB. Imported by has three rows, preserving the
first three endpoint pairs; Imports has one row, `package/c.js → shared/helper.js`.
The one internal relationship, `package/a.js → package/b.js`, is separately
accessible. Combining rows into an entrypoint/package summary would lose which
entrypoint uses which file and is not the chosen presentation.

For a re-export chain `app.js → package/index.js → package/implementation.js`, if
only `implementation.js` is an output member of the selected group, its incoming
row is `package/index.js → package/implementation.js`. Following that row opens
`index.js`, where `app.js → package/index.js` is available. Sharing a directory
does not add `index.js` to the output group or fabricate a direct
`app.js → package/implementation.js` edge. No size is fabricated for a module
without an output part.

Under D3's deduplication rule, two identical recorded static imports
with the same source and target produce one row. A static import and a dynamic
import between those same modules produce two labelled rows. These semantics are
settled; their production implementation still needs real-bundler validation.

For D2, suppose a module has a 10 KB contribution in `entry.js`
and a 4 KB contribution in `lazy.js`. Clicking its `entry.js` leaf shows 10 KB in
that chunk. Following a relationship to the module shows both chunk contributions
with their chunk names; Zoom to selection offers those two occurrences. The source
relationship is not duplicated merely because the target has two output parts,
and the report does not establish which part a particular relationship uses.

Use these expected rows/counts when implementing D1–D3. For D4–D6, follow the
current selection and panel contracts above; the saved prototype's history flow
belongs to the earlier interaction study.
Single-chunk prototype evidence does not validate production multiple-occurrence
data or generated-report integration.

## Acceptance scenarios

These are behavior requirements for the production feature under the
decisions above. A new agent should be able to run the relevant
scenario without needing this conversation.

| ID | Scenario | Observable outcome |
| --- | --- | --- |
| A1 | Click a file, then a neighboring file after missing the intended target | Details change directly; no zoom, geometry change, or backtracking is needed. Hover does not replace the held target. |
| A2 | Inspect a large group with both internal and boundary relationships | Incoming/outgoing lists show the expected boundary endpoints; internal links are separate. Counts match D3's documented unit. |
| A3 | Follow a re-export chain whose intermediary has no rectangle | Every metadata target remains navigable in both directions. No nonexistent output size or chart target is fabricated. |
| A4 | Search and scroll a long list, zoom, inspect another target, clear selection, and undo | Selection-only actions retain chart location. Clear selection returns to the current scope summary. The single context-sensitive button switches to Undo for the current focus and restores the prior chart and complete panel context. Filters and metrics changed independently remain in effect. |
| A5 | Read/copy long IDs containing non-ASCII characters and select duplicate basenames | Panel width stays bounded; full IDs remain accessible and copy exactly. Paths are plain selectable monospace text; copying uses normal browser selection. |
| A6 | Locate a tiny positive-size file through group members | A path search reaches its details without precision clicks. Small nonzero sizes are not displayed as measured zero. |
| A7 | Explicitly zoom, navigate breadcrumbs/Overview, or use Zoom to selection | Only deliberate chart actions move the view. Multiple-part behavior follows D2. Returning to details does not reset chart location. |
| A8 | Follow a cycle, self-import, or duplicate relationship present in supported output | Direct navigation terminates normally; no recursive expansion or infinite traversal. D3 determines distinct-edge handling. |
| A9 | Inspect a target outside the current zoom/visibility scope | UI describes its location/availability according to D4 and provides the agreed deliberate route to it. It does not silently reset filters. |
| A10 | Inspect a module present in multiple chunks or installed dependency copies | Measurements identify their scope. Different module instances stay distinct, even when basenames or package names match. |
| A11 | Open a report without gzip/Brotli measurements, or inspect an external/graph-only module | Unavailable data is distinguished from zero; only valid metric choices appear. Missing output membership does not remove available relationships. |
| A12 | Resize an ordinary desktop window with held details and long lists | Chart and panel remain usable; details do not overflow the window. Existing selection and local state survive according to the documented state policy. |
| A13 | Select `treemap-v2` for standalone file output, CLI conversion, and a shared viewer report | The new template is accepted and exposes the intended inspection/navigation behavior, stays local, and produces no new runtime/CSP errors. Viewer template selection creates the `treemap-v2/` route with the same report data. |
| A14 | Omit `template`, select existing `treemap` explicitly, and open its existing viewer route | Plugin, CLI, and viewer defaults remain `treemap`. Its single-click zoom, tooltip, and existing interactions remain intact; the new inspector appears only when `treemap-v2` is selected. Other templates retain their interactions. |

Do not create a separate empty-report redesign to satisfy these scenarios. A
file with no direct imports can use a small inline explanation inside its list.
Avoid source-string assertions as substitutes for exercising interactions.

## Agent handoff

Implementation sequence (2026-11-21):

- [x] Index stable output/group identities, measurements, and canonical edges;
  verify D1–D3 using real Rollup 4, Rolldown, and Vite reports.
- [x] Implement inspector selection and local list state with focused
  behavioral tests, keeping chart location separate.
- [x] Add the dedicated Preact/D3 chart, inspector, and scoped styles; verify a
  real file's two relationship directions and stable inspection in a browser.
- [x] Register `treemap-v2` in plugin/CLI, frontend builds, shared viewer URLs,
  packaging, and diagram selection, retaining every existing default.
- [x] Exercise A1–A14 in generated HTML and the shared viewer, including stress
  states, selectable paths, multiple parts, and desktop resizing.
- [x] Complete build, tests, lint, frontend typecheck, browser checks, review,
  README/changelog updates, and the acceptance evidence in this document.

This section allocates responsibilities; it is not a command to launch agents or
an authorization to implement, commit, push, or release. Work from the same agreed
revision of this document. The coordinator owns decisions crossing boundaries.

### Boundary contracts first

The following semantic contracts are settled. Choose concrete TypeScript names
and declarations before dependent implementation work runs in parallel; this is
implementation coordination, not an unresolved product decision. Names and files
are suggestions, not a second serialized data schema:

- A stable inspector target distinguishes metadata identity, an optional selected
  output part, and a group scope. Avoid holding a mutable D3 node as the sole
  selection identity across resize, metric changes, or relayout.
- A group scope fixes its descendant output-part UIDs independently of chart
  geometry and visibility. Sum those parts for sizes; derive its relationship
  membership from their metadata UIDs. A module appearing in several descendant
  output parts remains one graph identity, so it does not multiply relationship
  rows. Different metadata UIDs remain distinct even if display IDs coincide.
- A details result supplies the full ID, output membership, available sizes with
  explicit scope, group members, and relationship endpoints/count units.
- Chart scope and inspected target are distinct fields in one navigation state.
  Zoom, Undo, and breadcrumb actions update them atomically. Following an edge
  changes inspection without changing chart scope.
- Provider queries consume the serialized report; they do not recollect modules,
  remeasure code, reapply configured filters, or depend on panel geometry.
- A relationship query returns direct source UID, target UID, and import kind for
  every row, applying D3's classification, deduplication, and ordering. Incoming
  queries use the same canonical edges as outgoing queries so dynamic flags and
  counts cannot disagree between directions.
- Shared data indexes should be reusable across queries. Investigate actual large
  inputs before choosing extra caches, workers, or list virtualization; do not add
  dependencies or claim performance gains based on the small prototype.

### Ownership and parallel boundaries

| Role | Owns | Must coordinate / avoid |
| --- | --- | --- |
| Coordinator / integrator | This document, D1–D7 dispositions, provider/state contracts, new `treemap-v2` entry/wiring, scoped styles, template registration/build/viewer integration | Sole owner of shared registration/build/viewer edits and generated snapshots while parallel work is active. Preserve existing `treemap` handlers and behavior. |
| Graph/data agent | New pure inspector data helpers and focused tests, using the agreed contract | Do not change serialized schema, bundler collection/filtering, measurements, or infer group policy independently. |
| Inspector UI/state agent | New panel components and selection/list state, their focused behavior checks | Consume agreed results; do not duplicate aggregation, take ownership of zoom state, or independently edit shared base styles. |
| Verification agent | Real-bundler fixtures and browser assertions for A1–A14; focused review of scope and edge cases | Coordinate test/fixture ownership. Observe rendered behavior; do not patch implementation to make assertions pass without the owning agent's review. |

Keep each assignment small and verifiable. The suggested roles are not a request
for one large change per role. A useful first integration checkpoint is **a real
file's details and both relationship directions, with stable single-click
inspection**. Group aggregation then uses the resolved D1–D3 examples, and the
stress scenarios must pass before the feature is considered complete. Fixture
preparation can proceed alongside contract work; agents depending on an interface
must wait until that interface is settled.

Use separate worktrees/checkouts when available and authorized, or enforce explicit
file ownership in a shared workspace. In a shared checkout, only one agent should
run the full clean/build/snapshot-update pipeline at a time: `npm run build` cleans
`dist`, which other tests consume. Do not discard or rewrite unrelated work.

### Copyable assignment prompt

```text
Read AGENTS.md and docs/treemap-dependency-inspector.md, then inspect the current
code. Open docs/prototypes/treemap-inspector.html and exercise the edge-case
selector. Treat the document's agreed direction and acceptance IDs as the goal;
do not copy the prototype's synthetic graph, compression ratios, or layout code.

Assigned responsibility: <role and narrow scope>
Owned files: <explicit list>
Acceptance scenarios: <IDs>
Required upstream decisions/contracts: <resolved D IDs and interface revision>

First report any conflict between the current code and the handoff, plus any
unresolved decision that blocks your assigned scope. Do independent work only
where the contract is already clear. Keep cross-boundary decisions with the
coordinator and update this document when an agreed rule changes.

Use real supported-bundler output for bundler-sensitive cases and browser
interaction assertions for UI behavior. Before handing back, list changes,
acceptance outcomes, exact checks run, remaining uncertainty, and integration
needs. Do not commit, push, change release metadata, publish, or expand scope
without the maintainer's explicit instruction.
```

## Validation and completion

Use Vitest for pure queries/state and Playwright for interactions, following the
repository's existing conventions. Cover new template acceptance in plugin types,
CLI choices, standalone rendering, viewer URL validation, and packaged assets.
Add regression coverage that proves behavior,
not just snapshots. Test Rollup 4, Rolldown, and Vite output separately where
relationship/group semantics depend on the bundler. Include re-export
intermediates, multiple chunk membership, and non-ASCII IDs in those fixtures.

At the integration checkpoint, run:

```sh
npm run build
npm test
npm run lint
npx tsc -p src/tsconfig.json --noEmit
npm run test:viewer
npm run test:treemap-v2
```

The build must precede tests. Existing viewer browser checks are not automatically
coverage of the new inspector: extend the browser suite with A1–A14 as relevant.
The current test runner expects installed Playwright browsers. Installing browsers
or using system Chrome is an environment step, not an application change.

Refresh only snapshots affected by the intended generated-report change. Keep the
direct regression assertions as primary evidence. For geometry, declare CSS pixel
measurements and the viewport used; for text offsets/copy selection, declare the
unit and include non-ASCII cases. Support performance claims with before/after
measurements on representative reports; no latency budget has been agreed here.

Before completion, reconcile each acceptance ID with evidence, update status and
decision rows in this document, review AGENTS.md for durable findings, and add the
brief user-visible usage/changelog changes required by the final implementation.
No version bump or release action is part of this handoff.

### Implementation evidence (2026-11-21)

The implementation is isolated in `src/treemap-v2/` and
`src/style/style-treemap-v2.scss`. Existing treemap implementation/styles remain
unchanged. Registration covers plugin types, CLI choices, both frontend builds,
viewer URLs/assets, and the viewer's additional diagram choice. README usage and
the brief changelog entry are updated; package/release versions are unchanged.

Passing checks on the completed working tree:

- `npm run build`.
- `npm test`: 350 tests in 27 files, compile-time API checks, and packed consumer
  fixtures for Rollup, Rolldown, and Vite.
- `npm run lint` and `npx tsc -p src/tsconfig.json --noEmit`.
- `CHROME_PATH=/usr/bin/google-chrome VIEWER_TEST_BROWSERS=chromium npm run test:viewer`.
- `CHROME_PATH=/usr/bin/google-chrome npm run test:treemap-v2`.
- A deliberate edge-deduplication mutation failed the direct regression assertion;
  the source was restored byte-for-byte after the experiment.

Both browser suites used isolated Google Chrome 158.0.8127.36. Firefox and WebKit
were not installed in this environment and were not run. The dedicated inspector
suite exercises actual generated standalone HTML, CLI-generated HTML, and a local
packaged shared viewer, with no external runtime requests or console/CSP errors.
Production screenshots were reviewed. Following the presentation revision below,
the 800 × 600 CSS-pixel desktop group state has a 300 CSS-pixel panel and a
scrolling list containing 303 relationships that fits within the window. No
large-codebase latency or performance improvement is claimed from these checks.

| Acceptance | Direct evidence |
| --- | --- |
| A1 | The dedicated browser suite holds details without relayout or hover replacement; the shared-viewer suite also compares SVG geometry before/after file selection. A node click reopens hidden details; a delayed group double-click is tested across that resize. |
| A2 | `test/treemap-v2.test.ts` checks output membership, summed sizes, exact boundary endpoints, and internal classification on real Rollup 4, Rolldown, and Vite reports. Browser fixtures show 303 incoming and 61 internal group relationships. |
| A3 | All three bundler fixtures retain a graph-only re-export intermediary. Browser navigation follows its incoming/outgoing links and distinguishes missing output measurement from zero. |
| A4 | Six reducer tests cover synchronized navigation, nested undo, current-scope clearing, and selection/query transitions. Browser checks restore searched list scroll, internal expansion/scroll, a hidden panel snapshot, and multi-occurrence choice; Inspecting another target offers Zoom; Clear selection exposes Undo for the current view again. |
| A5 | Browser paths contain Japanese, emoji, accented text, spaces, and literal percent escapes. Duplicate basenames stay distinct. The exact full ID renders as selectable monospace text across desktop sizes; no dedicated copy control is used. |
| A6 | A real small positive-size output is found through Files search, inspected without a precision click, and deliberately focused into usable chart space without changing its reported measurement. |
| A7 | Browser checks double-click group zoom, chunk/Overview breadcrumbs, exact file focus, and synchronized breadcrumb/Overview navigation, Clear selection retaining chart location, and complete-view Undo zoom. A visible zero-byte output uses a layout-only focus weight while its measurement remains 0 B. |
| A8 | Real Rollup cycle/self-import fixtures terminate through ordinary direct navigation. Following the currently inspected file is a metadata-identity no-op and preserves an exact part selection. Pure queries preserve distinct static/dynamic edges and deduplicate exact repeats. |
| A9 | Browser checks fully hidden targets and partially filtered groups. Measurements/lists retain full scope; filters change only through user input. Zoom location and filter availability are described independently, including a group only partly represented in a focused view. |
| A10 | All three bundlers produce two output contributions for one mapped Unicode source. Browser checks offer and locate both chunks, distinguish installed package copies, and keep merged CLI `app.js` chunk denominators separate by hierarchy identity. |
| A11 | Browser fixtures exercise missing compressed metrics, available gzip/Brotli choices, a measured zero-byte output, and external/graph-only targets. Treemap-v2 CLI merges enable compressed metrics only when every input provides them. |
| A12 | Production browser checks preserve held context at 800 × 600, 1024 × 768, and 1440 × 900 CSS pixels; paths/panels/lists stay within desktop window bounds. |
| A13 | Actual standalone, CLI, and viewer reports run the interaction suite. Registration/link tests decode a real Rollup plugin link; packaging/type tests cover assets and public template selection. Viewer runtime retains its existing CSP and local processing. |
| A14 | Default generated HTML equals explicit original-treemap output. Browser checks verify its single-click zoom and absence of the new inspector. The shared-viewer suite retains its default selection and exercises every diagram. |

The read-only second-model review identified additional cases now covered by
regressions: internal-list navigation, same-file navigation, identical chunk names in
CLI merges, mixed metric availability, zero-byte focus, and wide hierarchy traversal without an argument-limit failure. A
150,000-sibling pure traversal test covers the last case; it is not browser
rendering or performance evidence. The review's follow-up location wording was
also corrected.

### Renderer and presentation revision (2026-11-21)

The maintainer requested reuse of the original treemap and production styling
that improves on the prototype. V2 now copies the original node, layer, and color
implementations with adapters for inspector identity and double-click navigation.
It uses the original padding, rounded rectangles, contrast, label positioning and
scaling, and resquarify layout. Filter and metric changes retain the layout's row
cache; deliberate zoom preserves full-report colors and depth shading. The original
template's source and styles remain unchanged.

The visible template heading, outer frames, panel divider, row borders, and
duplicated hints were removed. Controls and rows use a quieter presentation with
more chart/list space. Relationship endpoints remain readable and copyable;
routine static-edge labels are omitted unless needed to distinguish a static and
dynamic pair. Measurement help is a disclosure instead of a permanent paragraph.

Browser assertions compare actual original and v2 geometry, colors, rounded
rectangles, and label attributes at equal chart dimensions, before filtering,
after filtering, and after restoring visibility. Separate checks preserve colors
through zoom and hide a filtered focused zero-byte file. The inspector suite
passes for generated standalone, CLI, and shared-viewer reports. Screenshots were
reviewed at 800 × 600 and 1440 × 900 CSS pixels with a large relationship list and
long Unicode paths. Build, all 350 tests and consumer fixtures, lint, frontend
types, and the shared-viewer Chrome suite pass. Firefox and WebKit remain untested.
AGENTS.md now records that prototypes are interaction references and existing
components/renderers should be reused where they apply.

## Scope boundaries

The feature is the new `treemap-v2` template in generated HTML, CLI conversion,
and the shared viewer. Add the necessary viewer choice and template registrations,
preserving existing `treemap` behavior and defaults. It does not authorize
redesigning existing treemap, network, flamegraph, sunburst, 3D treemap, or the
viewer file-selection page; changing measurements or configured filtering;
introducing a new report schema; fetching source/manifests; comparing builds;
installing UI dependencies beyond the explicitly requested Lucide icons; or implementing full transitive dependency-path
analysis. The rapid-edit filter bug was fixed separately and is not an open task
in this feature.

## Handoff record

- 2026-11-20: Captured the accepted investigation workflow, preserved the
  interactive prototype with stress cases, separated provisional semantics from
  decisions, and recorded acceptance and agent ownership boundaries. Source and
  prototype evidence above describe this handoff, not a shipped inspector.
- 2026-11-21: Resolved group aggregation around descendant output files and
  confirmed one row per file-to-file relationship, preserving both endpoints
  across different entrypoints. Added worked examples and labelled remaining
  defaults as recommendations. No production or prototype implementation changed.
- 2026-11-21: Completed the requested refinement by selecting D2–D7 defaults,
  clarifying provider/state semantics, and aligning the portable prototype with
  output-only groups, bounded desktop sizing, hidden selections, stable search
  and history, and exact file focus. Added a repeatable browser review script;
  11 checks passed in isolated Chrome and desktop screenshots were reviewed.
  Production implementation and production acceptance coverage remain pending.
- 2026-11-21: The maintainer requested a separate template. Selected `treemap-v2`
  and updated integration points, D7, and acceptance coverage to preserve existing
  `treemap` interactions and defaults. This supersedes earlier wording about
  integrating the inspector into ordinary treemap. Production code is unchanged.
- 2026-11-21: Implemented the separately selected template, completed A1–A14
  evidence above, and addressed review findings with direct regressions. Build,
  350 tests, consumer fixtures, lint, frontend types, and both Chrome browser
  suites pass. Work remains uncommitted; release and hosted-viewer deployment
  remain with the maintainer.
- 2026-11-21: Replaced the custom chart rendering with adapted copies of the
  original treemap and simplified the surrounding production UI in response to
  maintainer feedback. Renderer parity and existing inspector checks pass.

- 2026-11-21: Replaced the inspector path/ID textarea with wrapping, selectable
  monospace text. Removed the Copy button and clipboard code at the maintainer's
  request; use ordinary browser text selection/copying. Hide empty tabs and choose
  a nonempty section automatically; preserve access to internal relationships
  when Files is the only tab. Renamed the explicit focus action to **Zoom to
  selection**. Browser checks cover Unicode paths, zero-item sections, and
  navigation between targets with different available tabs.

- 2026-11-22: Replaced inspector Back/history with Clear selection and an All
  files root summary, without changing zoom. Grouped selection actions and removed
  Unicode control glyphs. Kept an explicit Hide details / Show details toggle while
  permanent visibility remains undecided; node clicks reopen details. Counts are
  repeated only as search match counts. Added regressions for group double-click
  across panel reopening and retaining the effective relationship direction.

  Final local validation passes: build, all 350 tests and packed consumer
  fixtures, lint, frontend types, and both Chrome browser suites. The inspector
  suite includes native delayed double-click after panel reopening, rapid
  corrective selection, effective-tab navigation, root reset without chart
  movement, and desktop screenshots at 800 × 600 and 1440 × 900 CSS pixels.
  Large-codebase startup of the initial root Files list remains unbenchmarked;
  the shared viewer's 10,000-record stress check covers transport, not chart/list
  rendering. No performance improvement is claimed.

- 2026-11-22: Added the explicitly requested Lucide Preact icons for selection
  actions, panel visibility, relationship directions, and disclosure indicators.
  Selected named icon imports are bundled into standalone reports and the viewer;
  text labels remain available, and controls keep their existing behavior.

- 2026-11-22: Implemented the maintainer's matched navigation model: zoom and
  breadcrumb actions move chart and panel together; Undo zoom restores the full
  previous view; Clear selection returns to the current scope summary. Undo stays
  available beside breadcrumbs while history exists, and focused selections
  cannot be zoomed again. Independent metric/filter changes remain in effect.
  Internal relationships now have one shared hover/focus area per edge, with two
  clickable, wrapping endpoint columns. Validation includes nested undo, double-
  click pre-gesture restoration, hidden-panel scroll, chosen output occurrences,
  expanded internal relationships, and whole-row hover.

  Final validation for this update passes: build, 352 tests across 27 files,
  packed Rollup/Rolldown/Vite consumers, lint, frontend types, and both Chrome
  suites. Undo while hidden defers scroll restoration until the panel is visible;
  screenshots of shared relationship hover and focused navigation were reviewed
  at 800 × 600 and 1440 × 900 CSS pixels.

- 2026-11-22: Restored the explicitly requested single Zoom to selection / Undo
  zoom toggle in the inspector, matching Show details / Hide details. Removed
  the standalone navigation Undo button. Internal and external relationships
  now share RelationshipRow and the same full-width path styles; internal rows
  retain two endpoint buttons without a second layout implementation. Browser
  checks compare their rendered padding and path alignment and cover the toggle
  after selection, nested undo, and Clear selection.

  Build, 352 tests and consumer fixtures, lint, frontend types, and both Chrome
  suites pass for the shared-renderer and single-toggle update. Visual review at
  800 × 600 and 1440 × 900 CSS pixels confirms full-width endpoint paths and
  one Zoom/Undo control.
