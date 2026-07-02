export interface DependencyGraph {
  nodes: Array<{ id: string; label?: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

const quote = (value: string): string => `"${value.replaceAll('"', '\\"')}"`;

export function architectureDiagram(layers: Array<{ name: string; components: string[] }>): string {
  const lines = ['flowchart TB'];
  layers.forEach((layer, layerIndex) => {
    lines.push(`  subgraph L${layerIndex}[${quote(layer.name)}]`);
    layer.components.forEach((component, componentIndex) => lines.push(`    L${layerIndex}C${componentIndex}[${quote(component)}]`));
    lines.push('  end');
    if (layerIndex > 0) lines.push(`  L${layerIndex - 1}C0 --> L${layerIndex}C0`);
  });
  return lines.join('\n');
}

export function dependencyDiagram(graph: DependencyGraph): string {
  return [
    'flowchart LR',
    ...graph.nodes.map((node) => `  ${node.id}[${quote(node.label || node.id)}]`),
    ...graph.edges.map((edge) => `  ${edge.from} -->${edge.label ? `|${quote(edge.label)}|` : ''} ${edge.to}`),
  ].join('\n');
}

export function apiFlowDiagram(steps: Array<{ actor: string; target: string; message: string }>): string {
  const participants = [...new Set(steps.flatMap((step) => [step.actor, step.target]))];
  return [
    'sequenceDiagram',
    ...participants.map((participant) => `  participant ${participant}`),
    ...steps.map((step) => `  ${step.actor}->>${step.target}: ${step.message}`),
  ].join('\n');
}
