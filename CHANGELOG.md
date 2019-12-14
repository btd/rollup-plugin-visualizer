# Changelog

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
