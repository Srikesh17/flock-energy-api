# Flock Energy — Urja Meter Ops API Service & Explorer

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-6BA539?logo=openapi-initiative&logoColor=white)](./openapi.json)
[![Tests](https://img.shields.io/badge/Tests-12%20Passed-emerald)](./test/api.test.js)

> A clean, production-grade REST API service, client adapter layer, and interactive web dashboard built over the legacy **Urja Meter Ops** portal (`https://urja-ops.flockenergy.tech`).

---

## ⚡ Table of Contents
- [Project Overview](#-project-overview)
- [Architecture & Key Features](#-architecture--key-features)
- [Repository Structure](#-repository-structure)
- [Quickstart: Setup & Running](#-quickstart-setup--running)
- [API Documentation & Endpoints](#-api-documentation--endpoints)
- [Sample Requests & Responses](#-sample-requests--responses)
- [Web Explorer & Dashboard](#-web-explorer--dashboard)
- [Design Decisions & Trade-Offs](#-design-decisions--trade-offs)
- [Assumptions & Intentional Omissions](#-assumptions--intentional-omissions)
- [What We'd Improve With More Time](#-what-wed-improve-with-more-time)
- [Protocol Discovery & Reflection Links](#-protocol-discovery--reflection-links)

---

## 🔍 Project Overview
Electricity distribution utility staff previously had to manually browse through the legacy "Urja Meter Ops" web portal to look up smart-meter status, geographic coordinates, grid hierarchy breadcrumbs, and consumption telemetry.

This project delivers:
1. **Automated Session & Cookie Management**: Persistent cookie-jar authentication with SvelteKit CSRF compliance and auto-reauthentication upon session expiry.
2. **Robust Scraping & API Adaptation**: Extracts messy HTML tables, breadcrumbs, and internal JSON endpoints, normalizing values into clean IEEE 754 floats and ISO 8601 timestamps.
3. **HMAC-SHA256 Bulk Data Exporter**: Leverages reverse-engineered dynamic signing keys to export all 403 smart meters with full hierarchies and geo-coordinates in **under 400ms**.
4. **Interactive OpenAPI 3.0 Specs & Swagger UI**: Available at `/docs` and raw schema at `/openapi.json`.
5. **Modern Web Client Dashboard**: Served at `/`, featuring real-time meter search, phase & status filters, dual-axis Chart.js telemetry curves, an interactive grid hierarchy tree, and transformer overviews.

---

## 🏛 Architecture & Key Features

```mermaid
flowchart TD
    Client["Client / Browser / Downstream System"]
    
    subgraph ExpressService ["Flock Energy API Wrapper (:3000)"]
        Router["Express Router (/api/v1)"]
        Cache["In-Memory Cache (MemoryCache)"]
        Dashboard["Modern Web Client (/)"]
        Docs["Swagger UI (/docs)"]
        Adapter["UrjaPortalClient (src/client.js)"]
    end

    subgraph LegacyUrja ["Legacy Urja Meter Ops Portal"]
        Auth["/login (better-auth session)"]
        SearchAPI["/portal/meters/search"]
        GeoAPI["/portal/meters/:id/geo"]
        EnergyAPI["/portal/meters/:id/energy"]
        ExportAPI["HMAC /portal/export"]
        HTMLPages["/meters/:id (HTML Breadcrumbs & Nameplate)"]
    end

    Client -->|HTTP REST| Router
    Client -->|Web Browser| Dashboard
    Client -->|Inspect Schema| Docs
    Router <--> Cache
    Router --> Adapter
    Adapter -->|Session + CSRF Headers| Auth
    Adapter -->|Paginated Query| SearchAPI
    Adapter -->|Telemetry Data| EnergyAPI
    Adapter -->|Coordinates| GeoAPI
    Adapter -->|Cheerio HTML Scraping| HTMLPages
    Adapter -->|HMAC-SHA256 Signature| ExportAPI
```

### Core Components
- **`src/client.js` (`UrjaPortalClient`)**: Encapsulates `axios` and `tough-cookie`. Injects required CSRF headers (`Origin`, `Referer`), handles SvelteKit session token lifecycles, parses HTML using `cheerio`, calculates HMAC-SHA256 signatures using Node's `crypto`, and re-authenticates on expired tokens.
- **`src/cache.js` (`MemoryCache`)**: In-memory TTL caching layer to protect the legacy portal from excess traffic and provide sub-millisecond response times.
- **`src/routes/api.js`**: RESTful route handlers for authentication, meters, consumption telemetry, distribution transformers, hierarchy trees, and bulk export.
- **`public/`**: Modern, responsive single-page application built with Tailwind CSS, FontAwesome, and Chart.js.

---

## 📁 Repository Structure

```
flock-energy-api/
├── package.json         # Project metadata and dependencies
├── .env.example         # Template environment variables
├── .env                 # Environment configuration (ignored in git)
├── .gitignore           # Git ignore list
├── openapi.json         # OpenAPI 3.0.3 specification
├── PROTOCOL.md          # In-depth reverse-engineering & protocol discovery
├── REFLECTION.md        # Answers to the 5 engineering reflection questions
├── README.md            # Front door documentation (this file)
├── src/
│   ├── app.js           # Express application setup, middleware & Swagger mount
│   ├── server.js        # Server entry point & graceful shutdown
│   ├── client.js        # UrjaPortalClient legacy adapter & scraper logic
│   ├── cache.js         # In-memory TTL cache implementation
│   ├── config.js        # Centralized configuration & environment loader
│   └── routes/
│       └── api.js       # REST API v1 endpoints
├── public/              # Modern Web Dashboard
│   ├── index.html       # Single-page explorer UI
│   ├── app.js           # Client-side reactivity, chart rendering & hierarchy tree
│   └── styles.css       # Tree styling & layout adjustments
└── test/
    └── api.test.js      # Automated test suite (12 tests covering all endpoints)
```

---

## 🚀 Quickstart: Setup & Running

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested with Node v22.12.0)
- **npm**: v9 or higher

### 1. Clone & Install
```bash
git clone <repo-url> flock-energy-api
cd flock-energy-api
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (defaults are preconfigured for the Urja portal):
```bash
cp .env.example .env
```

Contents of `.env`:
```env
PORT=3000
URJA_BASE_URL=https://urja-ops.flockenergy.tech
URJA_USERNAME=operator@urja.local
URJA_PASSWORD=urja-ops-2026
CACHE_TTL_SECONDS=300
```

### 3. Start the Server
```bash
npm start
```
The server will start on port `3000`:
- **Web Dashboard**: [http://localhost:3000/](http://localhost:3000/)
- **Interactive Swagger Docs**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Raw OpenAPI Spec**: [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)

### 4. Run Automated Tests
```bash
npm test
```
Executes all 12 test suites verifying every REST endpoint, query parameters, Cheerio HTML parsing, telemetry normalization, and HMAC bulk export.

---

## 📖 API Documentation & Endpoints

| Method | Endpoint | Description | Cache TTL |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Explicit manual login or session verification | — |
| `GET` | `/api/v1/meters` | Paginated search of smart meters (supports `q`, `page`, `status`, `phase`, `make`) | 60s |
| `GET` | `/api/v1/meters/:id` | Full meter details (nameplate, geo coordinates, electrical hierarchy) | 300s |
| `GET` | `/api/v1/meters/:id/consumption` | Timeseries energy readings (kWh, kVAh, Voltage) (supports `limit`, `sort`) | 120s |
| `GET` | `/api/v1/transformers` | List of distribution transformers with rated kVA capacity | 300s |
| `GET` | `/api/v1/hierarchy` | Reconstructed electrical distribution network tree | 600s |
| `GET` | `/api/v1/export` | Complete 403-meter dataset via signed HMAC-SHA256 protocol | 600s |
| `GET` | `/api/v1/stats` | Aggregated metrics, status breakdowns, and asset counts | 600s |
| `GET` | `/health` | Service health status and cache item count | — |

---

## 💻 Sample Requests & Responses

### 1. List Smart Meters
```bash
curl -X GET "http://localhost:3000/api/v1/meters?q=J100000&page=1"
```
**Response (`200 OK`)**:
```json
{
  "total": 403,
  "page": 1,
  "count": 1,
  "data": [
    {
      "meterId": "J100000",
      "serialNumber": "SE33962",
      "make": "HPL",
      "phaseType": "single",
      "installationStatus": "Decommissioned",
      "dtCode": "DT-001"
    }
  ]
}
```

### 2. Get Detailed Meter Profile
```bash
curl -X GET "http://localhost:3000/api/v1/meters/J100000"
```
**Response (`200 OK`)**:
```json
{
  "meterId": "J100000",
  "serialNumber": "SE33962",
  "make": "HPL",
  "phaseType": "single",
  "installationStatus": "Decommissioned",
  "installationType": "Whole Current",
  "hierarchy": {
    "zone": "Jaipur Zone 1 (Z-01)",
    "circle": "Circle 1 (C-01)",
    "division": "Division 1 (D-01)",
    "subdivision": "Subdivision 1 (SD-01)",
    "substation": "Substation 1 (SS-01)",
    "feeder": "Feeder 1 (F-001)",
    "dt": "Malviya Nagar DT 1 (DT-001)"
  },
  "hierarchyBreadcrumbs": [
    "Jaipur Zone 1 (Z-01)",
    "Circle 1 (C-01)",
    "Division 1 (D-01)",
    "Subdivision 1 (SD-01)",
    "Substation 1 (SS-01)",
    "Feeder 1 (F-001)",
    "Malviya Nagar DT 1 (DT-001)"
  ],
  "coordinates": {
    "latitude": 26.938961002479868,
    "longitude": 75.83095696146852
  }
}
```

### 3. Get Meter Consumption Telemetry
```bash
curl -X GET "http://localhost:3000/api/v1/meters/J100000/consumption?limit=2&sort=desc"
```
**Response (`200 OK`)**:
```json
{
  "meterId": "J100000",
  "totalReadings": 337,
  "returnedReadings": 2,
  "sort": "desc",
  "readings": [
    {
      "timestamp": "30/06/2026 23:30",
      "isoTimestamp": "2026-06-30T23:30:00.000Z",
      "kwh": 48580.42,
      "kvah": 52467.14,
      "voltagePhaseR": 232
    },
    {
      "timestamp": "30/06/2026 23:00",
      "isoTimestamp": "2026-06-30T23:00:00.000Z",
      "kwh": 48580.0,
      "kvah": 52466.68,
      "voltagePhaseR": 227
    }
  ]
}
```

---

## 🎨 Web Explorer & Dashboard
Navigating to `http://localhost:3000` opens the built-in UI:
- **KPI Summary Cards**: Real-time totals of meters, active vs. decommissioned assets, and distribution transformers.
- **Smart Meters Directory**: Searchable, filterable table with status badges and pagination.
- **Meter Inspector Drawer**: Click any row to view complete nameplate data, a Google Maps link to coordinates, and **dual-axis Chart.js telemetry charts** for cumulative energy (kWh) and voltage fluctuations.
- **Network Hierarchy Tree**: Interactive collapsible tree visualizer mapping Jaipur Zones 1–3 down through circles, divisions, feeders, and transformers.
- **Transformers Grid**: DT capacities (kVA) and feeder codes.
- **Export All**: Direct one-click download of the complete HMAC-exported dataset.

---

## ⚖ Design Decisions & Trade-Offs

1. **Internal APIs + Cheerio HTML Scraping (Hybrid Approach)**:
   - *Decision*: We combined the portal's discovered internal endpoints (`/portal/meters/search`, `/portal/meters/:id/geo`, `/portal/meters/:id/energy`) with Cheerio HTML scraping of `/meters/:id` for nameplate details and breadcrumbs.
   - *Trade-Off*: Internal APIs provide faster, cleaner structured data than parsing entire pages with regular expressions, while Cheerio ensures that if the portal renders server-side HTML, we reliably extract nameplate metadata and breadcrumb hierarchy.

2. **In-Memory TTL Caching (`MemoryCache`)**:
   - *Decision*: Implemented an in-memory TTL cache with cache keys per query.
   - *Trade-Off*: Prevents hammering the legacy portal and keeps response times below 10ms. For a multi-instance production cluster, we would substitute this with Redis.

3. **HMAC-SHA256 Bulk Export Utilization**:
   - *Decision*: Rather than making 403 sequential HTTP requests to harvest all meters, we reverse-engineered the client-side HMAC signature routine from `4.2Bgc2kUI.js` using `/portal/keys`.
   - *Benefit*: Yields the entire 403-meter dataset with complete nested hierarchy and coordinates in under **400 milliseconds**.

---

## 📝 Assumptions & Intentional Omissions

### Assumptions
- The legacy portal is strictly read-only; no endpoints require mutating state or posting new meters.
- The operator credentials (`operator@urja.local` / `urja-ops-2026`) have access to all distribution zones in the utility.
- Consumption readings follow a standard 30-minute interval window.

### Intentional Omissions
- **User Authentication on API Service**: The API proxy automates upstream authentication to Urja, but currently exposes open endpoints for internal microservices. In production, an API key or JWT layer (e.g. Bearer token) would guard the proxy endpoints.
- **Relational Database Storage**: Data is fetched on-demand or cached in-memory. We intentionally avoided a mandatory local Postgres/SQLite dependency so that the project can be cloned and run immediately with zero external services.

---

## 🔮 What We'd Improve With More Time
1. **Persistent Geospatial Query Layer**: Ingest the dataset into PostgreSQL + PostGIS or SQLite with R*Tree indexing to support radius queries like `"Find all smart meters within 500m of latitude X, longitude Y"`.
2. **Distributed Redis Caching**: Shared cache across multi-container instances with cache stampede locks.
3. **WebSockets / Telemetry Streaming**: Push new meter telemetry to the dashboard via SSE (Server-Sent Events) or WebSockets.
4. **Automated Dockerization**: Multi-stage `Dockerfile` and `docker-compose.yml` for instant deployment.

---

## 🔗 Key Deliverables
- [Detailed Reverse-Engineering Protocol (PROTOCOL.md)](./PROTOCOL.md)
- [Answers to Reflection Questions (REFLECTION.md)](./REFLECTION.md)
- [OpenAPI 3.0.3 Specification (openapi.json)](./openapi.json)
- [Automated Test Suite (test/api.test.js)](./test/api.test.js)
