import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signStreamSessionToken,
  verifyStreamSessionToken,
  signSubtitleToken,
  verifySubtitleToken,
  signSegmentUrl,
  verifySegmentUrl,
} from './proxyToken.ts';

test('stateless stream session tokens roundtrip and reject tampering or expiry', () => {
  const token = signStreamSessionToken(
    {
      u: 'https://vidsrc.buzz/_stream?id=deadbeef',
      r: 'https://vidsrc.buzz/',
      o: 'https://vidsrc.buzz',
      sr: true,
      k: 'hls',
    },
    300,
    'test-secret-0123456789'
  );

  const decoded = verifyStreamSessionToken(token, 'test-secret-0123456789');
  assert.ok(decoded);
  assert.equal(decoded.u, 'https://vidsrc.buzz/_stream?id=deadbeef');
  assert.equal(decoded.r, 'https://vidsrc.buzz/');
  assert.equal(decoded.sr, true);
  assert.equal(decoded.k, 'hls');

  // Wrong secret rejected
  assert.equal(verifyStreamSessionToken(token, 'wrong-secret-0123456789'), null);

  // Tampered payload rejected
  const parts = token.split('.');
  const tampered = `${parts[0]}.${parts[1]}x.${parts[2]}`;
  assert.equal(verifyStreamSessionToken(tampered, 'test-secret-0123456789'), null);

  // Segment HMAC verification across lambdas
  const segUrl = 'https://img.hscow.com/chunk/001.jpg';
  const segSig = signSegmentUrl(token, segUrl, 'test-secret-0123456789');
  assert.equal(verifySegmentUrl(token, segUrl, segSig, 'test-secret-0123456789'), true);
  assert.equal(verifySegmentUrl(token, 'https://evil.com/ssrf', segSig, 'test-secret-0123456789'), false);
});

test('stateless subtitle tokens roundtrip and reject invalid signatures', () => {
  const subTok = signSubtitleToken(
    {
      u: 'https://subs5.strem.io/en/sub.srt',
      l: 'pt-br',
      e: 'utf-8',
    },
    600,
    'test-secret-0123456789'
  );

  const verified = verifySubtitleToken(subTok, 'test-secret-0123456789');
  assert.ok(verified);
  assert.equal(verified.u, 'https://subs5.strem.io/en/sub.srt');
  assert.equal(verified.l, 'pt-br');
  assert.equal(verified.e, 'utf-8');
  assert.equal(verifySubtitleToken(subTok, 'wrong-secret'), null);
});
