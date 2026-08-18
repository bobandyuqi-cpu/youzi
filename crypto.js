// yznb (youzi) AES-GCM decrypt tool
// Key discovered from bundle: tf = "0e3d2cf6f78dc8d8" (16 bytes = AES-128)
// cipher format: base64( [12-byte nonce] || AES-GCM ciphertext(+16-byte tag) )
const crypto = require('crypto');

const KEY_TEXT = "0e3d2cf6f78dc8d8";

function b64ToBuf(b64) {
  return Buffer.from(b64, 'base64');
}

async function gcmDecrypt(cipherB64, keyText) {
  const key = Buffer.from(keyText, 'utf8'); // 16 bytes
  const all = b64ToBuf(cipherB64);
  const nonce = all.subarray(0, 12);
  const ct = all.subarray(12);
  const keyObj = await crypto.webcrypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM' }, false, ['decrypt']
  );
  const plain = await crypto.webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, keyObj, ct
  );
  return Buffer.from(plain).toString('utf8');
}

async function gcmEncrypt(plaintext, keyText) {
  const key = Buffer.from(keyText, 'utf8');
  const nonce = crypto.randomBytes(12);
  const keyObj = await crypto.webcrypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM' }, false, ['encrypt']
  );
  const plain = Buffer.from(plaintext, 'utf8');
  const ct = Buffer.from(await crypto.webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, keyObj, plain
  ));
  return Buffer.concat([nonce, ct]).toString('base64');
}

if (require.main === module) {
  const fs = require('fs');
  const cipher = fs.readFileSync('probe_sysinfo.json', 'utf8').trim();
  console.log('[cipher len]', cipher.length);
  (async () => {
    try {
      const plain = await gcmDecrypt(cipher, KEY_TEXT);
      console.log('[DECRYPTED]\n', plain);
    } catch (e) {
      console.error('[DECRYPT FAIL]', e.message);
    }
  })();
}

module.exports = { gcmDecrypt, gcmEncrypt, KEY_TEXT };
