# Third-party notices

Kaydo itself is under the MIT license (`LICENSE`). This repository also
contains data and a font made by others, under their own licenses. They are
listed here, with the texts their licenses ask to be passed on.

The npm packages the app is built from are not in this repository; each one
carries its own license in `node_modules/<package>/`.

## Star and constellation data — d3-celestial

`public/sky/stars.json` and `public/sky/constellations.json` are derived from
the data of [d3-celestial](https://github.com/ofrohn/d3-celestial) 0.7.35 by
Olaf Frohn, by `scripts/build-sky-data.mjs`. BSD 3-Clause License:

```
Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Places — GeoNames

`public/sky/cities.json` is derived from [GeoNames](https://www.geonames.org/)
data, taken from the [all-the-cities](https://github.com/zeke/all-the-cities)
package 3.1.0, by `scripts/build-sky-data.mjs`. The GeoNames data is licensed
under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/).
The file keeps the name, country and coordinates of places with at least 5,000
inhabitants and drops everything else.

## Font — Anton

`public/fonts/anton-*.woff2` are subsets of Anton, designed by Vernon Adams,
Copyright 2020 The Anton Project Authors
(https://github.com/googlefonts/AntonFont). It is licensed under the SIL Open
Font License, Version 1.1; the full text is in `public/fonts/OFL.txt`, next to
the font files, so it is served with them.
