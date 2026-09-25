import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Loader2 } from 'lucide-react'
import { loadPlaces, searchPlaces, makeBirthPlace, countryName } from '../../utils/sky/skyData'
import { devError } from '../../utils/devLog'

/**
 * Picks a birthplace from the bundled place list, or from coordinates typed in
 * by hand for villages the list doesn't know. Nothing typed here leaves the
 * browser — there is no geocoding service behind it.
 */
export default function PlacePicker({ value, onChange }) {
  const { t, i18n } = useTranslation('sky')
  const lang = i18n.language?.startsWith('de') ? 'de' : 'en'
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [manual, setManual] = useState(false)
  const [coords, setCoords] = useState({ lat: '', lon: '', name: '' })
  const requested = useRef(false)

  const ensurePlaces = () => {
    if (requested.current) return
    requested.current = true
    setLoading(true)
    loadPlaces()
      .then(setPlaces)
      .catch((err) => {
        devError('Failed to load places', err)
        setError(true)
        requested.current = false
      })
      .finally(() => setLoading(false))
  }

  const results = useMemo(() => (places ? searchPlaces(places, query) : []), [places, query])

  const pick = (place) => {
    onChange(makeBirthPlace(place))
    setQuery('')
  }

  const submitCoords = (e) => {
    e.preventDefault()
    const lat = Number(coords.lat)
    const lon = Number(coords.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return
    pick({ name: coords.name.trim() || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon })
    setManual(false)
  }

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2 px-3 py-2 bg-cream rounded-xl text-sm text-bark">
          <MapPin className="w-4 h-4 text-kaydo flex-shrink-0" />
          <span className="truncate">
            {value.name}
            {value.country ? `, ${countryName(value.country, lang)}` : ''}
          </span>
        </div>
      )}

      {!manual ? (
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              ensurePlaces()
            }}
            onFocus={ensurePlaces}
            placeholder={value ? t('place.change') : t('place.placeholder')}
            className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30"
            aria-label={t('place.label')}
          />
          {loading && query.length >= 2 && (
            <Loader2 className="w-4 h-4 animate-spin text-bark-muted absolute right-3 top-2.5" />
          )}
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-warm-white border border-cream-dark rounded-xl shadow-lg overflow-hidden">
              {results.map((p) => (
                <li key={`${p.name}-${p.lat}-${p.lon}`}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full text-left px-3 py-2 text-sm text-bark hover:bg-cream"
                  >
                    {p.name}
                    <span className="text-bark-muted">, {countryName(p.country, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {places && query.length >= 2 && results.length === 0 && (
            <p className="text-xs text-bark-muted mt-1">{t('place.noResults')}</p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{t('place.loadError')}</p>}
        </div>
      ) : (
        <form onSubmit={submitCoords} className="space-y-2">
          <input
            type="text"
            value={coords.name}
            onChange={(e) => setCoords((c) => ({ ...c, name: e.target.value }))}
            placeholder={t('place.manualName')}
            className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={coords.lat}
              onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))}
              placeholder={t('place.latitude')}
              className="w-1/2 px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30"
              required
            />
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={coords.lon}
              onChange={(e) => setCoords((c) => ({ ...c, lon: e.target.value }))}
              placeholder={t('place.longitude')}
              className="w-1/2 px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30"
              required
            />
          </div>
          <button type="submit" className="btn-kaydo w-full text-sm">{t('place.useCoordinates')}</button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setManual((m) => !m)}
        className="text-xs text-bark-muted underline underline-offset-2 hover:text-bark"
      >
        {manual ? t('place.searchInstead') : t('place.enterCoordinates')}
      </button>
    </div>
  )
}
