#!/usr/bin/env node
// Creates personal invitation links. Runs locally only, needs no dependencies.
//
//   node tools/invite.js keygen
//   node tools/invite.js link "Anna and Timur"
//   node tools/invite.js batch guests.txt
//
// Add --base=<url> to link or batch to override BASE_URL for one run.
//
// Token: base64url( signature[64] || AES-CTR(name) )
//   signature  ECDSA P-256 / SHA-256 over the UTF-8 name, made with the private key
//   AES key    SHA-256 of the public key (SPKI DER), so the page can derive it
//   counter    first 16 bytes of the signature

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Direct Link Mini App address from BotFather; the token is appended to it.
const BASE_URL = 'https://t.me/WeddingInviteCardBot/invite?mode=fullscreen&startapp=';

const ROOT = path.join(__dirname, '..');
const PRIVATE_KEY_PATH = path.join(ROOT, 'keys', 'private.pem');
const PUBLIC_KEY_JS_PATH = path.join(ROOT, 'site', 'public-key.js');

// Telegram rejects a startapp value longer than this.
const MAX_TOKEN_LENGTH = 512;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function keygen() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  fs.mkdirSync(path.dirname(PRIVATE_KEY_PATH), { recursive: true });
  try {
    // 'wx' refuses to overwrite: a new key would invalidate every link already sent.
    fs.writeFileSync(PRIVATE_KEY_PATH, pem, { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if (err.code === 'EEXIST') fail(`${PRIVATE_KEY_PATH} already exists. Delete it yourself if you really want a new key; links already sent will stop working.`);
    throw err;
  }

  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  fs.writeFileSync(PUBLIC_KEY_JS_PATH, `window.INVITE_PUBLIC_KEY = '${spki}';\n`);

  console.log(`Private key: ${PRIVATE_KEY_PATH} (keep secret, never deploy)`);
  console.log(`Public key:  ${PUBLIC_KEY_JS_PATH} (deployed with the page)`);
}

function loadPrivateKey() {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) fail('No private key found. Run: node tools/invite.js keygen');
  return crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH));
}

function makeToken(rawName, privateKey) {
  const name = rawName.trim().normalize('NFC');
  if (!name) fail('Guest name is empty.');

  const plain = Buffer.from(name, 'utf8');
  const signature = crypto.sign('sha256', plain, { key: privateKey, dsaEncoding: 'ieee-p1363' });

  const spki = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const aesKey = crypto.createHash('sha256').update(spki).digest();
  const cipher = crypto.createCipheriv('aes-256-ctr', aesKey, signature.subarray(0, 16));
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);

  const token = Buffer.concat([signature, encrypted]).toString('base64url');
  if (token.length > MAX_TOKEN_LENGTH) fail(`Name is too long for a Telegram link: ${name}`);
  return token;
}

function csvField(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

const args = process.argv.slice(2);
const baseFlag = args.find((arg) => arg.startsWith('--base='));
const baseUrl = baseFlag ? baseFlag.slice('--base='.length) : BASE_URL;
const [command, value] = args.filter((arg) => arg !== baseFlag);

if (command === 'keygen') {
  keygen();
} else if (command === 'link' && value) {
  console.log(baseUrl + makeToken(value, loadPrivateKey()));
} else if (command === 'batch' && value) {
  const privateKey = loadPrivateKey();
  const names = fs.readFileSync(value, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  const rows = names.map((name) => `${csvField(name.trim())},${csvField(baseUrl + makeToken(name, privateKey))}`);
  const outPath = path.join(ROOT, 'guest-links.csv');
  // The BOM makes Excel read Cyrillic names correctly.
  fs.writeFileSync(outPath, '﻿' + ['name,link', ...rows].join('\r\n') + '\r\n');
  console.log(`${names.length} links written to ${outPath}`);
} else {
  fail('Usage:\n  node tools/invite.js keygen\n  node tools/invite.js link "Guest name" [--base=url]\n  node tools/invite.js batch guests.txt [--base=url]');
}
