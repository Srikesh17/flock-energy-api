# Engineering Reflection (REFLECTION.md)

This document addresses the five reflection prompts regarding the development of the Urja Meter Ops API service, client adapter layer, and modern explorer dashboard.

---

### 1. What assumptions did you make?
- **Read-Only Invariant**: We assumed the Urja legacy portal was strictly read-only and that upstream systems do not accept write operations (e.g., updating meter status or altering phase connections). Accordingly, all API endpoints are idempotent or safe read operations.
- **Fixed Credentials Lifetime**: We assumed the credentials (`operator@urja.local` / `urja-ops-2026`) possess operational permissions to access all distribution zones (Jaipur Zones 1, 2, and 3) without requiring role-based elevation.
- **Clock Drift Tolerance**: In the HMAC-SHA256 signature algorithm for `/portal/export`, we assumed reasonable time synchronization (NTP) between the API host and the Urja portal server within a standard window of a few seconds.
- **Single-Tenant / In-Memory Cache**: We assumed deploying a single-instance service where an in-memory TTL cache (`MemoryCache`) is sufficient to prevent rate-limiting the legacy portal. In a multi-replica production cluster, an external Redis cache would be assumed instead.

---

### 2. Which part was the most difficult, and how did you get unstuck?
- **The Initial 403 Forbidden & SvelteKit CSRF Protection**:
  When submitting the initial login POST request to `/login`, the portal returned `403 Forbidden` with the error `Cross-site POST form submissions are forbidden`. Because SvelteKit protects form actions against cross-site request forgery by validating host headers, standard CLI tools and HTTP libraries that do not send browser-like origin headers are blocked immediately.
  **How we got unstuck**:
  We inspected the Vite client bundle `OkXSQ8CK.js` and decompiled the client-side form submission handler. We noticed SvelteKit's built-in header validation requirements, added explicit `Origin: https://urja-ops.flockenergy.tech` and `Referer: https://urja-ops.flockenergy.tech/login` headers to the Axios client, and the login succeeded with a 200/303 redirect.

- **Reverse-Engineering the HMAC-SHA256 Bulk Export**:
  Initially, extracting all 403 meters seemed to require paginating through 21 pages of `/portal/meters/search` and then firing 403 individual HTTP requests to `/meters/:id` and `/portal/meters/:id/geo` (taking upwards of 30–45 seconds).
  **How we got unstuck**:
  We audited the transformer client bundle `4.2Bgc2kUI.js` and identified function `C(method, path, query, secret)` which computes an HMAC-SHA256 signature using a dynamic signing secret fetched from `/portal/keys`. By replicating this signing routine in Node.js with native `crypto.createHmac`, we unlocked the bulk `/portal/export` endpoint, reducing the time required to fetch the entire 403-meter dataset with full hierarchies and geo-coordinates from 40 seconds to **under 400 milliseconds**.

---

### 3. If you had another day, what would you improve?
- **Distributed Caching with Redis**: Replace the in-memory cache with Redis or Valkey, enabling distributed cache invalidation, cache stampede protection (using locks/mutexes), and persistent cache across restarts.
- **Database Indexing & Geospatial Queries**: Ingest the 403 meters into PostgreSQL with PostGIS or SQLite with SpatiaLite to allow rich geospatial queries (e.g. `GET /api/v1/meters/nearby?lat=...&lng=...&radiusMeters=500`).
- **Telemetry Streaming & WebSockets**: Introduce Server-Sent Events (SSE) or WebSockets to stream live meter telemetry intervals to the dashboard in real-time.
- **Docker & Helm Orchestration**: Provide a production-ready `Dockerfile`, multi-stage builds, and docker-compose configurations with Prometheus metrics export (`/metrics`).

---

### 4. What mistake did you make while solving this (there's always one)?
- **Form Field Naming Mistake**:
  During the very first login attempt, we assumed the form fields were `username` and `password` (as mentioned in standard documentation snippets). The portal rejected the payload. Upon downloading the raw HTML of the login page and parsing the input tags, we noticed the attribute was `name="email"`, not `username`. Correcting the payload key to `email` immediately solved the authentication failure.

---

### 5. If you were reviewing your own submission, what would you criticise?
- **Hybrid Scraper Strategy vs Pure Scraper**:
  We utilized the discovered internal APIs (`/portal/meters/search`, `/portal/meters/:id/geo`, `/portal/meters/:id/energy`, and `/portal/export`) alongside Cheerio HTML parsing of `/meters/:id`. A purist reviewer might ask: *"If the internal APIs ever change or are deprecated, does the service break?"* To mitigate this, our `UrjaPortalClient` is built with Cheerio HTML parsing fallbacks, but having an automated test suite that runs periodic canary checks against both the HTML shell and internal APIs would provide even greater operational resilience.
- **Local In-Memory Hierarchy Reconstruction**:
  The hierarchy tree is reconstructed in-memory on every cache miss from the exported meter list. While this works effortlessly for 403 meters (taking < 5ms to compute), for a utility network with 10 million smart meters, this hierarchy must be stored and indexed as an adjacency list or nested sets tree in a proper graph or relational database.
