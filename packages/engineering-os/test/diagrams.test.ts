import assert from 'node:assert/strict';
import test from 'node:test';
import { apiFlowDiagram, architectureDiagram, dependencyDiagram } from '../src/diagrams';

test('generates Mermaid architecture, dependency, and API diagrams', () => {
  assert.match(architectureDiagram([{ name: 'Control Plane', components: ['Router'] }]), /flowchart TB/);
  assert.match(dependencyDiagram({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] }), /A --> B/);
  assert.match(apiFlowDiagram([{ actor: 'UI', target: 'API', message: 'GET status' }]), /sequenceDiagram/);
});
