# GaitGuard Frontend

React Native (Expo) app for GaitGuard. The athlete selects a movement, records or uploads a short video, and the app sends it to the backend for pose analysis.

## Requirements

- Node.js (LTS)
- Expo Go app on your phone (SDK 57)
- Backend running on the laptop (see `../backend/README.md`)

## Setup

```bash
cd frontend
npm install
```

## Configure the backend address

Open `src/constants/config.ts` and set your laptop's IP address:

```ts
export const API_URL = 'http://<laptop-ip>:8000';
```

To find the IP, run `ipconfig` and copy the **IPv4 Address** of the Wi-Fi adapter.
The IP changes when the network changes, so update this file each time.

## Run

```bash
npx expo start -c
```

Scan the QR code with Expo Go.

> Phone and laptop must be on the **same network**. College/hostel Wi-Fi blocks
> device-to-device traffic, so use a **phone hotspot** and connect the laptop to it.

## App flow

1. Home → Start Screening
2. Select a movement
3. Record a video (max 15 s) or upload one from the gallery
4. Preview the video
5. Analyze → the video is sent to `POST /analyze` and the result is shown

## Folder structure

```
src/
  app/                 screens (Expo Router)
    _layout.tsx        navigation stack
    index.tsx          home
    select-movement.tsx
    capture.tsx        record / upload choice + filming guide
    record.tsx         camera recording (1080p, back camera)
    preview.tsx        video playback
    result.tsx         analysis result
  constants/
    config.ts          backend URL
    movements.ts       movement list and filming instructions
    theme.ts           colors and shared styles
  services/
    analysis.ts        uploads the video to the backend
    videoStore.ts      holds the selected video URI between screens
```

## Notes

- The video upload uses `XMLHttpRequest` with multipart form data (field `file`, optional `movement`). The `Content-Type` header is not set manually.
- The video URI is kept in `videoStore.ts` instead of route params, because route params change the encoded file path and the video fails to load.
- Recording tips: side view, full body in frame, 2–3 m from the camera, good lighting.