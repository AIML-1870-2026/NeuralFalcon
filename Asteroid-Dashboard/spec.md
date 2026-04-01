# Asteroid & Impact Risk Dashboard — Specification

**Version:** 1.1.0
**Date:** 2026-03-31
**Status:** Production

---

## Overview

A single-page, multi-tab web dashboard that aggregates real-time near-Earth object (NEO) data from three NASA/JPL public APIs into a unified threat-monitoring interface. Includes an **Impact Crash Calculator** that estimates local effects of an asteroid strike given a user-supplied location, and a **rotatable 3D Earth globe** showing impact zones visually.

---

## Data Sources & APIs

### 1. NASA NeoWs — Near Earth Object Web Service
- **Base URL:** `https://api.nasa.gov/neo/rest/v1/`
- **Key Endpoint:** `GET /feed?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&api_key=DEMO_KEY`
- **Data Returned:** List of NEOs approaching Earth within a date window, including estimated diameter, close-approach distance, relative velocity, and hazard classification.
- **Auth:** `api_key` query param (NASA DEMO_KEY available without registration)
- **Rate Limits:** 30 req/hr (DEMO_KEY), 1,000 req/hr (registered key)

### 2. JPL Small-Body Database (SBDB)
- **Base URL:** `https://ssd-api.jpl.nasa.gov/sbdb.api`
- **Key Endpoint:** `GET ?sstr={name_or_id}&phys-par=true&close-approach=true`
- **Data Returned:** Orbital elements, physical parameters (diameter, albedo, rotation), taxonomy, discovery metadata, and close-approach history.
- **Auth:** None required
- **Rate Limits:** Unenforced; reasonable use expected

### 3. JPL Sentry Impact Monitoring
- **Base URL:** `https://ssd-api.jpl.nasa.gov/sentry.api`
- **Key Endpoints:**
  - `GET /` — Full table of all Sentry-monitored objects with cumulative impact probability and Palermo/Torino scales
  - `GET ?des={designation}` — Detailed impact solution table for a single object
- **Auth:** None required
- **Rate Limits:** Unenforced; reasonable use expected

---

## Tab Architecture

### Tab 1 — NeoWs Feed (Live Approaches)
**Purpose:** Browse upcoming NEO close approaches in a selectable date range.

**UI Elements:**
- Date range picker (default: today → +7 days)
- Summary stat cards: total NEOs, potentially hazardous count, closest approach, fastest object
- Sortable data table: Name | Diameter (est.) | Miss Distance | Velocity | Hazardous
- Inline sparkline showing miss distance trend across the week
- Clicking a row opens a side-panel with full NeoWs object detail

**Interactions:**
- Date range change triggers new API fetch
- Hazardous objects visually highlighted (amber/red accent)

---

### Tab 2 — SBDB Object Lookup
**Purpose:** Deep-dive into any specific small body by name or designation.

**UI Elements:**
- Search input with autocomplete suggestions (searched against SBDB)
- Object card showing: class, discovery date, diameter, albedo, rotation period
- Orbital elements table (a, e, i, Ω, ω, M)
- Close-approach timeline — past and future encounters visualized on a horizontal axis
- Taxonomy badge (S-type, C-type, etc.)
- External link to JPL Horizons for ephemeris

**Interactions:**
- Enter key or search button fires SBDB API call
- Results populate without page reload

---

### Tab 3 — Sentry Impact Monitor
**Purpose:** Display all objects with non-zero impact probability on Earth.

**UI Elements:**
- Impact probability table sorted by cumulative impact probability (descending): Object | Year Range | Potential Impacts | Palermo Scale | Torino Scale
- Palermo Scale gauge (visual indicator; < −2 = background, > 0 = alert)
- Torino Scale color map (0–10 color-coded cells)
- Clicking a row fetches detailed impact solution set from `sentry.api?des=`
- Detail modal: year-by-year impact probability breakdown, object orbit visualization placeholder

**Palermo Scale Legend:**
| Range | Meaning |
|-------|---------|
| < −2 | Below background level |
| −2 to 0 | Worthy of monitoring |
| > 0 | Warrants attention |

**Torino Scale Legend:**
| 0 | No hazard |
| 1–3 | Normal / meriting attention |
| 4–7 | Threatening |
| 8–10 | Certain collisions |

---

### Tab 4 — Crash Impact Calculator
**Purpose:** Estimate local ground effects if a known NEO (or custom asteroid) were to impact at a user-specified location.

> ⚠️ **Privacy:** No geolocation is collected automatically. All location input is manual text entry. No coordinates are stored or transmitted beyond the impact model calculation.

**Inputs:**
| Field | Type | Default |
|-------|------|---------|
| Location | Text (city, address, or lat/lon) | — |
| Asteroid diameter | Number (meters) | 100 |
| Impactor density | Select (porous rock / solid rock / iron) | Solid rock |
| Impact velocity | Number (km/s) | 17 |
| Impact angle | Slider (15°–90°) | 45° |
| Target rock type | Select (sedimentary / crystalline / wet soil) | Sedimentary |

**Outputs (displayed on a Leaflet map AND on the rotatable 3D Earth globe):**
| Zone | Description |
|------|-------------|
| Fireball radius | Area of thermal radiation / blindness risk |
| Airburst / crater radius | Structural destruction zone |
| Overpressure 20 psi ring | Reinforced concrete destruction |
| Overpressure 5 psi ring | Most buildings destroyed |
| Overpressure 1 psi ring | Window breakage limit |
| Seismic effect | Estimated Richter magnitude |
| Ejecta range | Debris fallout radius |

**Rotatable 3D Earth Globe:**
- Rendered using Three.js (CDN) with a NASA Blue Marble texture
- User can click-and-drag to rotate the globe freely
- Impact location is marked with a glowing red pin on the globe surface
- Impact zones are rendered as colored concentric rings on the globe surface
- Globe auto-rotates slowly when idle; stops on user interaction
- Toggle button to switch between 2D Leaflet map view and 3D globe view

**Calculation Model:**
Simplified scaling laws from Collins et al. (2005) *"Earth Impact Effects Program"* (Imperial College / Purdue):
- Crater diameter: `D_c = 1.16 * (ρ_i/ρ_t)^(1/3) * d^0.78 * v^0.44 * sin(θ)^(1/3)`
- Overpressure ring radii derived from TNT-equivalent energy: `E = 0.5 * ρ_i * V_i * v^2`
- Thermal radius: `r_t = (E / (4π * F_t))^0.5`

Full scientific accuracy is beyond scope; results are educational estimates.

**"Use a Sentry Object" quick-fill:** Populate the diameter and velocity fields from a Sentry-monitored object selected from a dropdown.

---

## Technical Architecture

### Stack
- **Runtime:** Vanilla HTML/CSS/JS (split into `index.html`, `style.css`, `asteroid-dashboard.js`)
- **Map:** Leaflet.js (CDN) for 2D crash calculator visualization
- **Globe:** Three.js (CDN) for rotatable 3D Earth in crash calculator
- **Charts:** Chart.js (CDN) for trend lines and timeline
- **Fonts:** Google Fonts CDN
- **API calls:** Native `fetch()`, no CORS proxy needed (all APIs support CORS)

### State Management
- Tab state: CSS class toggling on `.tab` and `.tab-panel` elements
- API responses: module-scoped JS objects, cleared on new fetch
- Calculator: pure function, no persistence

### Error Handling
- All `fetch()` calls wrapped in try/catch
- API error states display inline (not alert dialogs)
- DEMO_KEY rate-limit message displayed with link to NASA API key registration

### Accessibility
- All tabs use `role="tab"` / `aria-selected` / `aria-controls`
- Color is never the sole differentiator (icons + labels always present)
- Keyboard navigation between tabs (arrow keys)

---

## Design System

| Token | Value |
|-------|-------|
| Background | `#03060f` |
| Surface | `#090e1a` |
| Border | `#1a2235` |
| Accent primary | `#00d4ff` (cyan) |
| Accent danger | `#ff4444` (red) |
| Accent warning | `#ffaa00` (amber) |
| Text primary | `#e8eef8` |
| Text muted | `#5a7090` |
| Font display | `"Orbitron"` |
| Font body | `"IBM Plex Mono"` |

---

## Known Limitations

1. **DEMO_KEY throttling:** NeoWs DEMO_KEY is limited to 30 req/hr. Users should register for a free NASA API key.
2. **Impact calculator accuracy:** Results are order-of-magnitude estimates based on simplified physics. Not suitable for civil defense planning.
3. **Geocoding:** Location text is geocoded via the free Nominatim (OpenStreetMap) API; remote or ambiguous place names may fail.
4. **Sentry data latency:** The Sentry API reflects the last JPL computation run (~weekly updates).
5. **SBDB autocomplete:** Not available from the API; search is exact-match or designation-based.
6. **Globe texture:** Requires network access to load NASA Blue Marble texture via CDN.

---

## External Links & References
- [NeoWs API Docs](https://api.nasa.gov/)
- [JPL SBDB API Docs](https://ssd-api.jpl.nasa.gov/doc/sbdb.html)
- [JPL Sentry API Docs](https://ssd-api.jpl.nasa.gov/doc/sentry.html)
- [Earth Impact Effects Program — Collins et al. 2005](https://impact.ese.ic.ac.uk/ImpactEffects/)
- [NASA API Key Registration](https://api.nasa.gov/#signUp)
- [Torino Scale (Wikipedia)](https://en.wikipedia.org/wiki/Torino_scale)
- [Palermo Scale (Wikipedia)](https://en.wikipedia.org/wiki/Palermo_technical_impact_hazard_scale)
- [Three.js](https://threejs.org/)
