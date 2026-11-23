/**
 * A standard login picture, one motif of loginArtFiles.js, filling its
 * positioned parent. `phoneOnly` always shows the banner, for a phone-sized
 * frame on a desktop screen (the login designer's preview).
 *
 * Whether there is room for it on a phone is the login page's to decide.
 *
 * The picture shows nobody in particular and says nothing the page does not,
 * so it is decorative (empty alt).
 */
export default function LoginArt({ motif, phoneOnly = false }) {
  const { desktop, mobile } = motif
  return (
    <picture className="absolute inset-0">
      {!phoneOnly && (
        <source media="(min-width: 1024px)" srcSet={desktop.src} width={desktop.width} height={desktop.height} />
      )}
      {/* A wide desktop card crops the portrait. Taken from 30% down, the
          faces at the top stay; what goes is mostly the plain green band at
          the bottom. */}
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
