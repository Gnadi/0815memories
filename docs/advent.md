# The advent calendar

From 1 to 24 December, `/advent` has a door for every day, and each day one
more of them can be opened. Behind each is a memory or a moment from the
family's past: a photo, its words, and the way to the entry itself. From
24 November to 6 January the home page shows a card for it — a countdown,
today's door, or, after Christmas, all of them.

## Which entry is behind which door

`utils/advent.js` decides, on the device, from the entries dated before
1 December (`services/advent.js` reads them):

1. Every door first gets an entry from its own day in an earlier year — the
   6th a 6 December — photos before text. It says so: *3 years ago today*.
2. Christmas Eve, if its own day had nothing, gets the featured memory.
3. Every other door gets the next entry in a shuffled order, photos first.

The shuffle is seeded with the family and the year, and the entries are
sorted before it, so every member's device comes to the same calendar —
and next year's is a different one. Nothing is written: there is no new
collection, no new rule, and nothing new to encrypt, and viewers, who
cannot write, see the same doors as admins. Entries from December itself
are not in the pool, so posting during Advent does not move the doors.
A family with fewer than 24 entries has doors with a greeting instead.

## What it reads

The newest 120 memories and moments before 1 December, and 1–24 December of
the five years before, at most 40 of each — so a door can find its own day in
a family that has posted far more than 120 since. All of it on the
`(familyId, date DESC)` index the feed uses. A past Advent that cannot be read
leaves the calendar without it, not without a calendar.

## What the device keeps

Which doors this device has opened, as day numbers per family and year in
`localStorage` (`kaydo_advent_opened`). Nothing of the family's; losing it
closes the doors again.
