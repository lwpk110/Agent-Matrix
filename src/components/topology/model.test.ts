import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGES, NODES, matchesNode, nodeState, relatedNodes, type NodeId } from './model';

test('graph has unique identities and valid directed endpoints', () => {
  const ids = new Set(NODES.map(n => n.id));
  assert.equal(ids.size, NODES.length);
  assert.equal(new Set(EDGES.map(e => e.id)).size, EDGES.length);
  for (const edge of EDGES) {
    assert.ok(ids.has(edge.from));
    assert.ok(ids.has(edge.to));
    assert.notEqual(edge.from, edge.to);
  }
});

test('every execution route passes the permission gate and holds its downstream links', () => {
  const visited = new Set<NodeId>();
  const queue: NodeId[] = ['prompt'];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id) || id === 'gate') continue;
    visited.add(id);
    queue.push(...EDGES.filter(e => e.from === id).map(e => e.to));
  }
  assert.ok(!visited.has('shell'));
  assert.ok(!visited.has('files'));
  const downstream = new Set<NodeId>(['gate', 'shell', 'files', 'feedback']);
  for (const edge of EDGES.filter(e => downstream.has(e.from))) assert.equal(edge.downstream, true);
});

test('permission blocking overrides a stale execution stage', () => {
  for (const node of NODES) {
    const state = nodeState(node, 'sandbox', true);
    if (node.id === 'gate') assert.equal(state, 'blocked');
    else if (node.layer >= 3) assert.equal(state, 'waiting');
    assert.notEqual(state, 'active');
  }
  for (const node of NODES) assert.equal(nodeState(node, undefined, false), 'ready');
  assert.equal(nodeState(NODES.find(n => n.id === 'core')!, 'llm', false), 'active');
});

test('search supports both languages, identifiers and whitespace', () => {
  const gate = NODES.find(n => n.id === 'gate')!;
  for (const query of [' 权限 ', 'PERMISSION', 'hitl', 'gate', '策略层', '']) assert.ok(matchesNode(gate, query));
  assert.equal(matchesNode(gate, 'missing-node'), false);
  assert.deepEqual([...relatedNodes('gate')].sort(), ['files', 'gate', 'hook', 'shell']);
});

test('both layouts provide distinct finite positions for all nodes', () => {
  for (const layout of ['layered', 'orbit'] as const) {
    const positions = NODES.map(n => n.positions[layout]);
    assert.equal(new Set(positions.map(p => p.join(','))).size, NODES.length);
    for (const position of positions) assert.ok(position.every(Number.isFinite));
  }
});
