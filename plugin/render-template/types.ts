export type ReportFilter = {
  bundle?: string | null | undefined;
  file?: string | null | undefined;
};

export type RenderTemplateReportConfig = {
  sourcemap: boolean;
  outputSourcemap: boolean;
  gzipSize: {
    requested: boolean;
    enabled: boolean;
  };
  brotliSize: {
    requested: boolean;
    enabled: boolean;
  };
  include?: ReportFilter | ReportFilter[] | undefined;
  exclude?: ReportFilter | ReportFilter[] | undefined;
};

export type RenderTemplateOptions = {
  data: string;
  title: string;
  reportConfig?: RenderTemplateReportConfig;
};

export type TemplateRenderer = (options: RenderTemplateOptions) => Promise<string>;
