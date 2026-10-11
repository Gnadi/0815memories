/**
 * Faces and smiles, found in the browser with MediaPipe's face landmarker.
 *
 * Only ever loaded with a dynamic import (utils/photoAnalysis.js), when a
 * best-of is being put together — once a month, on one device. It is heavy:
 * the WebAssembly runtime is ~12 MB (~3.5 MB compressed) and the model ~3.7 MB.
 * Both are cached by the browser after the first time.
 *
 * Both are served from our own origin. The runtime is bundled from the npm
 * package rather than taken from a CDN: its loader is a script that runs in
 * the page, next to the family key, and that is no place for code fetched from
 * a third party. The model is in src/assets/models/, as published by Google
 * (mediapipe-models/face_landmarker/float16/1, Apache 2.0), so making a
 * best-of asks no one outside Kaydo for anything — the demo, which must not
 * reach outside the tab, included.
 *
 * Nothing about a photo leaves the device. The photo is decrypted here, looked
 * at here, and what is kept is two numbers: how many faces, how wide the
 * widest smile.
 */
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import modelAssetPath from '../assets/models/face_landmarker.task?url'
import { summariseFaces } from './photoAnalysis'

// Enough for a family around a table; more faces than this is a crowd, and a
// crowd is not what the group-photo award is for.
const MAX_FACES = 8

// The runtime writes its own log to the console, and not quietly: "INFO:
// Created TensorFlow Lite XNNPACK delegate for CPU." arrives as an error, among
// glog lines ("W1011 08:26:54…") as warnings. None of it is a problem, and the
// app keeps the console to real ones. Errors of its own (E…) still get through.
const RUNTIME_LOG = /^(INFO: |[IW]\d{4} )/

async function quietly(run) {
  const levels = ['log', 'info', 'warn', 'error']
  const original = Object.fromEntries(levels.map((level) => [level, console[level]]))
  for (const level of levels) {
    console[level] = (...args) => {
      if (typeof args[0] === 'string' && RUNTIME_LOG.test(args[0])) return
      original[level](...args)
    }
  }
  try {
    return await run()
  } finally {
    Object.assign(console, original)
  }
}

let landmarkerPromise = null

function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = quietly(() => FaceLandmarker.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      {
        // The CPU, not the GPU: slower by a little, and it works everywhere.
        // The GPU path needs WebGL2 and fails on enough phones that a monthly
        // job should not depend on it.
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: MAX_FACES,
        outputFaceBlendshapes: true,
      },
    )).catch((err) => {
      // Let a later best-of try again rather than keep a failure for the session.
      landmarkerPromise = null
      throw err
    })
  }
  return landmarkerPromise
}

/**
 * A detector: `detect(canvas)` → { faces, smile }. Rejects when the runtime or
 * the model cannot be loaded — offline, an old browser without WebAssembly
 * SIMD — and the best-of is then made without the awards that need faces.
 */
export async function createFaceDetector() {
  const landmarker = await loadLandmarker()
  // The first photo runs the graph for the first time, which logs too: run it
  // here, on a blank canvas. Should that fail, the photos will say so for real.
  await quietly(async () => landmarker.detect(document.createElement('canvas'))).catch(() => {})
  return {
    detect(canvas) {
      return summariseFaces(landmarker.detect(canvas))
    },
  }
}
