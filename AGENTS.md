# Repository instructions

## Working agreement

* Create commits or rewrite history only when explicitly requested. Approval to implement, proceed, or continue does not authorize commits.

## Dependency updates

* Use `npm update` for compatible patch and minor updates.
* Review major updates individually using official changelogs and migration guides before upgrading.
* Keep TypeScript below version 7 until explicitly requested otherwise.
* Replace a working dependency only when the maintenance or user-visible benefit justifies the migration cost; a microbenchmark alone is insufficient.

## Validation

* Run `npm run build` before `npm test`; tests consume the generated `dist` files.
* Run `npm run lint` after code changes.
* After frontend changes, also run `npx tsc -p src/tsconfig.json --noEmit`.
* Regression tests should assert behavior directly. Use snapshots as supporting coverage, not as the only correctness check.
* Test bundler-specific behavior using output produced by the supported bundlers rather than only hand-written stand-ins.
* Support performance claims with before-and-after measurements on representative inputs, alongside correctness tests.
* When behavior depends on text offsets or sizes, state the measurement unit and include non-ASCII regression cases.

## Scope

* Do not create research reports unless requested.
* Implement compatibility for supported tools and concrete use cases; do not generalize to unrelated inputs without a demonstrated need.

## Changelogs

* Keep entries brief and focused on user-visible changes.
* Summarize dependency maintenance as "Update dependencies" without listing individual packages or versions.
* Omit implementation details. Include technical specifics only when needed to explain breaking changes or required user action.

## Session-end review

* Before finishing a session, review this file for missing or outdated guidance revealed by the work.
* Record durable repository constraints, verified invariants, and explicit user preferences that would materially affect decisions in future, unrelated tasks.
* Do not add facts that can be rediscovered through a straightforward repository inspection in 10–30 seconds.
* Prefer correcting or consolidating existing instructions. Leave this file unchanged when there is no substantive improvement.
