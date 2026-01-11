# Backward-Compatible API Evolution Guide
## Evolving APIs Without Breaking Clients

---

## 1. The Golden Rule

> **"Add, don't modify or remove."**

Once an API is published, it's a contract. Clients depend on it. Breaking that contract breaks their applications.

### The Cost of Breaking Changes

| Impact | Example |
|--------|---------|
| **Client downtime** | Apps crash when field disappears |
| **Migration burden** | N clients × hours to update |
| **Trust erosion** | Partners lose confidence |
| **Support overhead** | Tickets, debugging, hotfixes |
| **Versioning complexity** | Multiple versions to maintain |

### The Goal

Evolve your API continuously **without** requiring clients to change their code.

---

## 2. Breaking vs Non-Breaking Changes

### ❌ Breaking Changes (Require New Version)

| Change | Why It Breaks |
|--------|---------------|
| Remove a field | Clients expecting it get errors |
| Rename a field | Same as removal from client's perspective |
| Change field type | `string` → `int` breaks parsing |
| Change field format | `2024-01-15` → `1705276800` breaks parsing |
| Make optional → required | Old requests missing field now fail |
| Remove enum value | Clients sending old value get errors |
| Remove endpoint | Client calls fail with 404 |
| Change URL structure | Bookmarked/hardcoded URLs break |
| Change auth mechanism | Existing tokens/keys stop working |
| Reduce rate limits | Previously working clients get throttled |
| Change error format | Client error handling breaks |

### ✓ Non-Breaking Changes (Safe)

| Change | Why It's Safe |
|--------|---------------|
| Add new optional field | Clients ignore unknown fields |
| Add new endpoint | Existing calls unaffected |
| Add new optional parameter | Old requests still work |
| Add new enum value | Old values still work* |
| Make required → optional | Old requests still valid |
| Increase rate limits | Clients get more capacity |
| Add new error codes | Good clients handle unknown codes |
| Add new HTTP methods | Existing methods unaffected |
| Improve performance | Clients just get faster responses |
| Fix bugs | (Usually) improves behavior |

**\* Warning:** Adding enum values can break **strict** clients that validate against known values. Document this risk.

---

## 3. Additive Evolution Pattern

### The Concept

Instead of modifying existing fields, **add new ones** alongside them.

### Example: Splitting a Name Field

**Original API:**
```json
{
  "id": "123",
  "name": "John Doe"
}
```

**Evolved API (backward compatible):**
```json
{
  "id": "123",
  "name": "John Doe",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Key Points:**
- Old field `name` still exists and works
- New fields `first_name` and `last_name` added
- Old clients ignore new fields
- New clients can use either

### Example: Changing Response Structure

**Original:**
```json
{
  "user": {
    "id": "123",
    "email": "john@example.com"
  }
}
```

**Need to add metadata? Don't restructure. Add:**
```json
{
  "user": {
    "id": "123",
    "email": "john@example.com"
  },
  "meta": {
    "request_id": "req_abc",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## 4. Tolerant Reader Pattern

### The Concept

Build clients that are **tolerant** of changes. Build servers that are **lenient** with input.

> "Be conservative in what you send, be liberal in what you accept." — Postel's Law

**Provide sensible defaults:**
```javascript
// ✓ Defaults for optional/new fields
function createOrder(req, res) {
  const {
    product_id,
    quantity,
    priority = 'normal',        // Default for new field
    gift_wrap = false,          // Default for new field
    delivery_notes = null       // Nullable new field
  } = req.body;
}
```

---

## 5. Deprecation Workflow

### The Timeline

```
Month 0     Month 3      Month 6       Month 12      Month 18
   │           │            │             │             │
   ▼           ▼            ▼             ▼             ▼
┌──────┐   ┌──────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ANNOUNCE│ │ WARN │    │MIGRATE │    │MONITOR │    │ SUNSET │
└──────┘   └──────┘    └────────┘    └────────┘    └────────┘
   │           │            │             │             │
   │           │            │             │             │
Add         Log usage    Notify        Track          Remove
deprecation  & send      remaining     stragglers     or return
headers     warnings     users                        410 Gone
```

### Phase 1: Announce (Month 0)

**Add deprecation headers (REST):**
```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jun 2025 00:00:00 GMT
Link: <https://api.example.com/docs/migration>; rel="deprecation"
```

**Add to documentation:**
- Mark as deprecated
- Provide migration guide
- State sunset date

### Phase 2: Warn (Month 3-6)

**Log usage of deprecated endpoints:**
```javascript
function deprecationMiddleware(req, res, next) {
  // Log who's still using it
  logger.warn('Deprecated endpoint used', {
    endpoint: req.path,
    client_id: req.auth.clientId,
    timestamp: new Date()
  });
  
  // Add warning header
  res.set('Warning', '299 - "This endpoint is deprecated"');
  
  next();
}
```

**Notify consumers:**
- Email API consumers
- Dashboard warnings
- Changelog announcements

### Phase 3: Migrate (Month 6-12)

- Run old and new versions in parallel
- Provide migration tools/scripts
- Offer support for migration
- Track migration progress

### Phase 4: Monitor (Month 12-15)

- Check remaining usage
- Contact stragglers directly
- Extend deadline if major clients stuck
- Document any exceptions

### Phase 5: Sunset (Month 15-18)

**Option A: Return 410 Gone**
```http
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "error": "This endpoint has been removed",
  "migration_guide": "https://api.example.com/docs/v2-migration",
  "new_endpoint": "/api/v2/users"
}
```

**Option B: Redirect to new version**
```http
HTTP/1.1 301 Moved Permanently
Location: /api/v2/users
```

---

## 6. Schema Evolution by Paradigm

### REST: Versioning Strategies

**Option 1: URL versioning (new major version)**
```
/api/v1/users  →  /api/v2/users
```

**Option 2: Additive evolution (preferred)**
```json
// v1 response
{ "name": "John Doe" }

// Evolved response (still v1, backward compatible)
{ "name": "John Doe", "first_name": "John", "last_name": "Doe" }
```

**OpenAPI deprecation:**
```yaml
paths:
  /users/{id}:
    get:
      deprecated: true
      description: "Use /api/v2/users/{id} instead"
```

### GraphQL: Schema Evolution

**Deprecate fields:**
```graphql
type User {
  id: ID!
  name: String! @deprecated(reason: "Use firstName and lastName")
  firstName: String!
  lastName: String!
}
```

**Deprecate enum values:**
```graphql
enum OrderStatus {
  PENDING
  PROCESSING @deprecated(reason: "Use CONFIRMED instead")
  CONFIRMED
  SHIPPED
}
```

**Deprecate arguments:**
```graphql
type Query {
  users(
    limit: Int @deprecated(reason: "Use first instead")
    first: Int
    offset: Int @deprecated(reason: "Use after instead")
    after: String
  ): UserConnection!
}
```

**Key principle:** Never remove fields immediately. Deprecate first, monitor, then remove.

### gRPC: Proto Evolution

**Reserve removed fields:**
```protobuf
message User {
  reserved 3, 4;                    // Reserved field numbers
  reserved "old_name", "legacy_id"; // Reserved field names
  
  string id = 1;
  string first_name = 2;
  // field 3 was: string old_name (removed)
  // field 4 was: string legacy_id (removed)
  string last_name = 5;
}
```

**Never reuse field numbers:**
```protobuf
// ❌ WRONG - reusing field number 3
message User {
  string id = 1;
  string name = 2;
  // Was: string email = 3; (removed)
  string phone = 3;  // DANGER! Old data will be corrupted
}

// ✓ CORRECT - reserve and use new number
message User {
  reserved 3;
  reserved "email";
  
  string id = 1;
  string name = 2;
  string phone = 4;  // New field gets new number
}
```

---

## 7. Quick Reference

### Safe Changes ✓

| Category | Safe Changes |
|----------|--------------|
| **Fields** | Add optional field, make required → optional |
| **Endpoints** | Add new endpoint, add optional parameter |
| **Enums** | Add new value (with client warning) |
| **Limits** | Increase rate limits, increase payload size |
| **Performance** | Speed improvements, caching |
| **Errors** | Add new error codes (if clients handle unknown) |

### Unsafe Changes ❌

| Category | Breaking Changes |
|----------|------------------|
| **Fields** | Remove, rename, change type, change format |
| **Endpoints** | Remove, change URL, change method |
| **Enums** | Remove value, rename value |
| **Validation** | Make optional → required, add new validation |
| **Limits** | Reduce rate limits, reduce payload size |
| **Auth** | Change auth mechanism, change scopes |

---

## 8. References

| Resource | URL |
|----------|-----|
| RFC 8594 (Sunset Header) | https://datatracker.ietf.org/doc/html/rfc8594 |
| RFC 8288 (Web Linking) | https://datatracker.ietf.org/doc/html/rfc8288 |
| API Versioning Best Practices | https://cloud.google.com/apis/design/versioning |
| Stripe API Versioning | https://stripe.com/docs/api/versioning |
| GraphQL Deprecation | https://graphql.org/learn/best-practices/#versioning |
| Protobuf Updating Messages | https://protobuf.dev/programming-guides/proto3/#updating |
| Microsoft Breaking Changes Guide | https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md |
| Postel's Law | https://en.wikipedia.org/wiki/Robustness_principle |
| Expand-Contract Pattern | https://martinfowler.com/bliki/ParallelChange.html |
