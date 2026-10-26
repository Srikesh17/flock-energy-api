# Protocol Discovery & Reverse-Engineering Report (PROTOCOL.md)

## 1. Executive Summary
This document details the reverse-engineering analysis of the **Urja Meter Ops** legacy portal (`https://urja-ops.flockenergy.tech`). Through network inspection, JavaScript chunk decompilation, and HTTP probing, we uncovered the underlying architecture, authentication lifecycles, CSRF constraints, undocumented internal JSON APIs, HTML DOM structures, and an HMAC-SHA256 authenticated bulk export protocol.

---

## 2. Portal Architecture & Framework
Inspection of HTTP headers and client-side bundles revealed that the portal is powered by **SvelteKit** (compiled with Vite) with client-side hydration:
- **Response Header**: `x-sveltekit-page: true`
- **Session Layer**: Powered by `better-auth`
- **Frontend Framework**: SvelteKit single-page application (SPA) with server-side rendered (SSR) initial shells and client-side fetches for telemetry and geospatial data.

---

## 3. Authentication & Session Management

### 3.1 Login Flow
- **Endpoint**: `POST https://urja-ops.flockenergy.tech/login`
- **Content-Type**: `application/x-www-form-urlencoded` (or `multipart/form-data`)
- **Form Payload**:
  ```http
  email=operator%40urja.local&password=urja-ops-2026
  ```
  *(Note: The form field name is `email`, not `username`)*

### 3.2 CSRF & Origin Verification Quirk
Direct POST requests without standard browser headers return:
```http
HTTP/1.1 403 Forbidden
Content-Type: text/plain

Cross-site POST form submissions are forbidden
```
**Mechanism**: SvelteKit enforces cross-site request forgery (CSRF) protections by strictly validating that incoming requests match the server host:
- `Origin: https://urja-ops.flockenergy.tech`
- `Referer: https://urja-ops.flockenergy.tech/login`

Supplying these headers allows the POST to proceed.

### 3.3 Session Cookie & Expiration
Upon valid credential submission, the server returns:
```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: __Secure-better-auth.session_token=<token>; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax

{"type":"redirect","status":303,"location":"/meters"}
```
- **Cookie Name**: `__Secure-better-auth.session_token`
- **TTL**: `3600` seconds (1 hour).
- **Session Expiry Behavior**: When a session expires or an unauthenticated request hits a protected page, the portal either serves the login page HTML (`Urja Meter Ops — Sign in`) or returns an HTTP 401. The adapter layer must detect both conditions and perform auto-reauthentication transparently.

---

## 4. Endpoints Discovered

### 4.1 Internal Paginated Meters Search API
- **Route**: `GET /portal/meters/search?q={query}&page={page}`
- **Authentication**: Requires valid `__Secure-better-auth.session_token` cookie.
- **Parameters**:
  - `q`: Search string matching meter ID or serial number (empty string returns all).
  - `page`: 1-based page index (20 items per page).
- **Response Structure**:
  ```json
  {
    "total": 403,
    "page": 1,
    "data": [
      {
        "meterId": "J100000",
        "serialNo": "SE33962",
        "make": "HPL",
        "phaseType": "single",
        "installStatus": "Decommissioned",
        "dtCode": "DT-001"
      }
    ]
  }
  ```

---

### 4.2 Meter Detail Page & HTML Structure
- **Route**: `GET /meters/{meterId}`
- **Content-Type**: `text/html`
- **Parsing Targets**:
  1. **Breadcrumb Hierarchy**: Located inside `<nav class="mt-2 flex flex-wrap gap-1 text-xs text-slate-500">`. Elements are delimited by `<span>›</span>`:
     - Index 0: Zone (e.g. `Jaipur Zone 1 (Z-01)`)
     - Index 1: Circle (e.g. `Circle 1 (C-01)`)
     - Index 2: Division (e.g. `Division 1 (D-01)`)
     - Index 3: Subdivision (e.g. `Subdivision 1 (SD-01)`)
     - Index 4: Substation (e.g. `Substation 1 (SS-01)`)
     - Index 5: Feeder (e.g. `Feeder 1 (F-001)`)
     - Index 6: Distribution Transformer (e.g. `Malviya Nagar DT 1 (DT-001)`)
  2. **Nameplate DL Elements**:
     Located inside `<dl class="divide-y divide-slate-100">`:
     - `<dt>Meter ID</dt><dd>J100000</dd>`
     - `<dt>Serial No</dt><dd>SE33962</dd>`
     - `<dt>Make</dt><dd>HPL</dd>`
     - `<dt>Phase Type</dt><dd>single</dd>`
     - `<dt>Installation Status</dt><dd>Decommissioned</dd>`
     - `<dt>Installation Type</dt><dd>Whole Current</dd>`

---

### 4.3 Geospatial Coordinates API
- **Route**: `GET /portal/meters/{meterId}/geo`
- **Authentication**: Session cookie.
- **Response**:
  ```json
  {
    "data": {
      "latitude": "26.938961002479868",
      "longitude": "75.83095696146852"
    }
  }
  ```
  *(Anomaly: Coordinates are returned as string representations of floats).*

---

### 4.4 Telemetry Energy Consumption API
- **Route**: `GET /portal/meters/{meterId}/energy`
- **Authentication**: Session cookie.
- **Response Structure**:
  ```json
  {
    "data": [
      {
        "timestamp": "23/06/2026 23:30",
        "kwh": "48438.74",
        "kvah": "52313.84",
        "voltR": "226"
      }
    ]
  }
  ```
  *(Readings represent 30-minute electrical intervals).*

---

### 4.5 Distribution Transformers API
- **Route**: `GET /portal/dts?page={page}`
- **Authentication**: Session cookie.
- **Response**:
  ```json
  {
    "total": 40,
    "page": 1,
    "data": [
      {
        "code": "DT-001",
        "name": "Malviya Nagar DT 1",
        "feederCode": "F-001",
        "capacityKva": 100
      }
    ]
  }
  ```

---

### 4.6 HMAC-SHA256 Authenticated Bulk Export Protocol
Decompilation of Vite bundle `4.2Bgc2kUI.js` uncovered a hidden, high-performance bulk export mechanism:
1. **Signing Key Retrieval**:
   - `GET /portal/keys` returns:
     ```json
     {
       "data": {
         "signingSecret": "I3dZPPf5CgTp7JyGNMI8i6z8LFR7TmSR"
       }
     }
     ```
2. **Signature Computation**:
   - Timestamp is Unix time in seconds: `timestamp = Math.floor(Date.now() / 1000)`
   - Message payload format:
     ```
     GET
     /portal/export
     page=1
     {timestamp}
     ```
     *(Joined with newline `\n` characters)*
   - Signature: HMAC-SHA256 digest of the message using `signingSecret` encoded as lowercase hex string.
3. **Export Request**:
   - `GET /portal/export?page=1`
   - Headers:
     - `x-timestamp: {timestamp}`
     - `x-signature: {signature}`
4. **Result**:
   Instantly downloads all **403 smart meters** with complete embedded hierarchy nodes (`zone`, `circle`, `division`, `subdivision`, `substation`, `feeder`, `dt`) and `geo` lat/lng coordinates in a single call.

---

## 5. Data Anomalies & Normalization Strategy

| Raw Portal Characteristic | Anomaly Observed | API Wrapper Normalization |
| :--- | :--- | :--- |
| **Number Formatting** | String numbers: `"kwh": "48438.74"`, `"voltR": "226"`, `"latitude": "26.938..."` | Converted to true IEEE 754 floats / integers (`parseFloat(val)`). |
| **Date & Time Formats** | Indian localized string format: `"23/06/2026 23:30"` | Normalized to ISO 8601 strings: `"2026-06-23T23:30:00.000Z"`. Original string is preserved in `timestamp`. |
| **Breadcrumbs vs Keys** | Hierarchical tokens inconsistently embedded in HTML breadcrumbs vs export objects | Mapped into a structured JSON hierarchy tree and standardized camelCase keys. |
| **CSRF Handling** | 403 Forbidden on raw POST requests without Origin | Automatically populated `Origin` and `Referer` headers on all portal communications. |
| **Session Lifetime** | 1-hour cookie expiration (`Max-Age=3600`) | Transparent interceptor automatically detects session expiry, re-authenticates with Urja, and retries the upstream request. |
