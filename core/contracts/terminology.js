#!/usr/bin/env node

'use strict';

const TERMINOLOGY = Object.freeze({
  harness: Object.freeze({ preferred: 'engineering operating system', status: 'compatible' }),
  dashboard: Object.freeze({ preferred: 'control plane', status: 'alias' }),
  '.planning': Object.freeze({ preferred: 'workspace state', status: 'canonical-path-retained' }),
  fleet: Object.freeze({ preferred: 'parallel team', status: 'alias' }),
  skill: Object.freeze({ preferred: 'capability', status: 'compatible' }),
  agent: Object.freeze({ preferred: 'specialist agent', status: 'compatible' }),
});

function preferredTerm(legacyTerm) {
  return TERMINOLOGY[legacyTerm]?.preferred || legacyTerm;
}

function compatibilityAliases() {
  return Object.entries(TERMINOLOGY).map(([legacy, value]) => ({
    legacy,
    preferred: value.preferred,
    status: value.status,
  }));
}

module.exports = Object.freeze({
  TERMINOLOGY,
  compatibilityAliases,
  preferredTerm,
});
