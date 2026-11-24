import { outputTarget, targetId, type Target } from "./data";

export type Section = "incoming" | "outgoing" | "members";
export interface Selection {
  target: Target;
  section: Section;
  query: string;
  scrollTop?: number;
  identityScrollTop?: number;
  occurrence?: string;
  internal?: { open: boolean; scrollTop: number };
}
interface View {
  scopeKey: string;
  current: Selection;
}
export interface InspectorState extends View {
  history: View[];
  revision: number;
}
const summary = (key: string, group: boolean): Selection => ({
  target: outputTarget(key),
  section: group ? "members" : "incoming",
  query: "",
});
export const initialInspector: InspectorState = {
  scopeKey: "root",
  current: summary("root", true),
  history: [],
  revision: 0,
};
export type InspectorAction =
  | { type: "inspect"; target: Target; group: boolean }
  | { type: "clear"; group: boolean }
  | { type: "zoom"; key: string; group: boolean; panel: Selection }
  | { type: "navigate"; key: string; group: boolean }
  | { type: "undoZoom" }
  | { type: "capturePanel"; panel: Selection }
  | { type: "query"; query: string }
  | { type: "section"; section: Section };

export function inspectorReducer(state: InspectorState, action: InspectorAction): InspectorState {
  switch (action.type) {
    case "inspect": {
      if (targetId(state.current.target) === targetId(action.target)) return state;
      const section = state.current.section;
      return {
        ...state,
        current:
          action.target.type === "output" && action.target.key === state.scopeKey
            ? summary(state.scopeKey, action.group)
            : {
                target: action.target,
                section: !action.group && section === "members" ? "incoming" : section,
                query: "",
              },
        revision: state.revision + 1,
      };
    }
    case "clear":
      return {
        ...state,
        current: summary(state.scopeKey, action.group),
        revision: state.revision + 1,
      };
    case "zoom":
      if (action.key === state.scopeKey) return state;
      return {
        scopeKey: action.key,
        current: summary(action.key, action.group),
        history: [...state.history, { scopeKey: state.scopeKey, current: action.panel }],
        revision: state.revision + 1,
      };
    case "navigate":
      return {
        scopeKey: action.key,
        current: summary(action.key, action.group),
        history: action.key === state.scopeKey ? state.history : [],
        revision: state.revision + 1,
      };
    case "undoZoom": {
      const previous = state.history.at(-1);
      return previous
        ? { ...previous, history: state.history.slice(0, -1), revision: state.revision + 1 }
        : state;
    }
    case "query":
      return { ...state, current: { ...state.current, query: action.query } };
    case "capturePanel":
      return { ...state, current: action.panel };
    case "section":
      if (state.current.section === action.section) return state;
      return { ...state, current: { ...state.current, section: action.section, query: "" } };
  }
}
