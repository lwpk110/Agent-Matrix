import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedClaudeTelemetryOrigin } from './claudeTelemetryAccess';

test('Claude telemetry 仅接受本地观测站的精确 Origin 和 Host', () => {
  assert.equal(isTrustedClaudeTelemetryOrigin({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', port: 3000 }), true);
  assert.equal(isTrustedClaudeTelemetryOrigin({ host: 'localhost:3000', origin: 'http://localhost:3000', port: 3000 }), true);
  assert.equal(isTrustedClaudeTelemetryOrigin({ host: 'attacker.test:3000', origin: 'http://attacker.test:3000', port: 3000 }), false);
  assert.equal(isTrustedClaudeTelemetryOrigin({ host: '127.0.0.1:3000', origin: 'http://attacker.test:3000', port: 3000 }), false);
  assert.equal(isTrustedClaudeTelemetryOrigin({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:5173', port: 3000 }), false);
});
