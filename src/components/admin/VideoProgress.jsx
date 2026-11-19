import { useTranslation } from 'react-i18next'

// How far the re-encoding of a clip over the upload limit has got. Shown under
// the spinner of a clip's tile, because on a phone it can take as long as the
// clip itself, and a spinner alone looks stuck. `percent` is unset for the
// upload itself and for clips that needed no re-encoding.
export default function VideoProgress({ percent }) {
  const { t } = useTranslation('common')
  if (percent == null) return null
  return (
    <span
      role="status"
      title={t('upload.compressing', { percent })}
      aria-label={t('upload.compressing', { percent })}
      className="text-[10px] font-medium text-white tabular-nums leading-none"
    >
      {t('upload.compressPercent', { percent })}
    </span>
  )
}
