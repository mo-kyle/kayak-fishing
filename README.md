# 🛶 Kayak Fishing Planner: Cape Town

A 7-day planner for kayak fishing around Cape Town (18 spots):

- **West Coast:** Langebaan (lagoon), Yzerfontein, Melkbosstrand, Bloubergstrand. Koeberg is off-limits.
- **Atlantic Seaboard:** Sea Point, Bakoven, Hout Bay, Kommetjie
- **False Bay:** Muizenberg, Kalk Bay, Fish Hoek, Simon's Town (the SA Navy harbour is off-limits), Miller's Point,
  Cape Point (Buffels Bay, gate hours), Gordon's Bay, Rooi-Els, Pringle Bay
- **Walker Bay:** Hermanus

For each spot and day it shows:

- Wind, gusts and whether the wind is **offshore** (the main kayak danger)
- Waves, swell and a **choppiness index** (0–10, from wind-wave steepness + wind)
- Sea temperature, air temperature, rain, fog, current
- Estimated tides, moon phase and pressure trend
- **Which fish are around** that month, ranked by season and today's water temperature, with methods and closed seasons
- A **"When can you go?" filter**: pick the dates and hours you're free, and scores and best windows only use that time.
  The filter is saved in the link (e.g. `?from=2026-11-12&to=2026-11-15&start=6&end=10`), so a shared link opens with the same dates and hours.
- The **best 3-hour window** to be on the water, and a Go / Good / Marginal / Stay-on-land verdict

## Run it

No build step and no API keys. Any static web server works:

```bash
cd "/Users/kyleross/Kayak Fishing" && python3 -m http.server 8765
```

Then open http://localhost:8765.

## How the score works

- **Kayak score (60%)**: wind, gusts, wave height, chop, offshore wind, rain, thunder and fog, scored hour by hour.
  It takes the best 3-hour daylight window and also checks the 2 hours after it, since you have to paddle back.
- **Fishing score (40%)**: species in season × water-temperature fit, tide change during the window,
  moon (new/full = stronger tides), pressure trend, and sudden water-temperature drops (upwelling).

## Customise

All spots, launch sites, local notes and fish seasons live in [`js/spots.js`](js/spots.js).
To change the False Bay launch, for example to Kalk Bay or Muizenberg, edit `lat/lon`, `marineLat/marineLon` and
`facing` (the compass bearing from the shore out to sea, used to detect offshore wind).

## Open-source pieces

- [Open-Meteo](https://open-meteo.com/): weather and marine forecasts (free, CC BY 4.0)
- [Chart.js](https://www.chartjs.org/): hourly chart
- [SunCalc](https://github.com/mourner/suncalc): moon phase
- [Leaflet](https://leafletjs.com/) + OpenStreetMap: spot map

⚠️ Forecasts are model data and tide times are estimates. Always look at the water yourself, wear a PFD,
carry a valid DFFE recreational angling permit and respect MPA no-take zones.
