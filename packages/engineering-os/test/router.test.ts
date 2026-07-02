import assert from 'node:assert/strict';
import test from 'node:test';
import { NaturalLanguageRouter } from '../src/router';

test('routes natural language platform work to a parallel team', () => {
  const task = new NaturalLanguageRouter().route(
    'Build a production frontend, backend API, CI deployment, security audit, and tests',
    'C:/project',
  );
  assert.equal(task.route, '/fleet --quick');
  assert.equal(task.metadata.source, 'natural-language');
  assert(task.roles.includes('frontend'));
  assert(task.roles.includes('backend'));
  assert(task.roles.includes('devops'));
  assert(task.roles.includes('security'));
  assert(task.roles.includes('qa'));
});

test('preserves /do command source compatibility', () => {
  const task = new NaturalLanguageRouter().route('/do review the API security', 'C:/project');
  assert.equal(task.metadata.source, 'do-command');
  assert(task.roles.includes('security'));
});
