# Load the Earprint extension locally for testing

Two ways. Pick whichever is faster — both load the **exact same build**.

## Option A — unpacked `dist/` folder (recommended for dev)

Edit-build-reload loop without re-zipping.

1. Open Chrome → `chrome://extensions/`
2. Top-right toggle: **Developer mode** → on
3. Top-left: **Load unpacked**
4. Pick **`apps/extension/dist`** (the folder, not the zip)
5. The Earprint icon appears in the toolbar.

To pick up source changes:

```bash
cd apps/extension
pnpm run build       # ~80ms
```

then click the **↻ reload** button on the extension card in `chrome://extensions/`.

## Option B — drag-and-drop zip (matches what's uploaded to Web Store)

Identical contents to Option A, just packaged.

1. Open Chrome → `chrome://extensions/`
2. Top-right toggle: **Developer mode** → on
3. Drag **`apps/extension/earprint-extension-v0.11.1.zip`** onto the page
4. Confirm "Add extension".

If Chrome rejects with "manifest invalid", unzip first and use Option A on the unpacked folder. (Some Chrome versions are picky about how the zip was created.)

## Pairing the extension to your local web app

The extension is built with `VITE_WEB_ORIGIN=https://earprint.kwanho.dev` baked in by default. To point a local install at `localhost:3000`:

```bash
cd apps/extension
VITE_WEB_ORIGIN=http://localhost:3000 pnpm run build
```

Then reload the unpacked extension. The first time you visit `http://localhost:3000/connect`, the extension's content script captures the sync token and stores it locally.

## What to test in a smoke run

1. Pop the extension on `chrome://extensions/` and confirm v0.11.1 in the popup footer.
2. Visit `music.youtube.com/playlist?list=LM` and sign in to your own YouTube Music.
3. Open the extension popup — Sync button should be enabled (Connect step shows as done).
4. Click **Sync liked songs**. The popup should show live progress:
   `Scrolling · N songs · updated 1s ago`
5. While syncing, the **Stop now (save what we've got)** button appears below Sync. Try clicking it mid-scrape — should bail cleanly + upload the partial set + show `manualStop=true` in the network payload.
6. Let one full sync complete; the result message should read e.g.
   `✓ Sent 1,417 songs · 12 new`
7. Open `/connect` on the web — the **Last sync** badge should show the captured count + a freshness timestamp.
8. Open `/library` — the new **ShareButton** (when an analysis exists) should fire the OS share sheet on mobile and copy-to-clipboard on desktop.

## What to test on the audit fixes

- **Share id length**: rotate an existing profile or generate a new one → check `/api/profile` response; the persisted `share_id` in `taste_profiles` should be 16 hex characters.
- **Region failover**: if you have a Gemini-region-blocked test environment, the analysis should still complete via the fallback model (`gemini-2.0-flash-lite`) rather than 500.
- **Forgotten worldcup**: on a library without `list_position` data, opening `/worldcup/forgotten/16` should NOT show an empty card — it should fall back to a uniform-random sample and the bracket should populate.
- **Credit refund**: deliberately trigger a Gemini error (e.g., disable your API key briefly) and verify the analysis credit is refunded — the `credits` column on the user row should be unchanged after the failed call.

## Troubleshooting

- **"This extension may have been corrupted"** — clear the unpacked extension and run `pnpm run build` from a clean state (`rm -rf dist && pnpm run build`).
- **Sync button stays disabled** — visit `/connect` once after install so the content script can capture the token.
- **"Sync token rejected (401)"** — your local backend doesn't have the user row that owns this token. Re-sign-in on `/connect` to get a fresh token.
