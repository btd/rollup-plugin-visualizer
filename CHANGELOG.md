# Changelog

## 7.0.0 (future)

* Drop NodeJS 20, currently minimal version 22
* Update dependencies
* Migrate to ESM as dependencies moving to ESM
** `open` updated to >= 10
** `yargs` updated to >=18

## 6.0.5

* Bump version to test new deployment because of NPM update

## 6.0.4

* Allow using `emitFile` with dot filenames https://github.com/btd/rollup-plugin-visualizer/pull/211

## 6.0.3

* Republish due to bug in npm cli https://github.com/npm/cli/issues/4828

## 6.0.2

* Update `rolldown` peerDependendcy range to include betas
* Update deps

## 6.0.1

* Rollback dependency package `open` to version 8 as require(esm) is not ready to be used

## 6.0.0

* Update dependencies
* Set minumum required node version to v20

## 5.14.0

* Return `flamegraph`

## 5.13.0

* Remove `flamegraph` template
* Merge #191. Thanks to @guillaumeduboc
* Update deps
* Switch jest -> vitest
* Switch eslint -> oxlint
* Add test for rolldown
* Make node v18 min required

## 5.12.0

* Make unique id in generated data to be hash of data
* Remove strict from CLI

## 5.11.0

* Correct lenghts in case of sourcemap it will strictly use sourcemap data always
* Add css cursor pointer
* Add --open to CLI

## 5.10.0

* Update dependencies
* Add experimental `flamegraph` template
* Make super simple placeholder to test if people stop complaining about input/output inputs

## 5.9.3

* Update dependencies
* Add Rollup 4.x to the list of supported

## 5.9.1

* Update dependencies
* Change a way code traversed for sourcemap in attempt to account for surrogate pairs

## 5.9.0

* Add `include` and `exclude` options allowing to filter bundles, and files in separate or together
* Fix possible bug with not correctly cutting prefix when `projectRoot` is a string
* Use glob patterns via `picomatch` in include and exclude allowing to filter both bundles and files
* `treemap` received new zoom. On click on node it will increase it size to 100%

## 5.8.3

* Remove not used dependencies and updated rollup to v3

## 5.8.2

* Update dependencies. Most notable source-map updated to 0.7.4

## 5.8.1

* Make rollup to be optional peer dependency

## 5.8.0

* New template type raw-data - it replaces .json option
* Soft deprecate .json option in favor of new template type
* New template type list - it outputs yml file with all contents

## 5.7.1

* Return back filter to network diagram

## 5.7.0

* Add `emitFile` option
* Allow to drag network diagram
* Allow to exclude nodes from network diagram by double click
* Allow to highligh file dependencies listed in toolip by click
* Remove webcola and switch back to d3-force with defined node positions

## 5.6.0

* Allow to pass function that return options

## 5.5.3

* Update dependencies
* Reduce saturation for colors of treemap

## 5.5.2

* Fix coloring in case of 2 chunks

## 5.5.1

* Fix compatibility issue with rollup v1

## 5.5.0

* Refactor internal data structures to optimise perfomance

## 5.4.1

* Remove unnecessary font size grow

## 5.4.0

* Show small notice in tooltip for treemap about what we show as sizes
* Hide sizes from UI as this creates confusion, because people starts to think about plugin as fs representation and that it is possible to get real size of small portion of bundle.

## 5.3.7

* Fix bug with new parts of bundle structure in treemap, that does not allow to show
imported by paths
## 5.3.4

* Just rebuild

## 5.3.3

* Fix node10 compatability

## 5.3.2

* CLI now remove output file if exists before write

## 5.3.1

* Fix issue that network nodes could override hierarhy data
* Tried to implement groups in network chart, still some work to do
* In rollup >= 2.44 use code for byte size estimation instead of renderedLength prop

## 5.3.0

* Merge hierarchy nodes with single child together, reducing visual noise by less deep structure

## 5.2.1

* Improve filtering and make it less fragile

## 5.2.0

* Add include and exclude filters to UI, it is plain regexps.

## 5.1.0

* Add `projectRoot` and stop doing right work, but just assume nobody follow good practice and naming convention.

## 5.0.4

* Fix trimming root of non absolute path, this could happen when plugin does not follow rollup naming convention for virtual modules
## 5.0.3

* It is just not possible to release major version without several patches

## 5.0.0

* **Breaking change** Remove support node < 10.16
* **Breaking change** Remove support rollup 1.x (actually some of 1.x will still work, but i officially stop checking)
* **Breaking change** Remove support for `gzipLength` and `brotliLength` for rollup < 2.44. Since 2.44 rollup report renderered module code, which is used to get correct sizes.
* **Breaking change** Change default export
* Migrate plugin to TS, types now included

## 4.2.2

* Rollback open to v7 because v8 requires node 12, but i still support 10
* Add workaround for preact bug for xlink:href attribute - use just href
* Rework safari bug fix to make it a little more clean
## 4.2.1

* Update deps
* Fix safari rendering

## 4.2.0

* Switch to npm
* Add to html template window on resize handler

## 4.1.2

* Update deps, drop pupa because it has not stated breaking change

## 4.1.1

* Update to d3 v6 and other deps

## 4.1.0

* Change color palette for treemap to be less bright
* Expose bundle actual sizes to root json (this fixes unknown nodes in network chart)
* Drop `chartParameters` as it was not used starting 2.x
* Fix dropping common path from absolute paths only (fix issue with alias plugin)
* Fix resolve of sourcemap entries 
* Fix if some node do not have lengths report it as 0


## 4.0.4

* Fix #70
* Fix #69 - this time more accurate way

## 4.0.3

* Fix #69
* Copy options and env with cli

## 4.0.2

* Fix #69

## 4.0.1

* Fix `bundle.isAsset` deprecation

## 4.0.0

* use `preact` and `htm` for rendering
* replace `mkdirp` with plain `fs` and use `fs.promises`
* **Breaking change** remove `extraStylePath` and `styleOverridePath`
* **Breaking change** drop node 8
* **Breaking change** drop circlepacking diagram
* **Breaking change** require rollup >= 1.20
* add `gzip` output and `brotli` if supported by node version
* use `WebCola` with constraints for network diagram instead of `d3-force`

## 3.3.2

* Fix #63

## 3.3.1

* Fix #59

## 3.3.0

* Refine sourcemap option and add test for it

## 3.2.3

* Update light version

## 3.2.2

* Fix different TODO items

## 3.2.1

* Fix bug with no modules

## 3.2.0

* Zoom sunburst
* Fix bugs with zooming size
* Zoom circlepacking 
* Drop d3-collection as it is deprecated

## 3.1.0

* Add basic zoom to treemap
* Add e2e test

## 3.0.5

* Fix trimming prefix
* Add functinal tests

## 3.0.4

* Handle external deps in better way

## 3.0.3

* Fixes to build script

## 3.0.2

* Make new release working

## 3.0.0

* Polish network chart (center and rotate for screen size)
* Add cli util to merge several json files to one chart
* Allow to produce json with `json` option
* **Breaking change** `bundleRelative` removed and enabled always
* Make tooltip to change position
* Adjust font color depending node color (for new color scheme)
* Use build script instead of npm scripts
* Add new coloring scheme for treemap
* Drop header and footer as non functional elements
* Updates to styles to remove dups

## 2.7.2

* Fixes for network graph

## 2.7.1

* For hierarchy skip files with zero size

## 2.7.0

* Basic customization for chart svg node
* Footer
* Basic dark mode
* Drop typeface

## 2.6.1

* Bug with order of elements in nest

## 2.6.0

* Add `styleOverridePath` option

## 2.5.4

* Bugfix

## 2.5.3

* Deps update

## 2.5.2

* Adjust color for network chart

## 2.5.1

* Fix merge for network chart

## 2.5.0

* Add `bundlesRelative` option to display all bundles on the same chart

## 2.4.4

* Add warning for sourcemap option (when you enable sourcemap but it is disabled in rollup)

## 2.4.3

* Improvements in network chart

## 2.4.2

* Improvements in network chart

## 2.4.1

* Remove shadows

## 2.4.0

* Add shadows

## 2.3.0

* Add network chart
* Return mkdirp for node 8

## 2.2.1

* Use pupa for template
* Drop mkdirp

## 2.2.0

* Tooltips

## 2.1.1

* Bug with files in npm

## 2.1.0

* Add circlepacking

## 2.0.0

* Add `template` and treemap

## 1.1.1

* Relax node constraint

## 1.1.0

* Show root size 

## 1.0.2

* Fix display % with .toFixed

## 1.0.1

* Fix bug with only one module

## 0.9.2

* Internal switch to yarn
* Fix woff2 link

## 0.9.1

* Fix typeface

## 0.9.0

* Add `open` option

## 0.8.1

* Fix sourcemap option

## 0.8.0

* Initial version of multi target output

## 0.7.0

* Support rollup version >= 0.60

## 0.6.0

* Fix sourcemap bug

## 0.5.0

* Create dirs with `mkdirp`

## 0.4.0

* `title` option

## 0.3.1

* Bugfix for addToPath

## 0.3.0

* Fix source-map dep
* More accurate work with plugin sources 

## 0.2.1

* Fix node v4 support

## 0.2.0

* Initial version of `sourcemap` option

## 0.1.5

* FF bug

## 0.1.4

* Stability fixes

## 0.1.3

* Initial stable version
