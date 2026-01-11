# REST API Design Guide
## Designing Stable Endpoints

---

## 1. Resource Naming Rules

### Use Nouns, Not Verbs

HTTP methods already define the action. URLs should identify **what**, not **how**.

| ❌ Wrong | ✓ Correct |
|----------|-----------|
| `GET /getUsers` | `GET /users` |
| `POST /createUser` | `POST /users` |
| `POST /deleteUser/123` | `DELETE /users/123` |
| `GET /fetchAllOrders` | `GET /orders` |

### Use Plural Nouns for Collections

| ❌ Wrong | ✓ Correct |
|----------|-----------|
| `/user` | `/users` |
| `/user/123` | `/users/123` |
| `/product` | `/products` |

**Exception - Singletons:**
- `/users/123/profile` ✓ (one profile per user)
- `/me` ✓ (current authenticated user)

### Use Lowercase with Hyphens

| ❌ Wrong | ✓ Correct |
|----------|-----------|
| `/Users` | `/users` |
| `/OrderItems` | `/order-items` |
| `/order_items` | `/order-items` |
| `/orderItems` | `/order-items` |

### Maximum 2-3 Nesting Levels

| ❌ Too Deep | ✓ Better |
|-------------|----------|
| `/users/123/orders/456/items/789/reviews` | `/items/789/reviews` |
| `/companies/1/departments/2/employees/3/tasks` | `/tasks?employee_id=3` |

### No File Extensions

| ❌ Wrong | ✓ Correct |
|----------|-----------|
| `/users/123.json` | `/users/123` |
| `/report.xml` | `/report` |

Use `Accept` header instead: `Accept: application/json`

---

## 2. Resource Hierarchy Examples

```
# Products
GET    /products                → List products
GET    /products/123            → Get product
POST   /products                → Create product
PATCH  /products/123            → Update product
DELETE /products/123            → Delete product

# Nested Resources
GET    /products/123/variants   → List variants of product
POST   /products/123/variants   → Create variant for product

# Orders
GET    /orders                  → List orders
GET    /orders/456              → Get order
GET    /orders/456/items        → Order items
POST   /orders/456/cancel       → Cancel order (action)

# Current User
GET    /me                      → Current user
GET    /me/orders               → My orders
GET    /me/addresses            → My addresses
```

---

## 3. HTTP Methods

| Method | Purpose | Has Body | Idempotent | Safe |
|--------|---------|----------|------------|------|
| `GET` | Read/Retrieve | No | Yes | Yes |
| `POST` | Create / Action | Yes | No | No |
| `PUT` | Replace entire resource | Yes | Yes | No |
| `PATCH` | Partial update | Yes | Yes | No |
| `DELETE` | Remove | Optional | Yes | No |

**Definitions:**
- **Idempotent:** Same request multiple times = same result
- **Safe:** Doesn't modify server state

### PUT vs PATCH

| PUT (Replace) | PATCH (Update) |
|---------------|----------------|
| Send complete resource | Send only changed fields |
| Missing fields = removed/nulled | Missing fields = unchanged |

```
PUT /users/123
{ "name": "John", "email": "john@example.com", "phone": "123" }
→ Replaces entire user

PATCH /users/123
{ "name": "John" }
→ Only updates name, email & phone unchanged
```

---

## 4. HTTP Status Codes

### 2xx - Success

| Code | Name | When to Use |
|------|------|-------------|
| `200` | OK | General success (GET, PUT, PATCH) |
| `201` | Created | Resource created (POST) - include `Location` header |
| `202` | Accepted | Async processing started |
| `204` | No Content | Success, no body needed (DELETE) |

### 4xx - Client Errors

| Code | Name | When to Use |
|------|------|-------------|
| `400` | Bad Request | Malformed JSON, invalid syntax |
| `401` | Unauthorized | No auth token or invalid token |
| `403` | Forbidden | Valid auth but no permission |
| `404` | Not Found | Resource doesn't exist |
| `405` | Method Not Allowed | Wrong HTTP method for endpoint |
| `409` | Conflict | Resource state conflict (already exists) |
| `422` | Unprocessable Entity | Valid syntax but validation failed |
| `429` | Too Many Requests | Rate limit exceeded |

**401 vs 403:**
- `401`: "Who are you?" - Missing/invalid authentication
- `403`: "I know you, but no." - Authenticated but not authorized

**400 vs 422:**
- `400`: Can't parse request (malformed JSON)
- `422`: Parsed OK but data invalid (email taken, password too short)

### 5xx - Server Errors

| Code | Name | When to Use |
|------|------|-------------|
| `500` | Internal Server Error | Unexpected error (bugs) |
| `502` | Bad Gateway | Upstream service failed |
| `503` | Service Unavailable | Overloaded or maintenance |
| `504` | Gateway Timeout | Upstream timeout |

---

## 5. Response Structure

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

### Collection Response (with pagination)

```json
{
  "success": true,
  "data": [
    { "id": "1", "name": "Product A" },
    { "id": "2", "name": "Product B" }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20
  },
  "links": {
    "self": "/products?page=1",
    "next": "/products?page=2",
    "last": "/products?page=8"
  }
}
```

### Error Response (RFC 7807)

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The request body contains invalid data",
  "instance": "/users",
  "timestamp": "2024-01-15T10:30:00Z",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "Must be a valid email address"
    },
    {
      "field": "password",
      "code": "TOO_SHORT",
      "message": "Must be at least 8 characters"
    }
  ]
}
```

### Error Code Prefixes

| Prefix | Category | Examples |
|--------|----------|----------|
| `AUTH_` | Authentication | `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS` |
| `AUTHZ_` | Authorization | `AUTHZ_INSUFFICIENT_PERMISSIONS` |
| `VAL_` | Validation | `VAL_EMAIL_INVALID`, `VAL_REQUIRED_FIELD` |
| `RES_` | Resource | `RES_NOT_FOUND`, `RES_ALREADY_EXISTS` |
| `RATE_` | Rate Limiting | `RATE_LIMIT_EXCEEDED` |
| `SYS_` | System | `SYS_MAINTENANCE`, `SYS_UNAVAILABLE` |

---

## 6. Idempotency

### Why It Matters

Network failures cause retries. Without idempotency:
- Retry POST → duplicate orders
- Retry payment → double charges

### Idempotency Keys (for POST)

```
POST /orders
Idempotency-Key: ord_req_abc123
Content-Type: application/json

{ "product_id": "123", "quantity": 2 }
```

**Flow:**
1. First request → Process, store key + response
2. Retry (same key) → Return cached response
3. Different key → Process as new request

**Rules:**
- Client generates the key (UUID recommended)
- Same key + different body = Error
- Keys expire after 24-48 hours

---

## 7. Handling Actions (Non-CRUD)

### Option 1: Verb as Sub-Resource (Recommended)

```
POST /orders/123/cancel
POST /orders/123/refund
POST /users/456/activate
POST /payments/789/capture
```

### Option 2: State Change via PATCH

```
PATCH /orders/123
{ "status": "cancelled" }
```

### Option 3: Actions Endpoint

```
POST /orders/123/actions
{ "action": "cancel", "reason": "Customer request" }
```

---

## 8. Quick Reference Checklist

**Naming:**
- [ ] Nouns, not verbs
- [ ] Plural for collections
- [ ] Lowercase with hyphens
- [ ] Max 2-3 nesting levels
- [ ] No file extensions

**Methods:**
- [ ] GET for reading
- [ ] POST for creating (+ idempotency key)
- [ ] PUT for replacing
- [ ] PATCH for updating
- [ ] DELETE for removing

**Status Codes:**
- [ ] 200/201/204 for success
- [ ] 400/422 for validation errors
- [ ] 401/403 for auth errors
- [ ] 404 for not found
- [ ] 5xx for server errors

**Responses:**
- [ ] Consistent envelope structure
- [ ] RFC 7807 for errors
- [ ] Error codes + messages
- [ ] Pagination metadata for lists

---

## 9. References

| Resource | URL |
|----------|-----|
| Microsoft REST API Guidelines | https://github.com/microsoft/api-guidelines |
| Google API Design Guide | https://cloud.google.com/apis/design |
| Zalando RESTful API Guidelines | https://opensource.zalando.com/restful-api-guidelines |
| HTTP Status Codes Reference | https://httpstatuses.com |
| RFC 7807 (Problem Details) | https://datatracker.ietf.org/doc/html/rfc7807 |
| REST API Tutorial | https://restfulapi.net |
| JSON:API Specification | https://jsonapi.org |
| OpenAPI Specification | https://swagger.io/specification |
