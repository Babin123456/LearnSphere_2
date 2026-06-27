/*
  curriculumMap.js

  Renders an SVG curriculum graph from window.curriculumMapConfig.
  Uses progress.js storage (learnsphere_progress) to color completed/in-progress nodes.
*/

(function () {
  const CFG = {
    svgId: "curriculumMapSvg",
    containerId: "curriculumMapContainer",
    legendId: "curriculumMapLegend",
    toggleCompletedOnlyId: "curriculumMapCompletedOnlyToggle",
    maxLabelLines: 2,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function loadProgressMap() {
    // progress.js already defines topic ids + state logic, but it keeps helpers private.
    // We'll read localStorage directly for states.
    try {
      const raw = localStorage.getItem("learnsphere_progress");
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function getTopicState(progressMap, topicId) {
    return progressMap?.[topicId] || "not-started";
  }

  function colorForState(state) {
    if (state === "completed") return "#66fcf1";
    if (state === "in-progress") return "#f0a500";
    return "rgba(255,255,255,0.22)";
  }

  function strokeForState(state) {
    if (state === "completed") return "rgba(102,252,241,0.95)";
    if (state === "in-progress") return "rgba(240,165,0,0.95)";
    return "rgba(255,255,255,0.20)";
  }

  function textForState(state) {
    if (state === "completed") return "Completed";
    if (state === "in-progress") return "In Progress";
    return "Not Started";
  }

  function buildGraph(config) {
    const nodes = config.nodes || [];
    const edges = config.edges || [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const incoming = new Map();
    const outgoing = new Map();

    for (const n of nodes) {
      incoming.set(n.id, []);
      outgoing.set(n.id, []);
    }

    for (const e of edges) {
      if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) continue;
      outgoing.get(e.from).push(e.to);
      incoming.get(e.to).push(e.from);
    }

    // Topological layering (longest prerequisite chain)
    // For small graphs it is fine.
    const indeg = new Map();
    const adj = new Map();
    for (const n of nodes) {
      indeg.set(n.id, 0);
      adj.set(n.id, []);
    }
    for (const e of edges) {
      if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) continue;
      indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
      adj.get(e.from).push(e.to);
    }

    const queue = [];
    const dist = new Map();
    for (const n of nodes) {
      if ((indeg.get(n.id) || 0) === 0) {
        queue.push(n.id);
        dist.set(n.id, 0);
      } else {
        dist.set(n.id, 0);
      }
    }

    // Kahn's algorithm; dist as max prerequisite depth
    while (queue.length) {
      const u = queue.shift();
      const du = dist.get(u) || 0;
      for (const v of adj.get(u) || []) {
        dist.set(v, Math.max(dist.get(v) || 0, du + 1));
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) queue.push(v);
      }
    }

    // Fallback: if cycles exist, some nodes may never get proper depth.
    for (const n of nodes) {
      if (!dist.has(n.id)) dist.set(n.id, 0);
    }

    return { nodeMap, nodes, edges, incoming, outgoing, dist };
  }

  function wrapLabel(label, maxLines = 2) {
    // Split by spaces, greedily pack lines.
    const words = String(label).split(/\s+/).filter(Boolean);
    if (words.length <= 1) return [label];

    const lines = [];
    let current = "";
    for (const w of words) {
      const next = current ? current + " " + w : w;
      if (current.length === 0) {
        current = w;
      } else if (next.length > 18 && lines.length < maxLines - 1) {
        lines.push(current);
        current = w;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, maxLines);
  }

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
    return el;
  }

  function clear(el) {
    if (el) el.innerHTML = "";
  }

  function computeLayout(graph) {
    const nodes = graph.nodes;
    const layers = new Map();

    // layer depth = graph.dist
    for (const n of nodes) {
      const layer = graph.dist.get(n.id) || 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(n.id);
    }

    // Stable ordering by label
    for (const [layer, ids] of layers.entries()) {
      ids.sort((a, b) => String(graph.nodeMap.get(a)?.label || a).localeCompare(String(graph.nodeMap.get(b)?.label || b)));
      layers.set(layer, ids);
    }

    const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

    const nodeW = 168;
    const nodeH = 52;
    const xPad = 60;
    const yPad = 26;

    const layerCount = layerKeys.length;
    let maxInLayer = 1;
    for (const k of layerKeys) {
      maxInLayer = Math.max(maxInLayer, layers.get(k).length);
    }

    const width = Math.max(900, layerCount * (nodeW + xPad) - xPad + 140);
    const height = Math.max(420, maxInLayer * (nodeH + yPad) + 120);

    const positions = new Map();

    layerKeys.forEach((layerKey, li) => {
      const ids = layers.get(layerKey);
      const colX = 80 + li * (nodeW + xPad);

      const totalH = (ids.length - 1) * (nodeH + yPad);
      const topY = (height - totalH) / 2 - nodeH / 2;

      ids.forEach((id, idx) => {
        const x = colX;
        const y = topY + idx * (nodeH + yPad);
        positions.set(id, { x, y, nodeW, nodeH });
      });
    });

    return { width, height, positions, nodeW, nodeH };
  }

  function draw({ config, container, progressMap, completedOnly }) {
    const graph = buildGraph(config);
    const layout = computeLayout(graph);

    // Create/ensure SVG
    clear(container);
    const svg = createSvgEl("svg", {
      id: CFG.svgId,
      width: layout.width,
      height: layout.height,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      style: "max-width:100%; height:auto; display:block; overflow:visible;"
    });

    // Background
    svg.appendChild(createSvgEl("rect", {
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      fill: "rgba(255,255,255,0.01)"
    }));

    // Edges first
    const visibleEdges = config.edges.filter(e => {
      if (!graph.nodeMap.has(e.from) || !graph.nodeMap.has(e.to)) return false;
      if (!completedOnly) return true;
      const sFrom = getTopicState(progressMap, e.from);
      const sTo = getTopicState(progressMap, e.to);
      return sFrom === "completed" && sTo === "completed";
    });

    for (const e of visibleEdges) {
      const pFrom = layout.positions.get(e.from);
      const pTo = layout.positions.get(e.to);
      if (!pFrom || !pTo) continue;

      const x1 = pFrom.x + pFrom.nodeW;
      const y1 = pFrom.y + pFrom.nodeH / 2;
      const x2 = pTo.x;
      const y2 = pTo.y + pTo.nodeH / 2;

      const dx = Math.max(40, (x2 - x1) * 0.5);
      const c1x = x1 + dx;
      const c1y = y1;
      const c2x = x2 - dx;
      const c2y = y2;

      const path = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

      const sFrom = getTopicState(progressMap, e.from);
      const sTo = getTopicState(progressMap, e.to);
      const active = (sFrom === "completed" && sTo === "completed");

      const edge = createSvgEl("path", {
        d: path,
        fill: "none",
        stroke: active ? "rgba(102,252,241,0.8)" : "rgba(255,255,255,0.18)",
        "stroke-width": active ? 2.2 : 1.6,
        "stroke-linecap": "round",
        "data-from": e.from,
        "data-to": e.to
      });
      svg.appendChild(edge);
    }

    // Nodes
    const nodeIds = config.nodes.map(n => n.id).filter(id => graph.nodeMap.has(id));

    for (const id of nodeIds) {
      const node = graph.nodeMap.get(id);
      const pos = layout.positions.get(id);
      if (!node || !pos) continue;

      const state = getTopicState(progressMap, id);
      if (completedOnly && state !== "completed") continue;

      const fill = colorForState(state);
      const stroke = strokeForState(state);
      const opacity = state === "not-started" ? 0.6 : 1;

      const group = createSvgEl("g", {
        "data-node-id": id,
        opacity
      });

      // Node card
      group.appendChild(createSvgEl("rect", {
        x: pos.x,
        y: pos.y,
        width: pos.nodeW,
        height: pos.nodeH,
        rx: 12,
        fill: "rgba(255,255,255,0.03)",
        stroke: stroke,
        "stroke-width": state === "not-started" ? 1.2 : 2,
      }));

      // Accent bar
      group.appendChild(createSvgEl("rect", {
        x: pos.x + 10,
        y: pos.y + 12,
        width: 8,
        height: pos.nodeH - 24,
        rx: 999,
        fill: fill,
        opacity: state === "not-started" ? 0.35 : 0.95
      }));

      // Label
      const lines = wrapLabel(node.label, CFG.maxLabelLines);
      const text = createSvgEl("text", {
        x: pos.x + 24,
        y: pos.y + 22,
        fill: "#fff",
        "font-family": "inherit",
        "font-size": 13,
        "font-weight": 700,
        "pointer-events": "none"
      });

      lines.forEach((ln, i) => {
        const tspan = createSvgEl("tspan", {
          x: pos.x + 24,
          dy: i === 0 ? 0 : 16
        });
        tspan.textContent = ln;
        text.appendChild(tspan);
      });

      group.appendChild(text);

      // State badge
      group.appendChild(createSvgEl("text", {
        x: pos.x + pos.nodeW - 16,
        y: pos.y + 18,
        fill: fill,
        "font-family": "inherit",
        "font-size": 12,
        "font-weight": 800,
        "text-anchor": "end",
        "pointer-events": "none",
      })).textContent = state === "completed" ? "✓" : state === "in-progress" ? "…" : "";

      // Click/hover interactivity
      group.style.cursor = node.quizUrl ? "pointer" : "default";

      group.addEventListener("mouseenter", () => {
        // highlight connected edges
        svg.querySelectorAll("path").forEach(p => {
          const f = p.getAttribute("data-from");
          const t = p.getAttribute("data-to");
          const isConn = f === id || t === id;
          p.style.stroke = isConn ? "rgba(102,252,241,0.9)" : p.getAttribute("stroke");
          p.style.strokeWidth = isConn ? 3.0 : 1.6;
          if (p.style.stroke !== "") {
            // keep
          }
        });
      });

      group.addEventListener("mouseleave", () => {
        // Re-render quickly to reset strokes
        // (cheap for small graphs)
        draw({ config, container, progressMap, completedOnly });
      });

      group.addEventListener("click", () => {
        const s = getTopicState(progressMap, id);
        const title = `${node.label}\n${textForState(s)}`;
        if (node.quizUrl) {
          // quick navigation
          window.location.href = node.quizUrl;
        } else {
          alert(title);
        }
      });

      // Tooltip via <title> for accessibility
      const title = createSvgEl("title");
      title.textContent = `${node.label} — ${textForState(state)}`;
      group.appendChild(title);

      svg.appendChild(group);
    }

    // Legend
    const legend = $(CFG.legendId);
    if (legend) {
      legend.innerHTML = `
        <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
          <div><span style="display:inline-block;width:14px;height:10px;border-radius:999px;background:${strokeForState("completed")}"></span> Completed</div>
          <div><span style="display:inline-block;width:14px;height:10px;border-radius:999px;background:${strokeForState("in-progress")}"></span> In Progress</div>
          <div><span style="display:inline-block;width:14px;height:10px;border-radius:999px;background:rgba(255,255,255,0.22)"></span> Not Started</div>
        </div>
      `;
    }

    container.appendChild(svg);
  }

  function init() {
    const config = window.curriculumMapConfig;
    const container = $(CFG.containerId);
    if (!config || !container) return;

    const progressMap = loadProgressMap();

    const toggleEl = $(CFG.toggleCompletedOnlyId);
    const completedOnly = !!toggleEl?.checked;

    draw({
      config,
      container,
      progressMap,
      completedOnly,
    });

    // Re-render on toggle changes
    if (toggleEl) {
      toggleEl.addEventListener("change", () => {
        const pm = loadProgressMap();
        draw({ config, container, progressMap: pm, completedOnly: !!toggleEl.checked });
      });
    }

    // Also re-render when user returns/opens after completion changes
    window.addEventListener("storage", () => {
      const pm = loadProgressMap();
      draw({ config, container, progressMap: pm, completedOnly: !!toggleEl?.checked });
    });

    // For this app (single-tab), progress updates won't trigger storage events.
    // However, progress.js doesn't currently emit events; so this is just a best-effort.
  }

  document.addEventListener("DOMContentLoaded", init);
  window.curriculumMap = { init };
})();

