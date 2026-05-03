import './style.css';
import ForceGraph3D from '3d-force-graph';

// Sample data — mental models as nodes
const data = {
  nodes: [
    { id: 'Antifragile' },
    { id: 'Entropy' },
    { id: 'First Principles' },
    { id: 'Skin in the Game' },
    { id: 'Inversion' },
    { id: 'Second-Order Thinking' },
    { id: 'Black Swan' },
    { id: 'Lindy Effect' },
    { id: "Occam's Razor" },
    { id: 'Pareto' },
  ],
  links: [
    { source: 'Antifragile', target: 'Black Swan' },
    { source: 'Antifragile', target: 'Skin in the Game' },
    { source: 'Antifragile', target: 'Lindy Effect' },
    { source: 'Black Swan', target: 'Second-Order Thinking' },
    { source: 'Black Swan', target: 'Entropy' },
    { source: 'First Principles', target: 'Inversion' },
    { source: 'First Principles', target: "Occam's Razor" },
    { source: 'Inversion', target: 'Second-Order Thinking' },
    { source: 'Second-Order Thinking', target: 'Pareto' },
    { source: 'Pareto', target: 'Lindy Effect' },
    { source: "Occam's Razor", target: 'Entropy' },
    { source: 'Skin in the Game', target: 'Second-Order Thinking' },
    { source: 'Lindy Effect', target: "Occam's Razor" },
    { source: 'Entropy', target: 'Pareto' },
    { source: 'Inversion', target: 'Antifragile' },
  ],
};

// Mount the graph
const graph = new ForceGraph3D(document.getElementById('graph'))
  .graphData(data)
  .backgroundColor('#0a0e1a')
  .nodeColor(() => '#cfd8e8')      // pale blue-white spheres
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .linkColor(() => '#666b7a')      // subtle gray edges
  .linkOpacity(0.5)
  .linkWidth(0.5)
  .nodeLabel('id');                // hover shows the node name