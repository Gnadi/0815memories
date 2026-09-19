import { useTranslation } from 'react-i18next'
import { ADDRESS_FIELDS } from '../../utils/printAddress'

/**
 * Where the book goes.
 *
 * Deliberately plain: this is the one form in Kaydo whose mistakes arrive by
 * post three weeks later, so it asks for everything at once and marks what is
 * required rather than being clever about progressive disclosure.
 *
 * The address is encrypted before it is written to Firestore, like every other
 * piece of family content. It does travel to the print network in the clear,
 * because somebody has to put it on a parcel.
 */

export default function PrintAddressForm({ address, onChange, errors = {}, disabled }) {
  const { t } = useTranslation('scrapbook')

  const update = (key, value, uppercase) => {
    onChange({ ...address, [key]: uppercase ? value.toUpperCase() : value })
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {ADDRESS_FIELDS.map((field) => (
        <div key={field.key} className={field.span === 2 ? 'col-span-2' : 'col-span-1'}>
          <label htmlFor={`addr-${field.key}`} className="block text-[11px] font-semibold text-bark-muted mb-1">
            {t(`print.address.${field.key}`)}
            {field.required && <span className="text-kaydo"> *</span>}
          </label>
          <input
            id={`addr-${field.key}`}
            type={field.type || 'text'}
            value={address?.[field.key] || ''}
            onChange={(e) => update(field.key, e.target.value, field.uppercase)}
            disabled={disabled}
            maxLength={field.maxLength}
            autoComplete={field.autoComplete}
            className={`w-full rounded-lg px-2.5 py-1.5 text-sm text-bark bg-cream border outline-none disabled:opacity-50 ${
              errors[field.key] ? 'border-red-400' : 'border-cream-dark focus:border-kaydo'
            }`}
          />
          {errors[field.key] && (
            <p className="text-[11px] text-red-600 mt-0.5">{t(`print.address.errors.${errors[field.key]}`)}</p>
          )}
        </div>
      ))}
    </div>
  )
}
