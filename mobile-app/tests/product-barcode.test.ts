import assert from 'node:assert/strict';
import test from 'node:test';

import {
  barcodeDigits,
  barcodeLookupCandidates,
  canonicalGtin14,
  expandUpcE,
  hasValidGtinCheckDigit,
  supportedProductBarcodeType,
} from '../services/product-barcode';

test('normalizes valid UPC-A and equivalent EAN-13 values to the same GTIN-14 key', () => {
  assert.equal(hasValidGtinCheckDigit('042100005264'), true);
  assert.equal(canonicalGtin14('0 42100-00526 4'), '00042100005264');
  assert.equal(canonicalGtin14('0042100005264'), '00042100005264');
});

test('rejects malformed lengths, letters, and invalid GTIN check digits', () => {
  assert.equal(barcodeDigits('12345'), undefined);
  assert.equal(barcodeDigits('01234ABC8905'), undefined);
  assert.equal(canonicalGtin14('042100005265'), undefined);
  assert.deepEqual(barcodeLookupCandidates('042100005265'), []);
});

test('expands UPC-E while keeping EAN-8 and UPC-E lookup paths distinct', () => {
  assert.equal(expandUpcE('04252614'), '042100005264');
  assert.deepEqual(barcodeLookupCandidates('04252614', 'upc_e'), ['00042100005264']);
  assert.equal(supportedProductBarcodeType('upc_e'), 'upc_e');
  assert.equal(supportedProductBarcodeType('qr'), 'unknown');
});
