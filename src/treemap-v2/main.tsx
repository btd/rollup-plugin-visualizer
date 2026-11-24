import { displayModuleId } from "../../shared/display-module-id.js";
import { useMemo, useReducer, useRef, useState } from "preact/hooks";
import { PanelRightClose, PanelRightOpen } from "lucide-preact";
import type { VisualizerData } from "../../shared/types";
import { getAvailableSizeOptions } from "../sizes";
import { SideBar } from "../sidebar";
import { useFilter } from "../use-filter";
import { InspectorData, type OutputNode } from "./data";
import { Chart } from "./chart";
import { Inspector, type InspectorHandle } from "./inspector";
import { initialInspector, inspectorReducer, type Selection } from "./state";

export function Main({ data }: { data: VisualizerData }) {
  const model = useMemo(() => new InspectorData(data), [data]);
  const metrics = useMemo(() => getAvailableSizeOptions(data.options), [data]);
  const [metric, setMetric] = useState(metrics[0]);
  const [open, setOpen] = useState(true);
  const [state, dispatch] = useReducer(inspectorReducer, initialInspector);
  const panel = useRef<InspectorHandle>(null);
  const capturePanel = () => (open ? (panel.current?.capture() ?? state.current) : state.current);
  const zoom = (node: OutputNode, previous = capturePanel()) =>
    dispatch({
      type: "zoom",
      key: node.key,
      group: node.partUid === undefined,
      panel: previous,
    });
  const firstChartClick = useRef<
    { node: OutputNode; reopened: boolean; zoomed: boolean; panel: Selection } | undefined
  >(undefined);
  const { getModuleFilterMultiplier, setExcludeFilter, setIncludeFilter } = useFilter();
  const visibleParts = useMemo(
    () =>
      new Set(
        [...model.partNodes]
          .filter(
            ([, node]) => getModuleFilterMultiplier(node.chunk!, data.nodeMetas[node.metaUid!]) > 0,
          )
          .map(([uid]) => uid),
      ),
    [data, model, getModuleFilterMultiplier],
  );
  const scope = model.nodes.get(state.scopeKey)!;

  return (
    <div className="treemap-v2">
      <div className="tmv2-controls">
        <SideBar
          sizeProperty={metric}
          availableSizeProperties={metrics}
          setSizeProperty={setMetric}
          onExcludeChange={setExcludeFilter}
          onIncludeChange={setIncludeFilter}
        />
      </div>
      <div
        className={`tmv2-workspace${open ? "" : " details-closed"}`}
        onClickCapture={(event: MouseEvent) => {
          if (event.detail === 1) firstChartClick.current = undefined;
          const first = firstChartClick.current;
          if (event.detail !== 2 || !first || first.node.partUid !== undefined) return;
          const second = (event.target as Element).closest(".tmv2-node");
          if (!first.reopened && second?.getAttribute("data-output-key") !== first.node.key) return;
          // Opening details can move the first group underneath the pointer.
          // Handle the browser's second click in the stable workspace instead.
          event.preventDefault();
          event.stopPropagation();
          first.zoomed = true;
          zoom(first.node, first.panel);
        }}
        onDblClickCapture={(event: MouseEvent) => {
          if (!firstChartClick.current?.zoomed) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <section className="tmv2-chart" aria-label="Treemap investigation">
          <div className="tmv2-chart-navigation">
            <nav aria-label="Chart location">
              {model.ancestors(scope).map((ancestor, index) => (
                <span key={ancestor.key}>
                  {index > 0 && <span aria-hidden="true"> / </span>}
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "navigate",
                        key: ancestor.key,
                        group: ancestor.partUid === undefined,
                      })
                    }
                  >
                    {index === 0 ? "Overview" : displayModuleId(ancestor.name)}
                  </button>
                </span>
              ))}
            </nav>
            <button
              type="button"
              className="tmv2-icon-button"
              aria-expanded={open}
              onClick={() => {
                if (open) dispatch({ type: "capturePanel", panel: capturePanel() });
                setOpen(!open);
              }}
            >
              {open ? (
                <PanelRightClose className="tmv2-icon" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="tmv2-icon" aria-hidden="true" />
              )}
              {open ? "Hide details" : "Show details"}
            </button>
          </div>
          <Chart
            model={model}
            scope={scope}
            metric={metric}
            visibleParts={visibleParts}
            selected={
              state.current.target.type === "output" && state.current.target.key === state.scopeKey
                ? undefined
                : state.current.target
            }
            inspect={(target) => {
              const node = model.node(target);
              firstChartClick.current = node
                ? { node, reopened: !open, zoomed: false, panel: capturePanel() }
                : undefined;
              setOpen(true);
              dispatch({
                type: "inspect",
                target,
                group: model.isGroup(target),
              });
            }}
          />
        </section>
        <Inspector
          model={model}
          state={state}
          dispatch={dispatch}
          metric={metric}
          metrics={metrics}
          visibleParts={visibleParts}
          scope={scope}
          open={open}
          panelRef={panel}
          zoom={zoom}
        />
      </div>
    </div>
  );
}
