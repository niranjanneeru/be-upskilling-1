# Pagination Techniques Guide
## All Major Pagination Methods

---

## 1. Offset-Based Pagination

**Also known as:** Page Number Pagination, Skip/Take, Limit/Offset

### Request
```
GET /api/users?page=3&limit=20
GET /api/users?offset=40&limit=20
```

### Response
```json
{
  "data": [...],
  "pagination": {
    "page": 3,
    "limit": 20,
    "offset": 40,
    "total_count": 500,
    "total_pages": 25,
    "has_next": true,
    "has_prev": true
  }
}
```

### SQL
```sql
SELECT * FROM users 
ORDER BY id 
LIMIT 20 OFFSET 40
```

### Used By
- Most traditional web applications
- Admin dashboards
- Simple REST APIs

---

## 2. Cursor-Based Pagination

**Also known as:** Keyset Pagination, Seek Pagination, Token-Based

### Request
```
GET /api/users?cursor=eyJpZCI6MTAwfQ&limit=20
GET /api/users?after=abc123&first=20
```

### Response
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "prev_cursor": "eyJpZCI6MTAxfQ",
    "has_more": true
  }
}
```

### SQL
```sql
-- Cursor decoded: { "id": 100 }
SELECT * FROM users 
WHERE id > 100 
ORDER BY id 
LIMIT 20
```

### Used By
- **Twitter API** (since_id, max_id)
- **Facebook Graph API**
- **Slack API**
- **Stripe API**
- **Shopify API**

---

## 3. Page Token Pagination

**Also known as:** Opaque Token, Continuation Token

### Request
```
GET /api/users?page_token=CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA
GET /api/users?pageToken=token123
```

### Response
```json
{
  "data": [...],
  "next_page_token": "CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA",
  "result_size": 20
}
```

### Token Contains (Encoded)
```json
{
  "offset": 100,
  "filter_hash": "abc123",
  "sort": "created_at",
  "version": 1
}
```

### Used By
- **Google APIs** (YouTube, Drive, Cloud)
- **Google Cloud Platform**
- **Kubernetes API**

---

## 4. Time-Based Pagination

**Also known as:** Temporal Pagination, Since/Until

### Request
```
GET /api/events?since=2024-01-15T10:00:00Z&limit=100
GET /api/events?from=1705312800&to=1705399200
GET /api/feed?until=2024-01-15T10:00:00Z&count=50
```

### Response
```json
{
  "data": [...],
  "oldest": "2024-01-15T09:00:00Z",
  "newest": "2024-01-15T10:00:00Z"
}
```

### SQL
```sql
SELECT * FROM events 
WHERE created_at > '2024-01-15T10:00:00Z' 
ORDER BY created_at 
LIMIT 100
```

### Used By
- **Twitter API** (created_at filters)
- **Facebook Feed API**
- Activity feeds
- Log aggregation systems

---

## 5. ID-Based Pagination

**Also known as:** Since ID, Max ID, Marker-Based

### Request
```
GET /api/messages?since_id=12345&count=50
GET /api/messages?max_id=12345&count=50
GET /api/items?starting_after=item_abc123
GET /api/items?ending_before=item_xyz789
```

### Response
```json
{
  "data": [...],
  "newest_id": "12395",
  "oldest_id": "12346",
  "has_more": true
}
```

### SQL
```sql
-- since_id (newer items)
SELECT * FROM messages 
WHERE id > 12345 
ORDER BY id ASC 
LIMIT 50

-- max_id (older items)
SELECT * FROM messages 
WHERE id < 12345 
ORDER BY id DESC 
LIMIT 50
```

### Used By
- **Twitter API** (since_id, max_id)
- **Stripe API** (starting_after, ending_before)
- **Twilio API**

---

## 6. Link Header Pagination (RFC 5988)

**Also known as:** Web Linking, HATEOAS Pagination

### Response Headers
```http
HTTP/1.1 200 OK
Link: <https://api.example.com/users?page=2>; rel="next",
      <https://api.example.com/users?page=10>; rel="last",
      <https://api.example.com/users?page=1>; rel="first",
      <https://api.example.com/users?page=1>; rel="prev"
X-Total-Count: 200
X-Page: 2
X-Per-Page: 20
```

### Response Body
```json
[
  {"id": 1, "name": "John"},
  {"id": 2, "name": "Jane"}
]
```

### Used By
- **GitHub API**
- **GitLab API**

---

## 7. GraphQL Connections (Relay Specification)

**Also known as:** Relay-Style Pagination, Edges/Nodes

### Request
```graphql
query {
  users(first: 10, after: "YXJyYXljb25uZWN0aW9uOjk=") {
    edges {
      cursor
      node {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### Response
```json
{
  "data": {
    "users": {
      "edges": [
        {
          "cursor": "YXJyYXljb25uZWN0aW9uOjEw",
          "node": { "id": "11", "name": "John" }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": true,
        "startCursor": "YXJyYXljb25uZWN0aW9uOjEw",
        "endCursor": "YXJyYXljb25uZWN0aW9uOjE5"
      },
      "totalCount": 500
    }
  }
}
```

### Arguments
| Argument | Description |
|----------|-------------|
| `first` | Return first N items |
| `after` | Return items after cursor |
| `last` | Return last N items |
| `before` | Return items before cursor |

### Used By
- **GitHub GraphQL API**
- **Shopify Storefront API**
- **Facebook GraphQL API**
- **Yelp GraphQL API**
- Most production GraphQL APIs

---

## Quick Reference Table

| Method | Example Parameter | Typical Response Field |
|--------|-------------------|----------------------|
| Offset | `page=2&limit=20` | `total_pages`, `total_count` |
| Cursor | `cursor=abc123` | `next_cursor`, `has_more` |
| Page Token | `page_token=xyz` | `next_page_token` |
| Time-Based | `since=2024-01-01` | `oldest`, `newest` |
| ID-Based | `since_id=123` | `max_id`, `min_id` |
| Link Header | — | `Link` header with rel |
| GraphQL | `first=10, after="x"` | `pageInfo`, `edges` |

---

## Real-World API Examples

| Company | API | Method |
|---------|-----|--------|
| **GitHub** | REST API | Link Header |
| **GitHub** | GraphQL API | Relay Connections |
| **Twitter** | API v2 | Cursor (pagination_token) |
| **Stripe** | REST API | ID-based (starting_after) |
| **Slack** | Web API | Cursor-based |
| **Google** | Cloud APIs | Page Token |
| **Facebook** | Graph API | Cursor-based |
| **Shopify** | REST API | Link Header |
| **Shopify** | GraphQL API | Relay Connections |
| **Twilio** | REST API | ID-based (PageToken) |
| **Notion** | REST API | Cursor-based |
| **Spotify** | Web API | Offset-based |
| **YouTube** | Data API | Page Token |

---

## References

| Resource | URL |
|----------|-----|
| Relay Connection Spec | https://relay.dev/graphql/connections.htm |
| RFC 5988 (Web Linking) | https://tools.ietf.org/html/rfc5988 |
| Slack Pagination | https://api.slack.com/docs/pagination |
| Stripe Pagination | https://stripe.com/docs/api/pagination |
| GitHub Pagination | https://docs.github.com/en/rest/guides/traversing-with-pagination |
| Google API Pagination | https://cloud.google.com/apis/design/design_patterns#list_pagination |
