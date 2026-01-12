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
