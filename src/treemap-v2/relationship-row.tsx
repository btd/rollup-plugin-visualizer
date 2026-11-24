import { displayModuleId } from "../../shared/display-module-id.js";
import { ArrowLeft, ArrowRight } from "lucide-preact";
import { type Edge, type InspectorData, type Target, moduleTarget } from "./data";

interface Props {
  model: InspectorData;
  edge: Edge;
  sourceFirst: boolean;
  internal?: boolean;
  showBothEndpoints?: boolean;
  kind?: string;
  follow: (target: Target) => void;
}

export function RelationshipRow({
  model,
  edge,
  sourceFirst,
  internal = false,
  showBothEndpoints = true,
  kind,
  follow,
}: Props) {
  const primary = sourceFirst ? edge.source : edge.target;
  const secondary = sourceFirst ? edge.target : edge.source;
  const Direction = sourceFirst ? ArrowRight : ArrowLeft;
  const endpoint = (uid: string) =>
    internal ? (
      <button type="button" onClick={() => follow(moduleTarget(uid))}>
        {displayModuleId(model.data.nodeMetas[uid].id)}
      </button>
    ) : (
      displayModuleId(model.data.nodeMetas[uid].id)
    );
  const content = (
    <>
      <span className="tmv2-path">{endpoint(primary)}</span>
      {showBothEndpoints && (
        <span className="tmv2-path">
          <Direction className="tmv2-icon" aria-hidden="true" />{" "}
          <span className="tmv2-sr-only">{sourceFirst ? "imports " : "imported by "}</span>
          {endpoint(secondary)}
        </span>
      )}
      {kind && <small className="tmv2-kind-label">{kind}</small>}
    </>
  );
  return internal ? (
    <div className="tmv2-row tmv2-internal-row">{content}</div>
  ) : (
    <button type="button" className="tmv2-row" onClick={() => follow(moduleTarget(primary))}>
      {content}
    </button>
  );
}
