# Repository instructions

## Dependency updates

* Use `npm update` for compatible patch and minor updates.
* Review major updates individually using official changelogs and migration guides before upgrading.
* Keep TypeScript below version 7 until explicitly requested otherwise.

## Validation

* Run `npm run build` before `npm test`; tests consume the generated `dist` files.
* Run `npm run lint` after code changes.
* After frontend changes, also run `npx tsc -p src/tsconfig.json --noEmit`.

## Scope

* Do not create research reports unless requested.

## Changelogs

* Keep entries brief and focused on user-visible changes.
* Summarize dependency maintenance as "Update dependencies" without listing individual packages or versions.
* Omit implementation details. Include technical specifics only when needed to explain breaking changes or required user action.
