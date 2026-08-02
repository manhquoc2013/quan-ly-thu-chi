# Google Drive Sync — Design

**Date:** 2026-08-02  
**Status:** Approved for implementation

## Goal

Replace Settings Drive stub with real OAuth + backup/restore of app data to the user's Google Drive.

## Auth

- Google Identity Services token client (browser only).
- Env: `VITE_GOOGLE_CLIENT_ID` (public). **Never** ship `client_secret` in the SPA.
- Scopes: `drive.file`, `userinfo.email`, `userinfo.profile`.
- Token stored in IndexedDB (`google_drive_token`); revoke on disconnect.

## Data sync

App data lives in IndexedDB cache keys (not sql.js). Sync file:

- Path: Drive folder `QuanLyThuChi/app-data.json`
- Payload: `{ version, exportedAt, expenses, revenues, customers, products, orderPlatforms }`
- Strategy: last-write-wins by `exportedAt` vs remote `modifiedTime` / embedded `exportedAt`.

## UI

- Settings: Connect / Disconnect / Sync now; show email when connected.
- Toast errors if Client ID missing or OAuth denied.

## Deploy

- GitHub Actions secret `VITE_GOOGLE_CLIENT_ID` injected at build.
- GCP: Authorized JavaScript origins must include `http://localhost:5173` and `https://manhquoc2013.github.io`.
