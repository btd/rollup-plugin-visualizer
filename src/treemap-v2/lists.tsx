import { displayModuleId } from "../../shared/display-module-id.js";
import { useLayoutEffect, useMemo, useState } from "preact/hooks";
import { ChevronRight } from "lucide-preact";
import type { RefObject } from "preact";
import type { SizeKey } from "../../shared/types";
import { type Edge, type InspectorData, type Target, outputTarget } from "./data";
import type { InspectorAction, Section, Selection } from "./state";
import { formatSize } from "./format";
import { RelationshipRow } from "./relationship-row";

interface Props {
  fileOrder: "size" | "path";
  setFileOrder: (order: "size" | "path") => void;
  model: InspectorData;
  visit: Selection;
  metric: SizeKey;
  dispatch: (action: InspectorAction) => void;
  follow: (target: Target) => void;
  listRef: RefObject<HTMLDivElement | null>;
  internalRef: RefObject<HTMLDetailsElement | null>;
}
export function Lists({
  fileOrder,
  setFileOrder,
  model,
  visit,
  metric,
  dispatch,
  follow,
  listRef,
  internalRef,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(visit.internal?.open ?? false);
  const group = model.isGroup(visit.target);
  const graph = useMemo(() => model.relationships(visit.target), [model, visit.target]);
  const dynamicPairs = useMemo(() => {
    const pairs = new Set<string>();
    for (const edges of [graph.incoming, graph.outgoing, graph.internal]) {
      for (const edge of edges)
        if (edge.dynamic) pairs.add(JSON.stringify([edge.source, edge.target]));
    }
    return pairs;
  }, [graph]);
  const importKind = (edge: Edge) =>
    edge.dynamic
      ? "Dynamic import"
      : dynamicPairs.has(JSON.stringify([edge.source, edge.target]))
        ? "Static import"
        : undefined;
  const members = useMemo(
    () => (group ? model.members(visit.target) : []),
    [model, visit.target, group],
  );
  const orderedMembers = useMemo(
    () =>
      fileOrder === "size"
        ? members.toSorted((a, b) => b.sizes[metric] - a.sizes[metric])
        : members,
    [members, fileOrder, metric],
  );
  const sectionCounts = {
    incoming: graph.incoming.length,
    outgoing: graph.outgoing.length,
    members: members.length,
  };
  const sections = (["incoming", "outgoing", ...(group ? ["members"] : [])] as Section[]).filter(
    (section) => sectionCounts[section] > 0,
  );
  const activeSection = sections.includes(visit.section) ? visit.section : sections[0];
  useLayoutEffect(() => {
    // Keep subsequent navigation in the direction actually shown to the user.
    if (activeSection && activeSection !== visit.section)
      dispatch({ type: "section", section: activeSection });
  }, [activeSection, dispatch, visit.section]);
  if (!activeSection) return <p>No imports or importers.</p>;
  const query = visit.query.toLowerCase();
  const matches = (edge: Edge) =>
    [edge.source, edge.target].some((uid) =>
      displayModuleId(model.data.nodeMetas[uid].id).toLowerCase().includes(query),
    );
  const edges = activeSection === "members" ? [] : graph[activeSection];
  const filtered = edges.filter(matches);
  const files = orderedMembers.filter((node) =>
    displayModuleId(model.data.nodeMetas[node.metaUid!].id).toLowerCase().includes(query),
  );
  const count = activeSection === "members" ? files.length : filtered.length;
  const total = activeSection === "members" ? members.length : edges.length;
  const internal = graph.internal.filter(matches);
  return (
    <>
      <div className="tmv2-sections" role="group" aria-label="Details sections">
        {sections.map((section) => (
          <button
            type="button"
            key={section}
            aria-pressed={activeSection === section}
            onClick={() => dispatch({ type: "section", section })}
          >
            {section === "incoming" ? "Imported by" : section === "outgoing" ? "Imports" : "Files"}{" "}
            <span>
              {section === "members"
                ? members.length
                : graph[section as "incoming" | "outgoing"].length}
            </span>
          </button>
        ))}
      </div>
      <div className="tmv2-list-body">
        {query && (
          <div className="tmv2-list-scope" role="status">
            {count} of {total} match{count === 1 ? "" : "es"}
          </div>
        )}
        {activeSection === "members" && (
          <label className="tmv2-sort">
            Sort files{" "}
            <select
              value={fileOrder}
              onChange={(event) =>
                setFileOrder(event.currentTarget.value === "path" ? "path" : "size")
              }
            >
              <option value="size">Largest first</option>
              <option value="path">Path</option>
            </select>
          </label>
        )}
        <label className="tmv2-search">
          <span className="tmv2-sr-only">Find a path</span>
          <input
            type="search"
            value={visit.query}
            placeholder="Filter paths…"
            onInput={(event) => dispatch({ type: "query", query: event.currentTarget.value })}
          />
        </label>
        <div
          className="tmv2-list"
          ref={listRef}
          aria-label={activeSection === "members" ? "Output files" : "Relationships"}
        >
          {activeSection === "members"
            ? files.map((node) => (
                <button
                  type="button"
                  className="tmv2-row tmv2-file"
                  key={node.key}
                  onClick={() => follow(outputTarget(node.key))}
                >
                  <span className="tmv2-path">
                    {displayModuleId(model.data.nodeMetas[node.metaUid!].id)}
                  </span>
                  <small>{displayModuleId(node.chunk!)}</small>
                  <b>{formatSize(node.sizes[metric])}</b>
                </button>
              ))
            : filtered.map((edge) => (
                <RelationshipRow
                  key={JSON.stringify(edge)}
                  model={model}
                  edge={edge}
                  showBothEndpoints={group}
                  sourceFirst={activeSection === "incoming"}
                  kind={importKind(edge)}
                  follow={follow}
                />
              ))}
          {count === 0 && (
            <p>
              {query
                ? "No matching paths."
                : activeSection === "members"
                  ? "No output files."
                  : "No direct relationships in this list."}
            </p>
          )}
        </div>
        {group && graph.internal.length > 0 && (
          <details
            className="tmv2-internal"
            ref={internalRef}
            open={internalOpen}
            onToggle={(event) => setInternalOpen(event.currentTarget.open)}
          >
            <summary>
              <ChevronRight className="tmv2-icon tmv2-disclosure-icon" aria-hidden="true" />
              <span>
                {query ? `${internal.length} of ` : ""}
                {graph.internal.length} internal relationships
              </span>
            </summary>
            <div>
              {internalOpen &&
                internal.map((edge) => (
                  <RelationshipRow
                    key={JSON.stringify(edge)}
                    model={model}
                    edge={edge}
                    sourceFirst
                    internal
                    kind={importKind(edge)}
                    follow={follow}
                  />
                ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
