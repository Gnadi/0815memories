import { useTranslation } from 'react-i18next'
import { BottomShade, SlideImage } from './BestOfSlides'
import KineticText from './KineticText'
import { montageBeatsPerPhoto, titleOf } from './bestOfLooks'

/**
 * Photos in quick cuts, one every beat or two of the music, each punching in
 * as it lands: the run of a recap video, where the story otherwise lingers.
 * A day's album may be told this way (utils/bestOfStyle.js, `montage`), and
 * so is the last look at what did not make it (`kind: 'montage'`).
 *
 * The cuts are CSS animations with their delays worked out from the beat, so
 * holding the story holds them too. Every photo waits unseen until its cut and
 * then stays, under the ones after it: the last one is what the slide ends
 * on.
 */
export function Montage({ photos, beatMs, onReady }) {
  const shotMs = montageBeatsPerPhoto(beatMs) * (beatMs || 600)
  // Isolated, so that the shots' stacking stays beneath what the slide lays
  // over them.
  return (
    <div className="absolute inset-0 isolate">
      {photos.map((media, i) => (
        <div
          key={i}
          data-testid="bestof-shot"
          className="bestof-shot absolute inset-0 overflow-hidden"
          style={{ animationDelay: `${i * shotMs}ms`, animationDuration: `${shotMs}ms`, zIndex: i }}
        >
          <SlideImage media={media} onReady={i === 0 ? onReady : undefined} />
        </div>
      ))}
    </div>
  )
}

/** The last look at the month: "and don't forget about…", in quick cuts. */
export function MontageSlide({ slide, labels, look, beatMs, onReady }) {
  const { t } = useTranslation('bestOf')
  const photos = (slide.media || []).filter(Boolean)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <Montage photos={photos} beatMs={beatMs} onReady={onReady} />
      <div className="absolute inset-0 pointer-events-none">
        <BottomShade />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-12 text-white">
          <KineticText text={t('dontForget')} look={look} className="text-lg text-white/90 drop-shadow" />
          <KineticText
            text={labels.title}
            look={look}
            delay={0.5}
            className={`mt-1 text-4xl leading-tight drop-shadow-lg ${titleOf(look, 'font-semibold')}`}
          />
        </div>
      </div>
    </div>
  )
}
