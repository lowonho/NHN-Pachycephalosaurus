import assert from 'node:assert/strict';
import './archive-clearability.mjs';
import './archive-gravity-check.mjs';
import './archive-bounce-check.mjs';
import './archive-stack-check.mjs';
import { STAGES } from '../js/archive/data.mjs';
assert.deepEqual(STAGES.map(stage => stage.id), ['maze', 'gravity', 'bounce', 'friction', 'stack']);
// Friction routes run against the actual scene in archive-recovery-browser.mjs.
console.log('PASS | five-stage registration and shared physics checks');
