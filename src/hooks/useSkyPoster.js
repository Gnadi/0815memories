import { useEffect, useMemo, useRef, useState } from 'react'
import useSettledText from './useSettledText'
import { computeSky, zonedTimeToUtc, DEFAULT_NIGHT_TIME } from '../utils/sky/astronomy'
import { loadSkyCatalog } from '../utils/sky/skyData'
import { drawSkyPoster } from '../utils/sky/skyRenderer'
import { buildCaption } from '../utils/sky/caption'
import { devError } from '../utils/devLog'

// Sharp at the desktop size (up to ~700 CSS px) on a 2x display.
export const PREVIEW_WIDTH = 1400

/**
 * The sky poster of one birth: the star catalog, the sky over the place at
 * that moment, and the preview drawn into `canvasRef`. Shared by the birth sky
 * in a child's journal and the public page, which differ only in where the
 * birth details come from and what happens to them.
 *
 * `form` holds birthTime, birthPlace, skyStyle, title and dedication;
 * `dateStr` is the birthdate as 'YYYY-MM-DD'. Everything is computed in the
 * browser — no detail of the birth is sent anywhere to draw it.
 *
 * @returns {{ catalog: object|null, catalogError: boolean, sky: object|null,
 *   canvasRef: object, optionsFor: (title: string, dedication: string) => object|null }}
 */
export default function useSkyPoster({ form, dateStr, lang, t }) {
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    loadSkyCatalog()
      .then(setCatalog)
      .catch((err) => {
        devError('Failed to load sky catalog', err)
        setCatalogError(true)
      })
    // The poster title uses the self-hosted display font; draw once it is in.
    const fonts = document.fonts
    if (fonts?.load) {
      fonts.load("40px 'Anton'").finally(() => setFontsReady(true))
    } else {
      setFontsReady(true)
    }
  }, [])

  // Only place and time move the stars; the sky is not recomputed while the
  // title or dedication is typed.
  const place = form?.birthPlace
  const birthTime = form?.birthTime
  const sky = useMemo(() => {
    if (!catalog || !dateStr || !place) return null
    const date = zonedTimeToUtc(dateStr, birthTime || DEFAULT_NIGHT_TIME, place.tz)
    return computeSky({ date, lat: place.lat, lon: place.lon, ...catalog })
  }, [catalog, dateStr, place, birthTime])

  // The poster's options for a given title and dedication. The exports take
  // what is in the form; the preview takes the text once typing has paused.
  const optionsFor = (title, dedication) => {
    if (!form || !dateStr) return null
    return {
      sky,
      style: form.skyStyle,
      lang,
      compass: { n: t('compass.n'), e: t('compass.e'), s: t('compass.s'), w: t('compass.w') },
      planetNames: Object.fromEntries(
        ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map((b) => [b, t(`planets.${b}`)])
      ),
      caption: buildCaption({
        t,
        lang,
        title,
        dateStr,
        timeStr: form.birthTime,
        place: form.birthPlace,
        sky,
        dedication,
      }),
    }
  }

  // Drawing the preview takes 100–200 ms on a phone, and it ran for every key
  // typed into the title or dedication. Their text reaches the preview once
  // typing pauses; style, place and time still redraw at once.
  const previewTitle = useSettledText(form?.title)
  const previewDedication = useSettledText(form?.dedication)
  const previewKey = form && dateStr
    ? JSON.stringify([form.skyStyle, form.birthTime, form.birthPlace, previewTitle, previewDedication, dateStr, lang])
    : null

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const options = optionsFor(previewTitle, previewDedication)
    if (!ctx || !options || !fontsReady) return
    drawSkyPoster(ctx, { ...options, width: PREVIEW_WIDTH })
    // optionsFor reads the form; previewKey stands for every part of it the
    // preview shows, so the canvas is drawn when one changes and not otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, sky, t, fontsReady])

  return { catalog, catalogError, sky, canvasRef, optionsFor }
}
