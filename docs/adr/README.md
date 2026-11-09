# Architecture decision records

Open decisions about Kaydo's structure, one file each. A record states what is
true in the code today (every claim points at a file), the options, a
recommendation and what it costs. None of them is decided yet: the status line
says so, and changes when the maintainer picks an option.

| Record | Question | Status |
| --- | --- | --- |
| [0001](0001-encryption-contract.md) | Which fields of which document are encrypted, and how does the key change? | proposed |
| [0002](0002-scrapbook-pages.md) | How is a scrapbook stored so that two devices cannot overwrite each other? | proposed |
| [0003](0003-bounded-queries.md) | Which lists grow with a family's history, and how are they bounded? | proposed |
| [0004](0004-release-and-recovery.md) | How do rules, functions and the app ship together, and how is a family's data restored? | proposed |
