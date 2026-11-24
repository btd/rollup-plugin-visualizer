import { describe, expect, it } from "vitest";
import { inspectorReducer, initialInspector } from "../src/treemap-v2/state";
import { moduleTarget, outputTarget } from "../src/treemap-v2/data";

const select = (uid: string) =>
  inspectorReducer(initialInspector, { type: "inspect", target: moduleTarget(uid), group: false });

describe("Inspector navigation", () => {
  it("starts at the report summary and inspection changes only the panel", () => {
    expect(initialInspector.scopeKey).toBe("root");
    expect(initialInspector.current.target).toEqual(outputTarget("root"));
    const state = select("a");
    expect(state.scopeKey).toBe("root");
    expect(state.current.target).toEqual(moduleTarget("a"));
    const captured = inspectorReducer(state, {
      type: "capturePanel",
      panel: { ...state.current, scrollTop: 230, occurrence: "part-a" },
    });
    expect(captured.current.scrollTop).toBe(230);
    expect(captured.current.occurrence).toBe("part-a");
    expect(captured.scopeKey).toBe(state.scopeKey);
    expect(captured.revision).toBe(state.revision);
    expect(captured.history).toEqual(state.history);
  });

  it("zooms chart and panel together and undo restores the complete prior view", () => {
    const before = select("shared");
    const panel = {
      ...before.current,
      section: "outgoing" as const,
      query: "地域😀",
      scrollTop: 640,
      identityScrollTop: 30,
      occurrence: "right-part",
      internal: { open: true, scrollTop: 120 },
    };
    let state = inspectorReducer(before, {
      type: "zoom",
      key: "root/1/0",
      group: false,
      panel,
    });
    expect(state.scopeKey).toBe("root/1/0");
    expect(state.current.target).toEqual(outputTarget("root/1/0"));
    expect(state.current.query).toBe("");
    state = inspectorReducer(state, { type: "undoZoom" });
    expect(state.scopeKey).toBe("root");
    expect(state.current).toEqual(panel);
    expect(state.history).toEqual([]);
  });

  it("clears selection to the current view summary without losing zoom undo", () => {
    let state = inspectorReducer(initialInspector, {
      type: "zoom",
      key: "root/0",
      group: true,
      panel: initialInspector.current,
    });
    state = inspectorReducer(state, { type: "inspect", target: moduleTarget("a"), group: false });
    state = inspectorReducer(state, { type: "clear", group: true });
    expect(state.scopeKey).toBe("root/0");
    expect(state.current).toEqual({
      target: outputTarget("root/0"),
      section: "members",
      query: "",
    });
    expect(state.history).toHaveLength(1);
  });

  it("breadcrumbs and Overview establish matching chart and panel destinations", () => {
    let state = inspectorReducer(initialInspector, {
      type: "zoom",
      key: "root/0/0",
      group: false,
      panel: initialInspector.current,
    });
    state = inspectorReducer(state, { type: "navigate", key: "root/0", group: true });
    expect(state.scopeKey).toBe("root/0");
    expect(state.current.target).toEqual(outputTarget("root/0"));
    expect(state.history).toEqual([]);
    state = inspectorReducer(state, { type: "navigate", key: "root", group: true });
    expect(state.scopeKey).toBe("root");
    expect(state.current.target).toEqual(outputTarget("root"));
  });

  it("undoes nested zooms in order and ignores a zoom to the current scope", () => {
    let state = initialInspector;
    for (const key of ["root/0", "root/0/0"])
      state = inspectorReducer(state, { type: "zoom", key, group: true, panel: state.current });
    expect(
      inspectorReducer(state, {
        type: "zoom",
        key: "root/0/0",
        group: true,
        panel: state.current,
      }),
    ).toBe(state);
    state = inspectorReducer(state, { type: "undoZoom" });
    expect(state.scopeKey).toBe("root/0");
    expect(state.current.target).toEqual(outputTarget("root/0"));
    state = inspectorReducer(state, { type: "undoZoom" });
    expect(state.scopeKey).toBe("root");
    expect(inspectorReducer(state, { type: "undoZoom" })).toBe(state);
  });

  it("preserves same-target context and resets search on another selection or tab", () => {
    let state = select("a");
    state = inspectorReducer(state, { type: "query", query: "path" });
    expect(
      inspectorReducer(state, { type: "inspect", target: moduleTarget("a"), group: false }),
    ).toBe(state);
    state = inspectorReducer(state, { type: "section", section: "outgoing" });
    expect(state.current.query).toBe("");
    state = inspectorReducer(state, { type: "inspect", target: moduleTarget("b"), group: false });
    expect(state.current.section).toBe("outgoing");
  });
});
