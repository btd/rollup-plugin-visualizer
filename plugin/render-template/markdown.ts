import { VisualizerData } from "../../shared/types.js";
import { RenderTemplateReportConfig } from "./types.js";

const byteFormatter = new Intl.NumberFormat("en-US");

const formatBytes = (value: number) => {
  if (value < 1024) return `${byteFormatter.format(value)} B`;

  const units = ["KiB", "MiB", "GiB"];
  let num = value;
  for (const unit of units) {
    num /= 1024;
    if (num < 1024) {
      return `${num.toFixed(2)} ${unit}`;
    }
  }
  return `${num.toFixed(2)} TiB`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const sharePercent = (value: number, total: number) => {
  if (total === 0) return "0.0%";
  return formatPercent((value / total) * 100);
};

const yesNo = (value: boolean) => (value ? "yes" : "no");

const formatFilters = (filters: RenderTemplateReportConfig["include" | "exclude"]) => {
  if (filters == null) return "none";
  const values = Array.isArray(filters) ? filters : [filters];
  if (values.length === 0) return "none";
  return `\`${JSON.stringify(values)}\``;
};

export const outputMarkdown = (strData: string, reportConfig?: RenderTemplateReportConfig) => {
  const data = JSON.parse(strData) as VisualizerData;
  const SLICE_BUNDLE_COUNT = 8;
  const SLICE_MODULES_PER_BUNDLE = 8;
  const SLICE_MEMBERSHIP_MODULE_COUNT = 12;
  const SLICE_MEMBERSHIP_BUNDLE_PARTS = 6;

  type ModuleRow = {
    id: string;
    bundles: number;
    renderedLength: number;
    gzipLength: number;
    brotliLength: number;
    importedByCount: number;
    importedCount: number;
    parts: Array<{
      bundleId: string;
      renderedLength: number;
      gzipLength: number;
      brotliLength: number;
    }>;
  };
  type BundleRow = {
    bundleId: string;
    modules: number;
    renderedLength: number;
    gzipLength: number;
    brotliLength: number;
  };

  const moduleRows: ModuleRow[] = [];
  const bundleMap = new Map<string, BundleRow>();
  const bundleModuleParts = new Map<
    string,
    Array<{ id: string; renderedLength: number; gzipLength: number; brotliLength: number }>
  >();

  for (const meta of Object.values(data.nodeMetas)) {
    const row: ModuleRow = {
      id: meta.id,
      bundles: 0,
      renderedLength: 0,
      gzipLength: 0,
      brotliLength: 0,
      importedByCount: meta.importedBy.length,
      importedCount: meta.imported.length,
      parts: [],
    };

    for (const [bundleId, partUid] of Object.entries(meta.moduleParts)) {
      const part = data.nodeParts[partUid];
      if (!part) continue;

      row.bundles += 1;
      row.renderedLength += part.renderedLength;
      row.gzipLength += part.gzipLength;
      row.brotliLength += part.brotliLength;
      row.parts.push({
        bundleId,
        renderedLength: part.renderedLength,
        gzipLength: part.gzipLength,
        brotliLength: part.brotliLength,
      });

      const bundle = bundleMap.get(bundleId) ?? {
        bundleId,
        modules: 0,
        renderedLength: 0,
        gzipLength: 0,
        brotliLength: 0,
      };
      bundle.modules += 1;
      bundle.renderedLength += part.renderedLength;
      bundle.gzipLength += part.gzipLength;
      bundle.brotliLength += part.brotliLength;
      bundleMap.set(bundleId, bundle);

      const bundleParts = bundleModuleParts.get(bundleId) ?? [];
      bundleParts.push({
        id: row.id,
        renderedLength: part.renderedLength,
        gzipLength: part.gzipLength,
        brotliLength: part.brotliLength,
      });
      bundleModuleParts.set(bundleId, bundleParts);
    }

    if (row.bundles > 0) {
      moduleRows.push(row);
    }
  }

  const bundleRows = [...bundleMap.values()].toSorted(
    (a, b) => b.renderedLength - a.renderedLength,
  );
  const hotModules = [...moduleRows].toSorted((a, b) => b.renderedLength - a.renderedLength);
  const duplicatedModules = [...moduleRows]
    .filter((row) => row.bundles > 1)
    .map((row) => {
      const biggestRendered = row.parts.reduce(
        (max, part) => Math.max(max, part.renderedLength),
        0,
      );
      const duplicatedRendered = row.renderedLength - biggestRendered;
      return { ...row, duplicatedRendered };
    })
    .toSorted((a, b) => b.duplicatedRendered - a.duplicatedRendered);

  const packageRegex = /(?:^|[/\\])node_modules[/\\]((?:@[^/\\]+[/\\])?[^/\\]+)/;
  const packages = new Map<string, { modules: number; renderedLength: number }>();
  for (const row of moduleRows) {
    const match = packageRegex.exec(row.id);
    if (!match) continue;
    const packageName = match[1].replace(/\\/g, "/");
    const current = packages.get(packageName) ?? { modules: 0, renderedLength: 0 };
    current.modules += 1;
    current.renderedLength += row.renderedLength;
    packages.set(packageName, current);
  }
  const packageRows = [...packages.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .toSorted((a, b) => b.renderedLength - a.renderedLength);

  let staticImports = 0;
  let dynamicImports = 0;
  for (const meta of Object.values(data.nodeMetas)) {
    for (const imported of meta.imported) {
      if (imported.dynamic) {
        dynamicImports += 1;
      } else {
        staticImports += 1;
      }
    }
  }

  const totalRendered = moduleRows.reduce((sum, row) => sum + row.renderedLength, 0);
  const totalGzip = moduleRows.reduce((sum, row) => sum + row.gzipLength, 0);
  const totalBrotli = moduleRows.reduce((sum, row) => sum + row.brotliLength, 0);
  const entries = Object.values(data.nodeMetas).filter((meta) => meta.isEntry).length;
  const externals = Object.values(data.nodeMetas).filter((meta) => meta.isExternal).length;

  let output = "";
  output += "# Bundle Report\n\n";

  output += `| Bundles | Modules | Entries | Externals | Static Imports | Dynamic Imports |\n`;
  output += `| ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  output += `| ${String(bundleRows.length)} | ${String(moduleRows.length)} | ${String(entries)} | ${String(externals)} | ${String(staticImports)} | ${String(dynamicImports)} |\n\n`;

  output += `| Metric | Total |\n`;
  output += `| --- | ---: |\n`;
  output += `| Rendered | ${formatBytes(totalRendered)} |\n`;
  if (data.options.gzip) {
    output += `| Gzip | ${formatBytes(totalGzip)} |\n`;
  }
  if (data.options.brotli) {
    output += `| Brotli | ${formatBytes(totalBrotli)} |\n`;
  }
  output += `\n`;

  output += "## Top 10\n\n";
  const topRows = hotModules.slice(0, 10);
  if (topRows.length === 0) {
    output += "- none\n";
  } else {
    for (const row of topRows) {
      output += `- \`${row.id}\`: ${sharePercent(row.renderedLength, totalRendered)} (${formatBytes(row.renderedLength)})\n`;
    }
  }
  output += "\n";

  output += "## Hot Modules (Self Size)\n\n";
  output += `| Rendered% | Rendered | Gzip | Brotli | Bundles | Imported By | Imports | Module |\n`;
  output += `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n`;
  for (const row of hotModules.slice(0, 15)) {
    output += `| ${sharePercent(row.renderedLength, totalRendered)} | ${formatBytes(row.renderedLength)} | ${formatBytes(row.gzipLength)} | ${formatBytes(row.brotliLength)} | ${String(row.bundles)} | ${String(row.importedByCount)} | ${String(row.importedCount)} | \`${row.id}\` |\n`;
  }
  output += "\n";

  output += "## Bundle Breakdown\n\n";
  output += `| Bundle | Modules | Rendered | Gzip | Brotli |\n`;
  output += `| --- | ---: | ---: | ---: | ---: |\n`;
  for (const bundle of bundleRows) {
    output += `| \`${bundle.bundleId}\` | ${String(bundle.modules)} | ${formatBytes(bundle.renderedLength)} | ${formatBytes(bundle.gzipLength)} | ${formatBytes(bundle.brotliLength)} |\n`;
  }
  output += "\n";

  output += "## Duplicate Modules Across Bundles\n\n";
  output += `| Duplicated Rendered | Total Rendered | Bundles | Module |\n`;
  output += `| ---: | ---: | ---: | --- |\n`;
  for (const row of duplicatedModules.slice(0, 15)) {
    output += `| ${formatBytes(row.duplicatedRendered)} | ${formatBytes(row.renderedLength)} | ${String(row.bundles)} | \`${row.id}\` |\n`;
  }
  if (duplicatedModules.length === 0) {
    output += `| 0 B | 0 B | 0 | none |\n`;
  }
  output += "\n";

  output += "## Top Packages\n\n";
  output += `| Package | Modules | Rendered |\n`;
  output += `| --- | ---: | ---: |\n`;
  for (const row of packageRows.slice(0, 15)) {
    output += `| \`${row.name}\` | ${String(row.modules)} | ${formatBytes(row.renderedLength)} |\n`;
  }
  if (packageRows.length === 0) {
    output += `| none | 0 | 0 B |\n`;
  }
  output += "\n";

  output += "## Per-Bundle Top Modules (Slices)\n\n";
  const sliceBundles = bundleRows.slice(0, SLICE_BUNDLE_COUNT);
  if (sliceBundles.length === 0) {
    output += "- none\n\n";
  } else {
    for (const bundle of sliceBundles) {
      output += `### \`${bundle.bundleId}\`\n\n`;
      output += `| Module | Rendered% | Rendered | Gzip | Brotli |\n`;
      output += `| --- | ---: | ---: | ---: | ---: |\n`;

      const parts = (bundleModuleParts.get(bundle.bundleId) ?? [])
        .toSorted((a, b) => b.renderedLength - a.renderedLength)
        .slice(0, SLICE_MODULES_PER_BUNDLE);

      if (parts.length === 0) {
        output += `| none | 0.0% | 0 B | 0 B | 0 B |\n`;
      } else {
        for (const part of parts) {
          output += `| \`${part.id}\` | ${sharePercent(part.renderedLength, bundle.renderedLength)} | ${formatBytes(part.renderedLength)} | ${formatBytes(part.gzipLength)} | ${formatBytes(part.brotliLength)} |\n`;
        }
      }
      output += "\n";
    }
  }

  output += "## Top Module Bundle Membership (Slice)\n\n";
  output += `| Module | Bundles | Rendered | Bundle Parts |\n`;
  output += `| --- | ---: | ---: | --- |\n`;
  const membershipRows = hotModules.slice(0, SLICE_MEMBERSHIP_MODULE_COUNT);
  if (membershipRows.length === 0) {
    output += `| none | 0 | 0 B | none |\n`;
  } else {
    for (const row of membershipRows) {
      const parts = [...row.parts].toSorted((a, b) => b.renderedLength - a.renderedLength);
      const formattedParts = parts
        .slice(0, SLICE_MEMBERSHIP_BUNDLE_PARTS)
        .map((part) => `\`${part.bundleId}\`: ${formatBytes(part.renderedLength)}`);
      const moreParts =
        parts.length > SLICE_MEMBERSHIP_BUNDLE_PARTS
          ? `; +${String(parts.length - SLICE_MEMBERSHIP_BUNDLE_PARTS)} more`
          : "";
      output += `| \`${row.id}\` | ${String(row.bundles)} | ${formatBytes(row.renderedLength)} | ${formattedParts.join("; ")}${moreParts} |\n`;
    }
  }
  output += "\n";

  const hasRuntimeConfig = reportConfig != null;
  output += "## Plugin Settings\n\n";
  output += `| Setting | Value |\n`;
  output += `| --- | --- |\n`;
  output += `| rollup version | \`${String(data.env.rollup ?? "unknown")}\` |\n`;
  output += `| sourcemap mode | \`${yesNo(hasRuntimeConfig ? reportConfig.sourcemap : data.options.sourcemap)}\` |\n`;
  output += `| output.sourcemap | \`${hasRuntimeConfig ? yesNo(reportConfig.outputSourcemap) : "not available"}\` |\n`;
  output += `| gzip requested | \`${hasRuntimeConfig ? yesNo(reportConfig.gzipSize.requested) : "not available"}\` |\n`;
  output += `| gzip enabled | \`${hasRuntimeConfig ? yesNo(reportConfig.gzipSize.enabled) : yesNo(data.options.gzip)}\` |\n`;
  output += `| brotli requested | \`${hasRuntimeConfig ? yesNo(reportConfig.brotliSize.requested) : "not available"}\` |\n`;
  output += `| brotli enabled | \`${hasRuntimeConfig ? yesNo(reportConfig.brotliSize.enabled) : yesNo(data.options.brotli)}\` |\n`;
  output += `| include filters | ${hasRuntimeConfig ? formatFilters(reportConfig.include) : "not available"} |\n`;
  output += `| exclude filters | ${hasRuntimeConfig ? formatFilters(reportConfig.exclude) : "not available"} |\n\n`;

  output += "## Notes\n\n";
  output +=
    "- Size precision depends on mode. With `sourcemap: true`, bytes are attributed via source maps. Otherwise bytes come from rendered module code.\n";
  output +=
    "- In plugin mode, enabling `sourcemap` disables gzip/brotli size collection for this report.\n";
  output += "- `include`/`exclude` filters remove unmatched modules from statistics entirely.\n";
  output +=
    "- External modules can appear in dependency links but do not contribute per-bundle size parts.\n";

  return output;
};
