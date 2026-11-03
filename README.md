# Wedding invitation

A static invitation page for a Telegram Mini App, with a personal, signed link for each guest.

```
site/           the page; deploy this folder and nothing else
  config.js     wedding details and all text; edit this one
  public-key.js created by keygen, safe to publish
tools/
  invite.js     creates keys and guest links
  serve.js      local preview on http://localhost:8080
keys/           private key; never deploy or commit it
```

## Setup

1. Upload the `site/` folder to any static HTTPS host, such as Cloudflare Pages or Netlify.
2. In [@BotFather](https://t.me/BotFather), run `/newbot` if you have no bot yet, then `/newapp`. Give it the page URL and a short name.
3. Set `BASE_URL` at the top of `tools/invite.js` to `https://t.me/<bot>/<short name>?startapp=`.

## Creating links

One guest:

```bash
node tools/invite.js link "Anna and Timur"
```

Everyone: put one name per line in `guests.txt`, then run the command below. It writes `guest-links.csv`.

```bash
node tools/invite.js batch guests.txt
```

Preview a link locally by running `node tools/serve.js` and creating the link with `--base="http://localhost:8080/?startapp="`.

## How the guest link works

The token is `base64url(signature || encrypted name)`.

- **Signature (the real protection):** ECDSA P-256 over the name, made with `keys/private.pem`. The page checks it with the public key, so nobody can make a link that shows a name you did not sign.
- **Encryption (only hides the name from a casual look):** AES-CTR, with a key derived from the public key.

Any invalid, edited or missing token shows the generic "Дорогие гости" greeting.

### Limits

- Anyone with a link can read that guest's name, because the page has to decrypt it without a server. Keeping it fully secret would need a backend.
- The token personalises the page but does not restrict access. Anyone who finds the page URL can see the date and venue.
- Keep `keys/private.pem` safe. If it is lost or replaced, run `keygen` again, redeploy `site/` and resend every link, because old links fall back to the generic greeting.
