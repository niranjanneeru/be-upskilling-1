# API Pagination & Filtering - Code Examples

Complete implementations of pagination and filtering patterns in REST, GraphQL, and gRPC.

---

## Quick Start

```bash
# REST API
cd rest-api && npm install && npm start
# → http://localhost:3000

# GraphQL API
cd graphql-api && npm install && npm start
# → http://localhost:4000 (GraphQL Playground)

# gRPC API
cd grpc-api && npm install && npm start
# → localhost:50051
```

---

## Pagination Methods Comparison

### 1. Offset-Based Pagination

| Aspect | REST | GraphQL | gRPC |
|--------|------|---------|------|
| **Parameters** | `?page=2&limit=20` | `limit: 20, offset: 20` | `page_size: 20, page_number: 2` |
| **Response** | `page`, `total_pages`, `total_count` | `totalCount`, `pageInfo` | `total_count`, `total_pages`, `current_page` |

**PROS:**
- ✓ Simple to implement and understand
- ✓ Can jump to any page directly
- ✓ Easy to show "Page X of Y"
- ✓ Works with traditional pagination UI

**CONS:**
- ✗ Performance degrades with large offsets (O(n) scan)
- ✗ Data inconsistency with inserts/deletes during pagination
- ✗ Not suitable for real-time data

**WHEN TO USE:**
- Admin dashboards with page navigation
- Small datasets (< 10,000 records)
- Data that doesn't change frequently
- When users need to jump to specific pages

---

### 2. Cursor-Based Pagination

| Aspect | REST | GraphQL | gRPC |
|--------|------|---------|------|
| **Parameters** | `?cursor=abc123&limit=20` | `first: 20, after: "abc123"` | `page_size: 20, page_token: "abc123"` |
| **Response** | `next_cursor`, `has_more` | `edges`, `pageInfo`, `endCursor` | `next_page_token`, `has_more` |

**PROS:**
- ✓ Consistent O(1) performance regardless of position
- ✓ No missing/duplicate items when data changes
- ✓ Perfect for infinite scroll
- ✓ Scales to millions of records

**CONS:**
- ✗ Cannot jump to arbitrary page
- ✗ Cannot easily show "Page X of Y"
- ✗ More complex implementation
- ✗ Cursor can become invalid if referenced record deleted

**WHEN TO USE:**
- Large datasets (> 10,000 records)
- Infinite scroll UIs
- Real-time feeds (notifications, activity)
- Mobile applications
- When data consistency is critical

---

### 3. Server Streaming (gRPC only)

**PROS:**
- ✓ No pagination needed - streams all results
- ✓ Memory efficient - process one item at a time
- ✓ Real-time delivery
- ✓ Client can cancel anytime

**CONS:**
- ✗ Connection must stay open
- ✗ Cannot jump or go back
- ✗ More complex error handling

**WHEN TO USE:**
- Data exports
- Large data synchronization
- Real-time event feeds
- ETL pipelines

---

## Filtering Patterns Comparison

### Simple Equality

| REST | GraphQL | gRPC |
|------|---------|------|
| `?status=active` | `filter: { status: ACTIVE }` | `filter: { status: 1 }` |

### Range Filters

| REST | GraphQL | gRPC |
|------|---------|------|
| `?age_min=25&age_max=40` | `filter: { ageGte: 25, ageLte: 40 }` | `filter: { age_min: {value: 25}, age_max: {value: 40} }` |

### Multiple Values (IN)

| REST | GraphQL | gRPC |
|------|---------|------|
| `?statuses=active,pending` | `filter: { statusIn: [ACTIVE, PENDING] }` | `filter: { statuses: [1, 3] }` |

### Text Search

| REST | GraphQL | gRPC |
|------|---------|------|
| `?search=john` | `filter: { search: "john" }` | `filter: { search: "john" }` |

---

## API Endpoints Summary

### REST API (Port 3000)

```bash
# Offset pagination
GET /api/v1/users/offset?page=1&limit=20

# Cursor pagination
GET /api/v1/users/cursor?limit=20&cursor=xyz

# Combined filtering + pagination
GET /api/v1/users?status=active&age_min=25&sort=-created_at&page=1

# Advanced filter (POST)
POST /api/v1/users/search
```

### GraphQL API (Port 4000)

```graphql
# Offset pagination
query {
  usersOffset(limit: 20, offset: 0, filter: { status: ACTIVE }) {
    items { id firstName }
    totalCount
    pageInfo { hasNextPage }
  }
}

# Cursor pagination (Relay)
query {
  users(first: 20, filter: { ageGte: 25 }) {
    edges {
      cursor
      node { id firstName }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### gRPC API (Port 50051)

```bash
# Offset pagination
grpcurl -d '{"page_size": 20, "page_number": 1}' \
  localhost:50051 users.v1.UserService/ListUsersOffset

# Cursor pagination
grpcurl -d '{"page_size": 20}' \
  localhost:50051 users.v1.UserService/ListUsersCursor

# Streaming
grpcurl -d '{"filter": {"status": 1}}' \
  localhost:50051 users.v1.UserService/StreamUsers
```

---

## Decision Matrix

| Scenario | Offset | Cursor | Streaming |
|----------|--------|--------|-----------|
| Admin dashboard | ✓ Best | ○ OK | ✗ No |
| Infinite scroll | ✗ No | ✓ Best | ✗ No |
| Real-time feed | ✗ No | ✓ Best | ○ OK |
| Data export | ✗ No | ○ OK | ✓ Best |
| Small dataset | ✓ Best | ○ OK | ○ OK |
| Large dataset | ✗ No | ✓ Best | ✓ Best |
| Jump to page | ✓ Best | ✗ No | ✗ No |
| Sync/ETL | ✗ No | ○ OK | ✓ Best |

---

## Files Structure

```
code-examples/
├── rest-api/
│   ├── package.json
│   └── server.js          # Express.js with full comments
│
├── graphql-api/
│   ├── package.json
│   └── server.js          # Apollo Server with full comments
│
└── grpc-api/
    ├── package.json
    ├── proto/
    │   └── user.proto     # Protocol Buffer definitions
    └── server.js          # gRPC server with full comments
```

---

## Key Takeaways

1. **Start with cursor pagination** for new APIs - it scales better
2. **Use offset only when** page jumping is required and dataset is small
3. **GraphQL Connections** (Relay spec) is the industry standard
4. **gRPC streaming** is powerful for exports and real-time
5. **Always set max limits** to prevent abuse
6. **Include has_more** flag - don't rely on empty results
7. **Make total_count optional** - it's expensive on large datasets
