import { LOGIN_ART } from './loginArtFiles'

/**
 * The standard login picture (loginArtFiles.js), filling its positioned
 * parent. `phoneOnly` always shows the banner, for a phone-sized frame on a desktop
 * screen (the login designer's preview).
 *
 * On a short phone (an iPhone SE) the picture area shrinks to a strip, so
 * there the picture steps aside and leaves the space empty. A container query
 * on the picture area would say it better, but Chrome measured that flex item
 * before it grew and hid the picture on every phone; the screen's height
 * decides instead.
 *
 * The picture shows nobody in particular and says nothing the page does not,
 * so it is decorative (empty alt).
 */
export default function LoginArt({ phoneOnly = false }) {
  const { desktop, mobile } = LOGIN_ART
  return (
    <picture className={`absolute inset-0 ${phoneOnly ? '' : 'max-lg:[@media(max-height:620px)]:hidden'}`}>
      {!phoneOnly && (
        <source media="(min-width: 1024px)" srcSet={desktop.src} width={desktop.width} height={desktop.height} />
      )}
      {/* A wide desktop panel crops the portrait. Taken from 30% down, the
          faces at the top stay; what goes is mostly the green band at the
          bottom, which the page's own green gradient stands in for. */}
      <img
        src={mobile.src}
        width={mobile.width}
        height={mobile.height}
        alt=""
        fetchPriority="high"
        className={`w-full h-full object-cover ${phoneOnly ? '' : 'lg:object-[center_30%]'}`}
      />
    </picture>
  )
}
