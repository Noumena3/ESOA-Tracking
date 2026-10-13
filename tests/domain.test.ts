import assert from 'node:assert/strict';
import test from 'node:test';
import {
    escapeHtml,
    isNonNegativeInteger,
    isShipmentStatus,
    normalizeShipmentStatus,
    postgrestIlikePattern,
} from '../src/domain.ts';

test('escapeHtml treats article names as text', () => {
    assert.equal(escapeHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
});

test('fees accept only safe non-negative integers', () => {
    assert.equal(isNonNegativeInteger(0), true);
    assert.equal(isNonNegativeInteger(12500), true);
    assert.equal(isNonNegativeInteger(-1), false);
    assert.equal(isNonNegativeInteger(1.5), false);
    assert.equal(isNonNegativeInteger(Number.NaN), false);
    assert.equal(isNonNegativeInteger(Number.MAX_SAFE_INTEGER + 1), false);
});

test('shipment status normalization supports legacy rows and current options', () => {
    assert.equal(normalizeShipmentStatus('Livré'), 'Arrivé');
    assert.equal(normalizeShipmentStatus('En transit'), 'En transit');
    assert.equal(isShipmentStatus('Arrivé'), true);
    assert.equal(isShipmentStatus('Livré'), false);
});

test('PostgREST search patterns escape wildcard and quote characters', () => {
    assert.equal(
        postgrestIlikePattern('a,b.(c)%_ "x"\\'),
        '"%a,b.(c)\\%\\_ \\"x\\"\\\\%"'
    );
});
