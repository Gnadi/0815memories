# VR memories — step back into the moment

Capture a moment so it can be *re-lived*, not just looked at: put on a headset
(or hold up a phone) and stand in grandma's kitchen again, on the beach of the
first family holiday, in the room on the day the baby came home.

> **Status:** plan. Nothing is built yet. This is the biggest and most
> uncertain of the four ideas, so the plan starts with an honest analysis and
> ships in small, useful steps.

## Analysis

### What "capture for VR" can actually mean

"VR memory" covers five very different kinds of media. They differ in how
immersive they are, how hard they are to capture and how big the files get:

| Kind | Feels like | Captured with | Typical size | Browser playback |
| --- | --- | --- | --- | --- |
| **360° photo** | standing in the spot, looking around | 360 camera (Insta360, Ricoh Theta), phone panorama apps | 3–15 MB | easy (equirectangular sphere) |
| **360° video** | same, with motion and sound | 360 camera | 100 MB–GBs | ok at low bitrates |
| **Spatial photo / video** (stereo 3D) | depth, as if the scene is in front of you | iPhone 15 Pro and later, Vision Pro, some Android phones | 20–200 MB/min | limited: MV-HEVC must usually be converted to side-by-side |
| **3D scene** (Gaussian splat / photogrammetry) | walking *inside* the room, a few steps each way | phone scanning apps (Scaniverse, Polycam, Luma) → `.ply` / `.splat` / `.spz` | 5–100 MB (`.spz`) | good with a WebGL splat renderer |
| **Depth from an ordinary photo** (2.5D) | an old flat photo gains gentle depth and parallax | nothing new: runs on photos already in Kaydo | +1 small depth map | good |

**The key insight:** Kaydo shouldn't try to *be* the capture app. Phones and 360
cameras already capture well, and 3D reconstruction needs heavy compute. Doing
it on a server would mean sending unencrypted photos there, which breaks
Kaydo's core promise. Kaydo's job is to be:

1. the **encrypted home** for immersive captures (nobody else offers private,
   family-owned storage for them), and
2. the **place to re-live them**, with the story, voice memo and date wrapped
   around the scene, and
3. the one thing only Kaydo can do: **turn the family's old, flat photos into
   something you can step into** (depth from a single photo, computed on the
   device).

Point 3 is what makes this more than a 360 viewer. Nobody has a 360 camera
from 1985, but everyone has the photos.

### Hard constraints in the current code

- **Upload cap.** Encrypted media is stored as a Cloudinary *raw* resource,
  capped at 10 MB on the free plan (`src/constants/media.js`,
  `MAX_PLAINTEXT_BYTES`). Splats, spatial video and 360 video blow past that.
  **Chunked encrypted upload** is a prerequisite: split the file, encrypt each
  chunk on its own (AES-GCM, own IV, chunk index in the additional data so
  chunks can't be reordered), upload each as its own raw resource, and store a
  manifest. That also allows streaming decryption instead of holding 100 MB
  plus its ciphertext in memory at once. That matters on a Quest, which has far
  less RAM than a desktop.
- **Storage cost.** Immersive media is 10–100× larger than a photo. Needs a
  per-family quota and a clear size display before upload, in the same spirit as
  the existing "your clip is 24 MB, the limit is 10 MB" message.
- **Bundle size.** three.js plus a splat renderer is ~700 KB+ gz. It must be a
  lazily loaded route chunk *and* excluded from the service-worker precache
  (`vite.config.js` uses `injectManifest` with default globs, so every JS chunk
  is precached today). Otherwise every family member downloads the VR engine on
  install.
- **Headers.** `vercel.json` sets
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`. WebXR
  (`xr-spatial-tracking`) and the motion sensors aren't listed, so they stay
  allowed for the page itself. Any in-app camera capture would need `camera`
  opened up to `self`.

### Devices (verify at implementation time; this moves fast)

- **Meta Quest browser:** WebXR `immersive-vr` supported: the main headset target.
- **Apple Vision Pro Safari:** WebXR available in recent visionOS versions;
  spatial photos/video have native-first support. Test on a real device.
- **Phones without a headset:** "magic window": move the phone to look around,
  using `DeviceOrientationEvent` (iOS needs a permission tap). This is how most
  families will actually use it, so it gets first-class treatment, not a
  fallback feel.
- **Desktop:** drag to look, scroll to zoom.

### Wellbeing

- No forced camera movement. Only the user moves (or teleports), to avoid
  motion sickness.
- Short sessions by design: a memory is a place you visit, not a game.
- Be mindful that re-living rooms of people who have died can be very
  emotional. Enter with a gentle fade and a title card, and "exit" is always
  one gesture away.
- Headset makers recommend minimum ages (e.g. 10+ for Quest). Kids use the
  phone mode.

## Experience

**In the feed / memory detail:** an immersive memory shows a small "Step in"
badge. Tapping it opens the viewer:

1. Fade in from the memory's cover photo to the scene, with the title card
   (reuses the look of highlight reels, `src/components/highlight/ReelPlayer.jsx`).
2. The scene: a 360 sphere, a stereo pair or a splat room.
3. **Story hotspots:** small glowing points pinned in the scene, each with a
   voice memo, photo or line of text ("this is where the Christmas tree always
   stood"). Kaydo already has voice memos (`VoiceMemoRecorder`), and here they
   are placed in space.
4. **Ambient sound:** an optional looped audio track (the sea, the kitchen
   radio), played as positional audio.
5. On a headset: "Enter VR" button → WebXR session with the same scene.

**Creating:** "New memory → Immersive" accepts a 360 photo/video, a stereo or
spatial file, or a splat export. Kaydo detects the kind from the file
(equirectangular 2:1 aspect ratio, XMP `ProjectionType`, `.ply`/`.spz`
extension). An in-app guide explains how to capture each kind with the phone
the user already has.

**"Step into an old photo"** (depth mode): pick any existing photo → a depth
model runs in the browser (e.g. Depth Anything V2 small via transformers.js /
onnxruntime-web, WebGPU when available, WASM fallback) → the photo is
displaced into a gentle 3D relief with in-painted edges → view with parallax
on a phone or in stereo on a headset. The model (~25–100 MB) is downloaded
once, on request, and cached. The photo never leaves the device.

## Data model

```
memories/{id}
  + immersive: {
      kind: 'pano-photo' | 'pano-video' | 'stereo-photo' | 'stereo-video' | 'splat' | 'depth-photo'
      layout: 'mono' | 'sbs' | 'tb'           // stereo layout
      manifestUrl  (encrypted)                 // → chunk list, see below
      initialYaw, initialPitch
      hotspots: [{ yaw, pitch, dist?, kind, ref }]   (encrypted as one JSON blob)
      ambientAudioUrl (encrypted)?
      sizeBytes
    }

manifest (encrypted JSON, stored as a raw resource)
  { chunkSize, total, sha256, chunks: [url, …], mime }
```

Keeping it on the memory (instead of a new collection) means feed, timeline,
"on this day", NAS export and access rules all work unchanged.

## Implementation phases

| Phase | Scope | Size |
| --- | --- | --- |
| 0 | **Chunked encrypted upload + streaming decrypt** (`encryptedUpload.js`, `decryptPool`), with tests. Useful beyond VR: it also lifts the 10 MB limit on normal videos. Per-family storage quota display. | M |
| 1 | **360 photos:** upload + detection, lazy three.js viewer with drag / magic window / WebXR, "Step in" badge, NAS export includes the original file | M |
| 2 | **Story hotspots + ambient audio** in the viewer, simple placement editor (look at a spot → "pin here") | M |
| 3 | **Depth from old photos:** in-browser depth model, relief mesh, stereo rendering | L |
| 4 | **3D scenes (splats):** `.spz`/`.ply` import, splat renderer, teleport navigation | M–L |
| 5 | **360 / stereo / spatial video:** chunked playback via MediaSource, conversion guide for MV-HEVC | L |

**Recommended first milestone:** phases 0 + 1 + 2. That ships something complete
and emotional (stand in the spot, hear the story where it happened) with the
least uncertainty, and phase 0 pays off for the whole app.

## Open questions

1. Which headset does the family (or target customer) actually own? That
   decides whether phase 4 or 5 comes first.
2. Is a paid storage tier needed before immersive media ships? A handful of
   splat rooms can use more storage than all of a family's photos.
3. Should the depth model download be offered to viewers too, or only admins
   (it's a large download on mobile data)?
4. Offline headsets: should a family be able to "pin" an immersive memory for
   offline viewing? That would mean storing it decrypted in the cache, which
   Kaydo avoids today. Recommendation: no, or only encrypted with in-memory
   decryption.
