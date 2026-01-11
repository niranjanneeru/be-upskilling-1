# Designing Stable Endpoints
## Problems & Solutions

---


## Duplicate Requests

**Case:**
In payments, a POST request can be duplicated due to network retry, user double-click, or timeout retry. Customer gets charged twice.

**Solution: Idempotency Key**

```http
POST /api/v1/payments
Idempotency-Key: pay_req_abc123
Content-Type: application/json

{ "amount": 1000, "currency": "USD" }
```

- Client generates unique key per request
- Server stores key + response
- Retry with same key → returns cached response
- Different key → processes as new request

---

## Field Removal Breaks Clients

**Case:**
API returns `{ "name": "John Doe" }`. Team decides to split into `first_name` and `last_name`, removes `name`. All clients break.

**Solution: Additive Changes**

```json
// Before
{ "name": "John Doe" }

// After (backward compatible)
{
  "name": "John Doe",
  "first_name": "John",
  "last_name": "Doe"
}
```

- Keep old field, add new fields
- Deprecate old field with timeline
- Remove only after migration period

---

## Type Changes Break Parsing

**Case:**
API changes `"age": "25"` (string) to `"age": 25` (integer). Client JSON parsing fails.

**Solution: New Field + Deprecation**

```json
// Before
{ "age": "25" }

// After (backward compatible)
{
  "age": "25",
  "age_years": 25
}
```

- Never change field types
- Add new field with correct type
- Deprecate old field
- Document the change

---

## URL Structure Changes

**Case:**
API changes from `/api/users/123` to `/api/v2/customers/123`. All bookmarks, integrations, and hardcoded URLs break.

**Solution: Stable URL Patterns + Redirects**

```http
# Old URL returns redirect
GET /api/users/123
HTTP/1.1 301 Moved Permanently
Location: /api/v2/customers/123

# Or keep both working
GET /api/users/123      → Works
GET /api/v2/customers/123 → Works
```

- Plan URL structure carefully from day one
- Use redirects when changing
- Support old URLs for deprecation period

---

## Inconsistent Error Formats

**Case:**
Different endpoints return errors differently. Client error handling is a mess.

```json
// Endpoint A
{ "error": "Not found" }

// Endpoint B
{ "message": "Not found", "code": 404 }

// Endpoint C
{ "errors": ["Not found"] }
```

**Solution: RFC 7807 Standard Format**

```json
{
  "type": "https://api.example.com/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "User with ID 123 not found",
  "instance": "/api/users/123",
  "code": "USER_NOT_FOUND"
}
```

- One error format across all endpoints
- Include machine-readable error codes
- Include human-readable messages

---

## Pagination Data Shifts

**Case:**
User is on page 2. New item inserted on page 1. User sees duplicate item. Or item deleted from page 1, user misses an item.

**Solution: Cursor-Based Pagination**

```http
# Instead of offset
GET /api/users?page=2&limit=20

# Use cursor
GET /api/users?cursor=eyJpZCI6MTAwfQ&limit=20
```

```json
{
  "data": [...],
  "next_cursor": "eyJpZCI6MTIwfQ",
  "has_more": true
}
```

- Cursor points to specific item
- Inserts/deletes don't shift results
- Consistent experience for user

---

## Optional Becomes Required

**Case:**
`phone` field was optional. New validation makes it required. Old clients sending requests without `phone` now fail.

**Solution: Never Tighten Validation**

```javascript
// Server-side: provide defaults for new required fields
function createUser(data) {
  const user = {
    name: data.name,
    email: data.email,
    phone: data.phone || null,  // Keep optional
    phone_verified: false       // New field with default
  };
}
```

- Optional fields stay optional forever
- Add new required fields with defaults
- Validate new fields only for new clients (via version)

---

## Enum Value Removed

**Case:**
Order status enum has `PROCESSING`. Team removes it. Clients sending `status: "PROCESSING"` get errors.

**Solution: Deprecate, Don't Remove**

```json
// Document deprecation
{
  "status": "PROCESSING",  // @deprecated - use CONFIRMED
  "status_v2": "CONFIRMED"
}
```

```
// In documentation
PROCESSING - Deprecated, use CONFIRMED instead
            Will be removed on 2025-06-01
```

- Map old values to new values on server
- Accept old values, return new values
- Remove only after long deprecation period

---

## No Deprecation Warning

**Case:**
Endpoint removed without notice. Clients discover it's gone when they get 404 in production.

**Solution: Deprecation Headers + Timeline**

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jun 2025 00:00:00 GMT
Link: <https://api.example.com/docs/migration>; rel="deprecation"
Warning: 299 - "This endpoint is deprecated. Use /v2/users instead"
```

**Timeline:**
```
Month 0  → Announce + Add headers
Month 3  → Log usage + Warn active users
Month 6  → Email remaining users
Month 12 → Return 410 Gone
```

---

## Null vs Missing Ambiguity

**Case:**
Client can't tell if `phone: null` means "no phone" or "phone not loaded". PATCH requests don't know if missing field means "don't update" or "set to null".

**Solution: Explicit Conventions**

```json
// Option 1: Always include all fields
{
  "name": "John",
  "phone": null,      // Explicitly no phone
  "email": "j@x.com"
}

// Option 2: Use field mask for PATCH
PATCH /api/users/123
{
  "update_mask": ["name", "phone"],
  "name": "John",
  "phone": null       // Explicitly set to null
}
```

- Document null semantics clearly
- Use field masks for partial updates
- Be consistent across all endpoints

---

## Breaking Auth Changes

**Case:**
API switches from API Key to OAuth2. All existing integrations break immediately.

**Solution: Parallel Auth + Migration Period**

```http
# Support both during migration
Authorization: Bearer <oauth_token>
# OR
X-API-Key: <api_key>
```

**Timeline:**
```
Month 0  → Launch OAuth2, keep API Key working
Month 1  → Email all API Key users
Month 3  → Dashboard warnings
Month 6  → Disable new API Key creation
Month 12 → Disable API Key auth
```

- Run both auth methods in parallel
- Long migration period (6-12 months)
- Direct communication with affected users

---

## Response Structure Changes

**Case:**
API changes from flat to nested response. Client property access breaks.

```json
// Before
{ "user_name": "john", "user_email": "j@x.com" }

// After - BREAKING
{ "user": { "name": "john", "email": "j@x.com" } }
```

**Solution: Expand-Contract Pattern**

```json
// Phase 1: Expand (both structures)
{
  "user_name": "john",
  "user_email": "j@x.com",
  "user": {
    "name": "john",
    "email": "j@x.com"
  }
}

// Phase 2: Migrate clients

// Phase 3: Contract (remove old)
{
  "user": { "name": "john", "email": "j@x.com" }
}
```

---

## Rate Limit Reduction

**Case:**
API reduces rate limit from 1000/hour to 100/hour. Working integrations suddenly start failing.

**Solution: Grandfathering + Notice**

```http
# Response headers
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 500
X-RateLimit-Reset: 1705312800

# For new limits, give advance notice
X-RateLimit-Upcoming-Limit: 100
X-RateLimit-Upcoming-Date: 2025-06-01
```

- Grandfather existing users at old limits
- Announce changes well in advance
- Provide upgrade path (paid tier, etc.)

---

## Date Format Changes

**Case:**
API changes `"date": "2024-01-15"` to `"date": "2024-01-15T00:00:00Z"`. Date parsing breaks.

**Solution: New Field for New Format**

```json
// Before
{ "date": "2024-01-15" }

// After (backward compatible)
{
  "date": "2024-01-15",
  "datetime": "2024-01-15T00:00:00Z",
  "timestamp": 1705276800
}
```

- Add new field with new format
- Keep old field unchanged
- Use ISO 8601 from day one

---

## No API Contract

**Case:**
No formal API specification. Frontend and backend disagree on field names, types, and requirements. Bugs discovered in production.

**Solution: OpenAPI Specification**

```yaml
openapi: 3.0.0
paths:
  /users/{id}:
    get:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

- Single source of truth
- Auto-generate client SDKs
- Validate requests/responses
- Auto-generate documentation

---

## Summary - Golden Rules

**The Golden Rules for Stable Endpoints:**

| Rule | Description |
|------|-------------|
| **Add, Don't Remove** | Never remove or rename fields |
| **Never Change Types** | Add new field instead |
| **Deprecate Gracefully** | 6-12 month timeline with headers |
| **Version Early** | Plan for `/v1/` from start |
| **Standardize Errors** | RFC 7807 across all endpoints |
| **Use Cursors** | Not offset pagination |
| **Idempotency Keys** | For all POST mutations |
| **Document Everything** | OpenAPI spec as contract |
| **Communicate Changes** | Headers, emails, changelogs |
| **Test Backward Compat** | Before every release |

---

## Quick Reference

| Problem | Solution |
|---------|----------|
| Duplicate POST | Idempotency Key |
| Field removal | Add new, deprecate old |
| Type change | New field with new type |
| URL change | Redirects + parallel support |
| Error inconsistency | RFC 7807 standard |
| Pagination shifts | Cursor-based pagination |
| Optional → Required | Keep optional, add new field |
| Enum removal | Map old → new on server |
| No deprecation notice | Sunset headers + timeline |
| Null ambiguity | Document + field masks |
| Auth change | Parallel auth methods |
| Structure change | Expand-Contract pattern |
| Rate limit reduction | Grandfather + advance notice |
| Date format change | New field for new format |
| No contract | OpenAPI specification |
