**Issue #210 — root-cause analysis**

Date: 2026-11-12. Examined repository HEAD `498c5cb` (package version 7.1.3).
Scope: RCA, recommendations, and the subsequently approved implementation. The original evidence
below records pre-fix behavior; implementation and final validation are recorded at the end.
No commits were created.

Current status: the user approved the revised architecture, and selection before report
construction is implemented. The architecture review and redesign validation at the end supersede
the earlier approach of early size filtering alongside final metadata pruning.

The reported mismatch is confirmed. Configured exclusions remove module size records, but the
subsequent dependency-graph collection creates metadata and links for those same modules again.
The network chart displays metadata nodes, including nodes with no size records. Its UI filters
operate directly on those nodes, so entering the same exclusions in the UI hides them successfully.

**Evidence from the original report**

The [issue](https://github.com/btd/rollup-plugin-visualizer/issues/210) supplies a
[Vite configuration](https://github.com/user-attachments/files/22014927/vite.config.txt) and
[generated stats.html](https://github.com/user-attachments/files/22014904/stats.html).
Both attachments were downloaded and inspected. The configuration uses the documented object
format for file filters and selects the network template.

The attached report contains 4,523 metadata nodes and 1,421 module size records. Its embedded
environment identifies Rollup 4.48.1; it does not identify the visualizer package version.

| Excluded package | Metadata nodes still present | Nodes with module size records |
| --- | ---: | ---: |
| date-fns | 702 | 0 |
| lodash-es | 640 | 0 |
| lucide-react | 1,639 | 0 |
| Total | 2,981 | 0 |

All 2,981 IDs match the configured patterns using the current shared matcher. Their `moduleParts`
objects are empty, and no `nodeParts` record references their metadata UIDs. Their dependency links
remain present. This supports the conclusion that configuration filtering did take effect during
size collection; the graph retained the excluded modules afterward.

The attached frontend constructs nodes from metadata, sums an empty list of size records to zero,
and does not skip zero-size nodes. Its UI starts with empty filter strings. Applying the three
file exclusions to the metadata reduces the matching visible-node set from 4,523 to 1,542.
This was verified by evaluating the matching logic, without an interactive browser session.

Although the Vite configuration enables build source maps, the visualizer option `sourcemap`
defaults to false. The embedded report confirms `options.sourcemap: false`.

**Causal path in the current code**

1. [Shared matching](../shared/create-filter.ts) is used by both plugin collection and UI filtering.
   The UI's [prepareFilter](../src/use-filter.ts) converts the comma-separated input into file
   filter objects. Missing or null bundle patterns both mean “any bundle,” so the issue's two
   forms have equivalent matching semantics.
2. [generateBundle](../plugin/index.ts), lines 224–241, filters modules before `buildTree` in both
   source-map and ordinary collection. Excluded modules therefore receive no tree leaves or size
   records at this stage.
3. The same function, lines 257–263, calls `addLinks` from each chunk facade without passing any
   filter. [addLinks](../plugin/data.ts), lines 109–151, follows static and dynamic imports without
   checking the collection filter.
4. [ModuleMapper](../plugin/module-mapper.ts) creates metadata on demand when links are added.
   `getModuleUid` initializes `moduleParts: {}` even for modules excluded from size collection.
5. [createChartData](../src/network/data.ts) creates a network node for every metadata entry.
   [The network view](../src/network/main.tsx) applies only its current UI filters to those nodes.
   The configured filters are not supplied as initial UI filter state; the serialized data's
   `options` contains only size/source-map flags.

The result is two different filtering boundaries: collection filters the size/tree data, while
interactive filtering controls visible graph nodes and their links. Shared glob matching alone
does not make those boundaries equivalent.

**Current reproduction**

Real bundles were generated using the rebuilt plugin, Rollup 4.67.5, and Rolldown 1.2.16.
The fixture uses an entry named `src/入口😀.js` importing one module from each excluded package,
an external dependency, and an unused local module. Each package module exports
`const value = Math.random() + N`, keeping it in the generated bundle. The package contents are
minimal fixtures; installing the actual libraries is unnecessary to reproduce the graph behavior.

The config exclusions are exactly:

```js
exclude: [
  { file: '**/node_modules/date-fns/**' },
  { file: '**/node_modules/lodash-es/**' },
  { file: '**/node_modules/lucide-react/**' },
]
```

The reproduction inspects emitted `raw-data` reports using the current network data functions,
UI parser, and shared matcher. It asserts membership and links directly.

| Bundler | Visualizer source-map attribution | Package nodes before filtering | After config exclusion | Size records for excluded packages | After equivalent UI exclusion |
| --- | --- | ---: | ---: | ---: | ---: |
| Rollup | Off | 3 | 3 | 0 | 0 |
| Rollup | On | 3 | 3 | 0 | 0 |
| Rolldown | Off | 3 | 3 | 0 | 0 |
| Rolldown | On | 3 | 3 | 0 | 0 |

In every case, configuration exclusion leaves all five fixture dependency edges present.
Equivalent UI exclusion reduces the edge count to two. Restricting config `include` to
`**/src/**` also leaves all three package nodes in the network metadata.

**Related confirmed defect: empty-chunk fallback**

In [generateBundle](../plugin/index.ts), lines 244–251, an empty filtered tree triggers a fallback
that records the entire chunk's code under its facade module, or a synthetic ID. That fallback
does not check the filter or distinguish “no attribution available” from “everything excluded.”

Using `exclude: { file: '**' }` still produces one positive-size record in every reproduction:
192 and 226 bytes for Rollup with attribution off and on, and 380 and 414 bytes for Rolldown.
These are UTF-8 byte counts of generated chunk code; source-map comments account for the differing
output sizes. The fixture includes a non-ASCII entry filename.

This is a separate path that can defeat exclusions in tree-based reports as well. It is not needed
to explain the original attachment, whose excluded packages have no size records.

**Scope and coverage gap**

The primary defect affects network visibility and the graph contained in raw-data exports.
Code inspection also shows that the treemap, flamegraph, and 3D treemap tooltips list importers
from the unfiltered metadata, and Markdown counts static/dynamic imports and entry/external flags
from that metadata. Markdown's module count already requires size-record membership; excluded
metadata with no parts does not increase that module count. These additional paths were inspected
in code, rather than exercised in the original reproduction.

When a chunk retains included modules, its tree and module size records do honor the collection
filter. The empty-chunk fallback is the additional exception described above.

The relevant separation predates the recent network rewrite: commit `5307149` introduced backend
filtering in size collection in December 2022 while leaving link collection and the fallback
unfiltered. The attached 2025 report independently demonstrates the same metadata behavior.

Existing shared-filter tests check matching predicates, and the E2E exclusion tests compare
snapshots. They do not directly assert that configured exclusions remove network nodes and edges.
The network tests exercise UI filtering and intentionally support nodes with no rendered parts.
Consequently, dropping every node with empty `moduleParts` would also remove legitimate external
or tree-shaken dependency nodes. A later fix needs explicit behavior for those nodes and for
bundle-specific filters, whose membership information may be absent after collection filtering.

Useful regression cases for the eventual fix are configured file exclusions, include-only filters,
static and dynamic links, wholly excluded chunks, bundle-specific filtering, and legitimate
zero-part dependencies, using actual supported bundler output.

**Proposed report contract**

Treat config `include`/`exclude` as defining report contents. Apply that decision consistently to
tree leaves, size records, metadata nodes, both link directions, tooltip references, and the inputs
to summary calculations. Interactive UI filters control visibility within that report. They
cannot restore modules removed by configuration.

This contract preserves legitimate zero-size, external, and tree-shaken nodes when they pass the
filter. Each template can keep its existing definition of a module count or size total, provided
it derives that value from the filtered report. The proposal does not make all templates count
the same kinds of modules.

This strengthens the acceptance criteria rather than requiring a different recommendation:
backend normalization already addresses shared report data. A frontend-only constraint no longer
qualifies as a complete fix. Preservation of accidental excluded metadata is not a compatibility
goal; preservation of valid unfiltered data and documented bundle matching is.

**Considered approaches and their tradeoffs**

These are design options based on the verified causal path. Their implementations have not been
tested or benchmarked. Both backend options need the empty-chunk fallback corrected: distinguish
unavailable attribution from intentional exclusion, and allow a fallback only when its own
bundle/module identity passes the filter. An entirely excluded attributed chunk must stay absent.

| Option | Approach | Benefits | Costs and risks |
| --- | --- | --- | --- |
| A — rejected | Pass configured filters to the frontend and apply them as a fixed visibility constraint in addition to editable UI filters. | Addresses the visible network mismatch. | Fails the report-content contract: excluded metadata and links remain in exports, tooltip sources, and summary inputs. Does not qualify as a complete fix regardless of its implementation effort. |
| B | Make graph collection enforce a precomputed module eligibility decision before creating metadata or links. | Produces consistent reports and exports; avoids constructing metadata that will be rejected. | Changes traversal's interaction with metadata creation. Traversal must continue through rejected modules so allowed descendants are still discovered, and links must be emitted only when both endpoints are eligible. Shared modules require a report-wide eligibility decision before traversal; the existing visited set cannot safely carry a decision made for only one chunk. |
| C | Collect dependencies as today, then normalize the completed report by removing rejected metadata and links before hashing and serialization. | Applies one final consistency boundary to every template and export. Preserves the current traversal and its discovery of allowed descendants. Can retain the current serialized data shape. | Temporarily constructs rejected graph data and adds a normalization pass. Must retain original IDs and membership decisions internally until that pass, remove both link directions, and verify that tree leaves and size records still reference retained metadata. |

A shortcut that removes all nodes with empty `moduleParts`, or with zero rendered bytes, is
unsuitable: it also removes legitimate external and tree-shaken dependencies. Another unsafe
shortcut is stopping traversal at an excluded node, which can hide included descendants. Neither
shortcut is included as a viable option in the scoring below.

**Weighted comparison**

Compliance with the report-content contract is a prerequisite. A fails that requirement and is
excluded from scoring. The weights compare the two backend options on consistent filtering across
developer reports and preservation of legitimate data.
Scores are qualitative design judgments on a 1–5 scale, where 5 is best. Effort, agent workload,
and implementation time are excluded from scoring. Totals are weighted averages, not measured
results.

| Criterion | Weight | B: collection enforcement | C: final normalization |
| --- | ---: | ---: | ---: |
| Correctness across charts, exports, tooltips, and summaries | 50% | 5 | 5 |
| Preservation of legitimate graph-only nodes and bundle semantics | 30% | 4 | 4 |
| Maintainability and clarity of the filtering boundary | 20% | 3 | 4 |
| Weighted score out of 5 | 100% | **4.30** | **4.50** |

B and C can both address the complete defect. B couples eligibility checks
to the traversal's metadata and link creation; those checks must remain consistent at every
creation point. C scores better on maintainability because it keeps discovery separate from
final report eligibility, at the cost of an extra pass and temporary graph data. Both receive 4
for preservation of legitimate data because their treatment of bundle filters and graph-only
nodes needs explicit regression coverage. Maintainability here concerns the clarity of invariants and risk of future
defects, rather than the amount of work agents perform.

**Recommendation: C, final normalization**

Prefer C together with the fallback correction. Its advantage over B is an explicit final
consistency boundary that keeps eligibility rules separate from dependency discovery, while
fixing the exported report data as well as network visibility.
No performance advantage is claimed. B would become more attractive if representative measurements
showed that temporarily retaining the excluded graph creates a material memory problem.

The recommended behavior for implementation review is:

- Apply config filters using original module IDs and actual output bundle names. Keep the
  raw-ID-to-UID association internally until normalization; `projectRoot` trimming is presentation
  logic and must not change config matching.
- Record module membership before collection filtering removes it. A module with original
  memberships in several bundles remains a graph node if at least one `(bundle, module)` pair
  passes. Keep size records only for allowed pairs. A node rejected in every original bundle must
  not be reconsidered as a graph-only node after its parts disappear.
- For genuine graph-only nodes with no known output membership, evaluate the file ID with an empty
  bundle ID. This follows the current network UI's `matchesFilter` convention: no-filter reports
  retain these nodes, file filters can select or reject them, and an ordinary named-bundle include
  does not match them. This is a proposed policy for config filtering, not an established backend
  guarantee; it should be documented with the fix. Do not infer membership from arbitrary import
  reachability across chunk boundaries.
- Retain allowed descendants even if an intermediary is excluded. Keep only existing direct edges
  whose endpoints both survive; filter both `imported` and `importedBy`. This matches UI filtering
  without inventing replacement links through hidden nodes.
- Normalize before report hashing and rendering, so templates, raw-data consumers, and tooltip
  lookups receive consistent references. Summary calculations, including Markdown import counts,
  use that same filtered data. The UI then applies its interactive filters to the already-filtered
  report.

For example, if an entry imports an excluded library which imports an allowed utility, keep the
entry and utility. Remove the library and its incident links. Do not invent an entry-to-utility
edge. If every module in the library's chunk is excluded, do not add the full chunk back as a
fallback size record.

The implementation should prove these rules with real Rollup 4 and Rolldown output, including
dynamic imports, an excluded intermediary, a module shared across allowed and rejected bundles,
an excluded entry, and the Unicode filename already used by the reproduction. Also assert that
all tree UIDs, `metaUid` references, and both link directions resolve after normalization. Preserve
no-filter external and tree-shaken nodes, and test genuinely missing attribution independently
from deliberate exclusion. Explicitly verify that excluded IDs cannot appear in exported nodes,
tooltip importer lists, or retained links; import summaries must count only retained links.
An all-excluded input must produce a valid empty report and render the empty state in each chart,
without restoring chunk sizes. Check no-filter reports for preservation of legitimate nodes,
links, and sizes. Check Vite integration separately. Snapshot updates alone would not establish
those properties.

The user subsequently approved implementation of this recommendation.

**Original investigation validation**

- `npm run build`: passed.
- Direct reproduction assertions: passed for both bundlers with attribution off and on.
- `npm test`: type checks and all 206 tests across 17 unit-test files passed. The Rollup consumer
  fixture passed. The Rolldown consumer fixture stopped during dependency installation because npm
  could not resolve `@oxc-project/types@=0.158.0` (`ETARGET`); the Vite consumer fixture was not reached.
- At this stage, no production code, regression tests, or dependencies had been changed. These
  build and test results describe the original RCA run.

The original application was not rebuilt because its source and lockfile are not attached. The
original generated report and current minimal reproductions independently establish the root cause.

**Implementation and final validation**

Implemented the recommended backend normalization. Original output and source-map memberships
are recorded before size filtering. Metadata serialization uses the original module IDs and those
memberships to retain eligible nodes and remove links to rejected nodes in both directions.
Dependency traversal still discovers allowed descendants through excluded intermediaries. Size
records and tree entries continue to be filtered during collection.

The chunk fallback now distinguishes missing attribution from intentional exclusion and checks the
eligibility of known output modules and the fallback identity. Eligible missing-attribution chunks
still report their emitted code size in UTF-8 bytes. Source-map filenames are decoded back to
filesystem IDs, preventing encoded Unicode, spaces, and percent signs from creating separate size
and dependency identities or defeating filters.

The frontend entry points use a shared renderer for an accessible empty state when a size chart
has no tree entries or the network has no metadata nodes. The generated HTML only embeds data and
bootstraps the chart. A report containing only eligible graph-only dependencies still
renders those dependencies in the network. No-filter zero-byte modules retain their memberships.
The README documents the report-wide filter semantics; the changelog records the user-visible fixes.

Added 64 direct regression tests in [filtering.test.ts](../test/filtering.test.ts) and
[empty-report.test.ts](../test/empty-report.test.ts), using real Rollup 4 and Rolldown output and
separate Vite integration checks. Coverage includes file and bundle
filters, combined patterns, include/exclude precedence, excluded entries and intermediaries,
static/dynamic links, shared source membership across chunks, graph-only and zero-byte modules,
missing-attribution and synthetic fallbacks, Unicode/escaped filenames, retained sizes including
compression, all HTML/text templates, summary counts, importer-reference integrity, and empty-state
frontend rendering through the HTML bootstrap on initial load and resizing. Existing snapshots were updated as supporting
coverage.

Final checks:

- `npm run build`, `npm run lint`, `npm run test:types`, and frontend `tsc --noEmit`: passed.
- Strict TypeScript checking of the new test and fixture: passed.
- Full unit suite: 270 tests passed across 19 files.
- Local Chrome smoke checks: 20 passed, covering all five diagrams with normal, filtered, empty,
  and graph-only reports, including resizing and checks for page errors.
- The standard `npm test` consumer phase still stops on the pre-existing npm `ETARGET` resolution
  of `@oxc-project/types@=0.158.0`. All three packaged consumer fixtures passed when their temporary
  copies were pinned to installed tool versions, including Rollup 4.67.5, Rolldown 1.2.16, and Vite
  8.3.5. This fallback retained the fixture assertions about absent unrelated bundlers and strict
  declaration checking. Repository dependencies and fixture manifests were not modified.

The browser and pinned-consumer scripts used for this session are temporary verification tools;
the 64 regression tests are part of the repository's normal unit suite. The original reporter's
application was not rebuilt, as its source and lockfile were unavailable.

**Architecture review — revised recommendation, subsequently approved**

The implemented solution became a hybrid: config matching occurs in source-map size collection,
ordinary size collection, fallback eligibility, and final metadata selection. The mapper also
accepts a selection predicate. Although the behavior tests pass, the correctness of the report
depends on those separate decisions remaining consistent. The earlier maintainability assessment
did not adequately account for that coupling.

The architectural requirement should be explicit: one backend stage owns configured
`include`/`exclude` selection. Collection records facts, and downstream builders consume selected
data. Keeping the interactive UI matcher is appropriate: it controls visibility within an already
selected report and does not reapply plugin configuration.

| Approach | Benefits | Tradeoffs |
| --- | --- | --- |
| Extract the current checks into helpers | Makes `generateBundle` shorter. | Retains selection during both collection and serialization, plus filtering-dependent fallback handling. Rejected because it does not establish one owner of report contents. |
| Collect the complete final report, then filter it once | One explicit selection boundary; preserves much of the existing report-building structure. | Must update tree leaves, size records, memberships, metadata, and both link directions together. Original identity and membership must survive until filtering. Compression has already been performed for rejected parts. |
| Collect raw facts, select contents once, then construct the report | Selection operates on original identities and memberships before derived structures exist. The tree, size records, and links are built from the same selected input. Compression can be deferred until selection is complete. | Requires a small internal collection representation and separating dependency discovery from writes into the final mapper. That representation must describe graph-only modules and missing attribution explicitly. |

Correctness and preservation of legitimate data remain requirements for either viable option.
Using the same weights as before gives the following qualitative design assessment; these scores
describe intended properties, not proof from an implemented redesign. Effort is excluded.

| Criterion | Weight | Filter the completed report | Select before report construction |
| --- | ---: | ---: | ---: |
| Correctness across charts, exports, tooltips, and summaries | 50% | 5 | 5 |
| Preservation of legitimate graph-only nodes and bundle semantics | 30% | 4 | 4 |
| Maintainability and clarity of the selection boundary | 20% | 4 | 5 |
| Weighted score out of 5 | 100% | **4.50** | **4.70** |

Recommend selecting before report construction. Its maintainability advantage is that it avoids
repairing multiple derived representations after filtering. No runtime performance advantage is
claimed; representative measurements would be needed for such a claim.

The intended flow is:

```text
Collect original module/chunk facts and dependency links
    -> Select report contents using config filters
    -> Measure selected contributions and build the report
    -> Trim display paths, hash, and render
```

Collection must preserve original IDs, known bundle memberships independently of size attribution,
raw dependency links, and attribution availability. Ordinary modules and source-map contributions
feed that same internal collection representation. Missing attribution creates a fallback
candidate before selection; filtering an attributed chunk to zero modules never creates one.
The selector owns fallback eligibility, including its identity and any known output membership.

The selected result contains eligible contributions and graph nodes, with direct links only
between retained endpoints. An allowed descendant remains discoverable through an excluded
intermediary. Existing rules for shared memberships, empty-bundle matching of genuine graph-only
nodes, and zero-size modules remain the behavioral target.

Report construction consumes that result without reading config filters: size calculation,
`buildTree`, mapper population, and serialization do not decide eligibility again. The mapper's
filter callback can be removed. Original identities remain available until matching is complete;
`projectRoot` trimming remains a display concern. The serialized report schema need not change.

This is a targeted reorganization of collection and selection, not a proposal for a generic
pipeline framework or changes to interactive filter semantics. The current behavior tests provide
regression criteria, but have not validated this revised architecture. No production code was
changed or reverted during this review.

**Redesign implementation and validation**

Implemented the three stages in [report.ts](../plugin/report.ts), with
[generateBundle](../plugin/index.ts) calling them in order:

```ts
const collected = await collectReport(outputBundle, collectionOptions);
const selected = selectReport(collected, opts.include, opts.exclude);
const report = await buildReport(selected, projectRoot, getModuleLengths);
```

Collection preserves original IDs, output/source-map memberships, contributions, dependency
links, and missing-attribution fallback candidates. It does not apply config filters or construct
the final tree. Membership facts distinguish output membership from actual graph-node evidence.

`selectReport` is the sole backend owner of config matching. It selects contributions and graph
nodes, decides fallback eligibility, and retains direct links between selected endpoints. The
result omits the membership bookkeeping that construction no longer needs.

Construction measures selected contributions, builds tree entries, and populates the mapper from
selected nodes and links. The mapper's filter callback and late metadata pruning were removed;
its serialization is restored to the original implementation. Dependency discovery no longer
writes directly into the final mapper. The existing once-per-report traversal and missing-module
tests were retained and adapted to collection.

Verification of the redesign:

- Saved and compared 30 semantic baselines across Rollup, Rolldown, and Vite, with source-map
  attribution on/off and unfiltered, package-filtered, entry-filtered, bundle-filtered, and empty
  reports. Tree structure, module identities and flags, per-bundle sizes, and ordered links match.
  Generated UIDs were normalized for this comparison; snapshots were updated for the changed IDs
  because rejected modules no longer consume mapper IDs before being pruned.
- Added four real-bundler tests in [report.test.ts](../test/report.test.ts). They verify that
  measurement receives only selected code contributions, collected facts can be reused for a
  different selection without mutation, construction does not mutate the selection, and an empty
  selection performs no measurement or fallback construction.
- Build, lint, frontend type checking, and strict checking of the new/updated backend tests passed.
- All 274 unit tests passed across 20 files. All 20 Chrome smoke checks passed again.
- The standard consumer install still encounters the previously recorded npm `ETARGET` error.
  All three packaged-consumer fixtures passed again with temporary copies pinned to the installed
  Rollup, Rolldown, and Vite versions; repository dependency manifests were unchanged.

No dependency changes, public report-schema changes, or commits were introduced by this redesign.
