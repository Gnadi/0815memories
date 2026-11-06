/* The story circles above the feed.

   A moment with only a clip showed a camera icon: the clip is encrypted, so
   nothing could be taken from it to show. Clips uploaded since carry a poster,
   one frame of them, and the circle shows that instead. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }))
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ src }) => <img data-kind="circle" data-src={src} alt="" />,
}))
vi.mock('../components/bestof/BestOfCircle', () => ({ default: () => null }))

import DailyMoments from '../components/home/DailyMoments'

afterEach(cleanup)

const circles = () => Array.from(document.querySelectorAll('[data-kind="circle"]')).map((el) => el.dataset.src)
const clip = (extra = {}) => ({ url: 'https://cdn/clip.enc', publicId: 'c1', ...extra })

describe('a moment’s circle', () => {
  it('shows a clip’s poster, marked as a video', () => {
    const { container } = render(
      <DailyMoments moments={[{ id: 'a', date: new Date(), videos: [clip({ posterUrl: 'https://cdn/poster.enc' })] }]} />,
    )
    expect(circles()).toEqual(['https://cdn/poster.enc'])
    expect(container.querySelector('.bg-kaydo')).not.toBeNull()
  })

  it('still shows the first photo when there is one', () => {
    render(
      <DailyMoments
        moments={[{ id: 'a', date: new Date(), images: ['https://cdn/photo.enc'], videos: [clip({ posterUrl: 'https://cdn/poster.enc' })] }]}
      />,
    )
    expect(circles()).toEqual(['https://cdn/photo.enc'])
  })

  it('falls back to the icon for a clip uploaded before posters', () => {
    const { container } = render(<DailyMoments moments={[{ id: 'a', date: new Date(), videos: [clip()] }]} />)
    expect(circles()).toEqual([])
    expect(container.querySelector('.bg-bark\\/20')).not.toBeNull()
  })
})
