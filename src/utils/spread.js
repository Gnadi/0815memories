// Spread helpers for the scrapbook editor's open-book (two-page) view.
//
// Convention: cover-first.
//   spread 0            → [ page 0 , — ]        (cover alone)
//   spread 1            → [ page 1 , page 2 ]
//   spread 2            → [ page 3 , page 4 ]
//   spread k ≥ 1        → [ page 2k-1 , page 2k ]
//
// If the last page has no partner, right is null (blank facing page).

export function leftPageForSpread(spreadIdx) {
  if (spreadIdx <= 0) return 0
  return 2 * spreadIdx - 1
}

export function spreadBounds(totalPages, spreadIdx) {
  if (totalPages <= 0) return { left: null, right: null }
  if (spreadIdx === 0) return { left: 0, right: null }
  const left = 2 * spreadIdx - 1
  const right = left + 1
  return {
    left: left < totalPages ? left : null,
    right: right < totalPages ? right : null,
  }
}

export function totalSpreads(totalPages) {
  if (totalPages <= 1) return 1
  return 1 + Math.ceil((totalPages - 1) / 2)
}

export function spreadForPageIndex(pageIdx) {
  if (pageIdx <= 0) return 0
  return Math.floor((pageIdx + 1) / 2)
}

export function sideForPageIndex(pageIdx) {
  if (pageIdx === 0) return 'left'
  // spread k ≥ 1: left = 2k-1 (odd), right = 2k (even)
  return pageIdx % 2 === 1 ? 'left' : 'right'
}
