const wedding = window.WEDDING;
const strings = wedding.strings;
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = Boolean(tg && tg.initData);

const SIGNATURE_LENGTH = 64;
const PAPER_COLOR = '#f4eee3';

function base64ToBytes(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function readToken() {
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) return tg.initDataUnsafe.start_param;
  const params = new URLSearchParams(location.search);
  return params.get('tgWebAppStartParam') || params.get('startapp');
}

// Format is described in tools/invite.js. Returns null unless the signature is valid.
async function decodeGuestName(token) {
  const bytes = base64ToBytes(token);
  if (bytes.length <= SIGNATURE_LENGTH) return null;
  const signature = bytes.slice(0, SIGNATURE_LENGTH);
  const encrypted = bytes.slice(SIGNATURE_LENGTH);

  const { subtle } = crypto;
  const spki = base64ToBytes(window.INVITE_PUBLIC_KEY);
  const aesKey = await subtle.importKey('raw', await subtle.digest('SHA-256', spki), 'AES-CTR', false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-CTR', counter: signature.slice(0, 16), length: 128 }, aesKey, encrypted);

  const publicKey = await subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, plain);
  return valid ? new TextDecoder().decode(plain) : null;
}

async function showGuest() {
  const guest = document.getElementById('guest');
  let name = null;
  const token = readToken();
  if (token) {
    try {
      name = await decodeGuestName(token);
    } catch (err) {
      console.warn('Could not read invitation token', err);
    }
  }
  guest.textContent = name || strings.genericGuest;
  guest.classList.add('is-shown');
}

function showDetails() {
  document.title = strings.title;
  document.querySelectorAll('[data-text]').forEach((el) => {
    el.textContent = strings[el.dataset.text];
  });

  if (wedding.couple) {
    const couple = document.getElementById('couple');
    couple.textContent = wedding.couple;
    couple.hidden = false;
  }

  if (wedding.date) {
    document.getElementById('date').textContent = new Intl.DateTimeFormat('ru', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tashkent',
    }).format(new Date(`${wedding.date}T12:00:00+05:00`));
    document.getElementById('date-row').hidden = false;
  }

  document.getElementById('time').textContent = wedding.time;
  document.getElementById('venue').textContent = wedding.venue.name;
  document.getElementById('address').textContent = wedding.venue.address;
}

function showMap() {
  const { lat, lon, name } = wedding.venue;
  const map = document.getElementById('map');
  map.title = `${strings.directions}: ${name}`;
  // Keyless Google embed: Yandex's map-widget path fails to load on some networks.
  map.src = `https://www.google.com/maps?q=${lat},${lon}&z=16&hl=ru&output=embed`;

  document.getElementById('yandex-link').href = `https://yandex.uz/maps/?pt=${lon},${lat}&z=17&l=map`;
  document.getElementById('google-link').href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  if (inTelegram) {
    document.querySelectorAll('.map-links a').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        tg.openLink(link.href);
      });
    });
  }
}

function setUpTelegram() {
  if (!inTelegram) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor(PAPER_COLOR);
  tg.setBackgroundColor(PAPER_COLOR);
  // Otherwise dragging the map down can close the app.
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes();
}

showDetails();
showMap();
setUpTelegram();
showGuest();
