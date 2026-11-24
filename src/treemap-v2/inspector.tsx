import { displayModuleId } from "../../shared/display-module-id.js";
import { useImperativeHandle, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";
import { ChevronRight, Undo2, X, ZoomIn } from "lucide-preact";
import type { SizeKey } from "../../shared/types";
import { LABELS } from "../sizes";
import { type InspectorData, type OutputNode, type Target, outputTarget } from "./data";
import type { InspectorAction, InspectorState, Selection } from "./state";
import { formatPercent, formatSize } from "./format";
import { Lists } from "./lists";

export interface InspectorHandle {
  capture: () => Selection;
}

interface Props {
  model: InspectorData;
  state: InspectorState;
  dispatch: (action: InspectorAction) => void;
  metric: SizeKey;
  metrics: SizeKey[];
  visibleParts: Set<string>;
  scope: OutputNode;
  open: boolean;
  zoom: (node: OutputNode) => void;
  panelRef: RefObject<InspectorHandle | null>;
}

export function Inspector({
  model,
  state,
  dispatch,
  metric,
  metrics,
  visibleParts,
  scope,
  open,
  zoom,
  panelRef,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLDetailsElement>(null);
  const [occurrence, setOccurrence] = useState("");
  const [fileOrder, setFileOrder] = useState<"size" | "path">("size");
  const visit = state.current;
  useImperativeHandle(
    panelRef,
    () => ({
      capture: () => ({
        ...visit,
        occurrence,
        scrollTop: listRef.current?.scrollTop ?? 0,
        identityScrollTop: identityRef.current?.scrollTop ?? 0,
        internal: {
          open: internalRef.current?.open ?? false,
          scrollTop: internalRef.current?.scrollTop ?? 0,
        },
      }),
    }),
    [visit, occurrence],
  );
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [visit.query, visit.section]);
  useLayoutEffect(() => {
    setOccurrence(visit.occurrence ?? "");
  }, [state.revision]);
  useLayoutEffect(() => {
    if (!open) return;
    if (listRef.current) listRef.current.scrollTop = visit.scrollTop ?? 0;
    if (identityRef.current) identityRef.current.scrollTop = visit.identityScrollTop ?? 0;
    if (internalRef.current) internalRef.current.scrollTop = visit.internal?.scrollTop ?? 0;
  }, [state.revision, open]);
  const follow = (target: Target) => {
    const currentUid = model.metaUid(visit.target);
    if (currentUid !== undefined && currentUid === model.metaUid(target)) return;
    dispatch({
      type: "inspect",
      target,
      group: model.isGroup(target),
    });
  };

  const target = visit.target;
  const group = model.isGroup(target);
  const isRoot = target.type === "output" && target.key === model.root.key;
  const isSummary = target.type === "output" && target.key === scope.key;
  const node = model.node(target);
  const path = model.path(target);
  const parts = model.parts(target);
  const measured = model.size(target, metric);
  const members = model.members(target);
  const hidden = members.filter((member) => !visibleParts.has(member.partUid!)).length;
  const outputUid = model.metaUid(target);
  const meta = outputUid === undefined ? undefined : model.data.nodeMetas[outputUid];
  const focus = group ? node : parts.length === 1 ? parts[0].node : model.partNodes.get(occurrence);
  const undo = focus?.key === scope.key && state.history.length > 0;
  const focusVisible =
    focus &&
    model.members(outputTarget(focus.key)).some((member) => visibleParts.has(member.partUid!));
  const inView = members.filter(
    (member) => member.key === scope.key || member.key.startsWith(scope.key + "/"),
  ).length;
  const location =
    isSummary || !members.length || inView === members.length
      ? ""
      : inView === 0
        ? "Outside the current chart view."
        : "Only part of this selection is in the current chart view.";
  const availability = [
    !members.length ? "Relationships remain available without an output rectangle." : "",
    hidden
      ? `${hidden} of ${members.length} output files hidden by chart filters. Edit the filters to reveal them; measurements and relationships retain their full scope.`
      : "",
    location,
  ]
    .filter(Boolean)
    .join(" ");
  const reportScope = model.scope(target);

  return (
    <aside className="tmv2-inspector" hidden={!open} aria-label="Dependency details">
      <div className="tmv2-inspector-header" role="group" aria-label="Selection actions">
        <button
          type="button"
          className="tmv2-show-chart tmv2-icon-button"
          disabled={!undo && (focus?.key === scope.key || !focusVisible)}
          onClick={() => {
            if (undo) dispatch({ type: "undoZoom" });
            else if (focus) zoom(focus);
          }}
        >
          {undo ? (
            <Undo2 className="tmv2-icon" aria-hidden="true" />
          ) : (
            <ZoomIn className="tmv2-icon" aria-hidden="true" />
          )}
          {undo ? "Undo zoom" : "Zoom to selection"}
        </button>
        <button
          type="button"
          className="tmv2-icon-button"
          disabled={isSummary}
          onClick={() => dispatch({ type: "clear", group: scope.partUid === undefined })}
        >
          <X className="tmv2-icon" aria-hidden="true" />
          Clear selection
        </button>
      </div>
      <div className="tmv2-identity" ref={identityRef}>
        <div className="tmv2-kind">
          {isRoot
            ? "Report"
            : group
              ? `Output group · ${displayModuleId(reportScope!.label)}`
              : meta?.isExternal
                ? "External module"
                : parts.length
                  ? `File${parts.length === 1 ? ` · ${displayModuleId(parts[0].chunk)}` : ""}`
                  : "Graph-only module"}
          {meta?.isEntry && " · Entry point"}
        </div>
        <h2>
          {isRoot
            ? "All files"
            : displayModuleId(group ? node!.name : path.split(/[\\/]/).at(-1) || path)}
        </h2>
        {!isRoot && (
          <code className="tmv2-id" aria-label={group ? "Output hierarchy path" : "Full module ID"}>
            {displayModuleId(path)}
          </code>
        )}
        {measured !== undefined ? (
          <>
            <div className="tmv2-measurement">
              <strong>
                {LABELS[metric]}: {formatSize(measured)}
              </strong>
              {reportScope!.size[metric] > 0 && (
                <span>
                  {formatPercent(measured, reportScope!.size[metric])} of measured{" "}
                  {displayModuleId(reportScope!.label)}
                </span>
              )}
            </div>
            <div className="tmv2-other-sizes">
              {metrics
                .filter((key) => key !== metric)
                .map((key) => (
                  <span key={key}>
                    {LABELS[key]}: {formatSize(model.size(visit.target, key)!)}
                  </span>
                ))}
            </div>
          </>
        ) : (
          <p className="tmv2-measurement">
            {parts.length ? "Multiple output contributions" : "No output measurement"}
          </p>
        )}
        {parts.length > 1 && (
          <div className="tmv2-occurrences" aria-label="Output contributions">
            {parts.map((part) => (
              <div key={part.uid}>
                <b>{displayModuleId(part.chunk)}</b>
                <span>
                  {metrics
                    .map((key) => `${LABELS[key]}: ${formatSize(part.sizes[key])}`)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        )}
        <details className="tmv2-measurement-note">
          <summary>
            <ChevronRight className="tmv2-icon tmv2-disclosure-icon" aria-hidden="true" />
            About measurements
          </summary>
          <p>
            Rendered output contributions are measured in UTF-8 bytes; source-map attribution
            depends on report settings.
            {metrics.length > 1 && " Compressed sums are not bundle transfer sizes."}
          </p>
        </details>
        {parts.length > 1 && (
          <label className="tmv2-occurrence-choice">
            Output occurrence
            <select
              aria-label="Output occurrence"
              value={occurrence}
              onChange={(event) => setOccurrence(event.currentTarget.value)}
            >
              <option value="">Choose a chunk to locate…</option>
              {parts.map((part) => (
                <option key={part.uid} value={part.uid}>
                  {displayModuleId(part.chunk)}
                  {!visibleParts.has(part.uid) ? " (hidden by chart filters)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="tmv2-availability" role="status">
          {availability}
        </div>
      </div>
      <Lists
        key={state.revision}
        fileOrder={fileOrder}
        setFileOrder={setFileOrder}
        model={model}
        visit={visit}
        metric={metric}
        dispatch={dispatch}
        follow={follow}
        listRef={listRef}
        internalRef={internalRef}
      />
    </aside>
  );
}
