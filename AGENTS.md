# Repository instructions

## Working agreement

* Create commits or rewrite history only when explicitly requested. Approval to implement, proceed, or continue does not authorize commits.
* The maintainer performs releases. Never create release tags, publish packages or releases, or push refs that trigger release workflows on their behalf. Change release versions or prepare release metadata only when explicitly requested.
* Bug investigations should include viable fix approaches and the tradeoffs of each, followed by a comparison that explains the relative weight of relevant criteria and recommends an approach. Recommendations do not authorize implementation.
* Do not score effort, agent workload, or implementation time when comparing approaches. Weigh technical outcomes and risks instead.
* Distinguish verified facts, reasoned inferences, design decisions, and unresolved unknowns. Use judgment, but do not present guesses as facts or turn hypothetical cases into requirements without a demonstrated need.
* Investigate consequential uncertainties and look for overlooked failure modes within the task's scope. Exhaustive discovery is not required; state the limits of the evidence and remaining uncertainty plainly.
* Prefer consistency with existing behavior and the principle of least surprise when choosing defaults and edge-case semantics.

## Dependency updates

* Use `npm update` for compatible patch and minor updates.
* Review major updates individually using official changelogs and migration guides before upgrading.
* Keep TypeScript below version 7 until explicitly requested otherwise.
* Replace a working dependency only when the maintenance or user-visible benefit justifies the migration cost; a microbenchmark alone is insufficient.

## Validation

* Run `npm run build` before `npm test`; tests consume the generated `dist` files.
* Run `npm run lint` after code changes.
* After frontend changes, also run `npx tsc -p src/tsconfig.json --noEmit`.
* Regression tests should assert behavior directly. UI tests should verify interactions and rendered results rather than source or generated-HTML string presence/absence. Use snapshots as supporting coverage, not as the only correctness check.
* Test bundler-specific behavior using output produced by the supported bundlers rather than only hand-written stand-ins.
* Rollup validation targets version 4 only. Do not add Rollup 2/3 test matrices or compatibility shims unless explicitly requested. Validate Rolldown and Vite separately.
* Support performance claims with before-and-after measurements on representative inputs, alongside correctness tests.
* When behavior depends on text offsets or sizes, state the measurement unit and include non-ASCII regression cases.

## Scope

* Do not create research reports unless requested.
* Keep each feature's design in one descriptively named document; update it in place rather than creating additional generic drafts.
* Implement compatibility for supported tools and concrete use cases; do not generalize to unrelated inputs without a demonstrated need.
* Keep configured report filtering in a single selection stage. Collection, measurement, and serialization must not reapply include/exclude rules; interactive UI visibility filters remain separate.
* Generated diagram reports target desktop browsers. Consider desktop window resizing; browser-zoom improvements and mobile layouts are out of scope unless explicitly requested.
* Treat generated reports as developer tools: prioritize usability, readable data, efficient investigation, and chart space over decorative styling. Evaluate UI improvements against large codebases; per-chart-node keyboard focus is not a priority.

## Changelogs

* Do not add deprecation notices to README.
* Keep entries brief and focused on user-visible changes.
* Summarize dependency maintenance as "Update dependencies" without listing individual packages or versions.
* Omit implementation details. Include technical specifics only when needed to explain breaking changes or required user action.

## Session-end review

* Before finishing a session, review this file for missing or outdated guidance revealed by the work.
* Record durable repository constraints, verified invariants, and explicit user preferences that would materially affect decisions in future, unrelated tasks.
* Do not add facts that can be rediscovered through a straightforward repository inspection in 10–30 seconds.
* Prefer correcting or consolidating existing instructions. Leave this file unchanged when there is no substantive improvement.
