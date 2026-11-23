// The standard pictures of the login page, for families that have not uploaded
// a photo of their own: illustrations of family moments in Kaydo's colours.
// Each motif comes as a portrait for the left half of a desktop and a banner
// of about 2:1 for a phone. LoginPage picks one per visit and LoginArt shows it.
//
// Stock photos of real families stood here briefly. Next to the cream page
// they read as somebody else's album, which is the wrong welcome on a page
// that greets a family by name.
export const LOGIN_ART_MOTIFS = [
  {
    id: 'momente',
    desktop: { src: '/login-art/momente-desktop.webp', width: 1122, height: 1402 },
    mobile: { src: '/login-art/momente-mobile.webp', width: 1751, height: 898 },
  },
  {
    id: 'post-fuer-dich',
    desktop: { src: '/login-art/post-fuer-dich-desktop.webp', width: 1080, height: 1350 },
    mobile: { src: '/login-art/post-fuer-dich-mobile.webp', width: 1170, height: 585 },
  },
]

export function pickLoginArt(random = Math.random) {
  return LOGIN_ART_MOTIFS[Math.floor(random() * LOGIN_ART_MOTIFS.length) % LOGIN_ART_MOTIFS.length]
}
