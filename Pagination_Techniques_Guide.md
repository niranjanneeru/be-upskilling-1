# Pagination & Filtering Strategies
## Complete Implementation Guide

---

# Part 1: Pagination

---

## Offset-Based Pagination

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
- Spotify API

---

## Cursor-Based Pagination

**Also known as:** Keyset Pagination, Seek Pagination

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

### Cursor Encoding
```javascript
// Encode
const cursor = Buffer.from(JSON.stringify({ id: 100 })).toString('base64');
// Result: eyJpZCI6MTAwfQ

// Decode
const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
// Result: { id: 100 }
```

### Used By
- Twitter API
- Facebook Graph API
- Slack API
- Stripe API

---

## Page Token Pagination

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

### Token Contains (Encoded & Encrypted)
```json
{
  "offset": 100,
  "filter_hash": "abc123",
  "sort": "created_at",
  "direction": "desc",
  "version": 1,
  "expires": 1705312800
}
```

### Token Generation
```javascript
// Server generates token with internal state
function generatePageToken(state) {
  const payload = JSON.stringify({
    offset: state.offset,
    filter_hash: hashFilters(state.filters),
    sort: state.sort,
    version: 1
  });
  
  // Encrypt to hide internals
  return encrypt(payload, SECRET_KEY);
}

// Server decodes token
function decodePageToken(token) {
  const payload = decrypt(token, SECRET_KEY);
  return JSON.parse(payload);
}
```

### Used By
- Google APIs (YouTube, Drive, Cloud)
- Google Cloud Platform
- Kubernetes API

---

## Pagination Comparison

| Aspect | Offset | Cursor | Page Token |
|--------|--------|--------|------------|
| Jump to page | ✅ Yes | ❌ No | ❌ No |
| Show total | ✅ Easy | ⚠️ Expensive | ⚠️ Expensive |
| Performance | ❌ O(n) | ✅ O(1) | ✅ O(1) |
| Data consistency | ❌ Shifts | ✅ Stable | ✅ Stable |
| Implementation | ✅ Simple | ⚠️ Medium | ⚠️ Medium |
| Hides internals | ❌ No | ⚠️ Partial | ✅ Yes |
| Bookmarkable | ✅ Yes | ⚠️ Limited | ❌ No |

---

# Part 2: Filtering Strategies

---

## Simple Equality Filters

### Request
```
GET /api/users?status=active
GET /api/users?role=admin&department=engineering
```

### SQL
```sql
SELECT * FROM users 
WHERE status = 'active' 
AND role = 'admin' 
AND department = 'engineering'
```

### Implementation
```javascript
app.get('/api/users', (req, res) => {
  let query = 'SELECT * FROM users WHERE 1=1';
  const params = [];

  if (req.query.status) {
    query += ' AND status = $' + (params.length + 1);
    params.push(req.query.status);
  }

  if (req.query.role) {
    query += ' AND role = $' + (params.length + 1);
    params.push(req.query.role);
  }

  db.query(query, params);
});
```

### Used By
- Most REST APIs
- Simple CRUD applications

---

## Range Filters

### Request
```
GET /api/users?age_min=25&age_max=40
GET /api/users?created_after=2024-01-01&created_before=2024-12-31
GET /api/products?price_gte=100&price_lte=500
```

### Naming Conventions
| Convention | Example |
|------------|---------|
| `_min` / `_max` | `age_min=25&age_max=40` |
| `_gte` / `_lte` | `price_gte=100&price_lte=500` |
| `_gt` / `_lt` | `score_gt=90&score_lt=100` |
| `_from` / `_to` | `date_from=2024-01-01&date_to=2024-12-31` |
| `_after` / `_before` | `created_after=2024-01-01` |

### SQL
```sql
SELECT * FROM users 
WHERE age >= 25 
AND age <= 40
AND created_at >= '2024-01-01'
AND created_at <= '2024-12-31'
```

### Used By
- E-commerce (price ranges)
- Analytics dashboards (date ranges)
- Search applications

---

## Array / IN Filters

### Request
```
GET /api/users?status=active,pending,review
GET /api/users?status[]=active&status[]=pending
GET /api/products?category_in=electronics,clothing,books
```

### SQL
```sql
SELECT * FROM users 
WHERE status IN ('active', 'pending', 'review')
```

### Implementation
```javascript
if (req.query.status) {
  const statuses = req.query.status.split(',');
  query += ` AND status IN (${statuses.map((_, i) => '$' + (params.length + i + 1)).join(',')})`;
  params.push(...statuses);
}
```

### Used By
- Filtering by multiple categories
- Multi-select dropdowns
- Batch operations

---

## Negation Filters

### Request
```
GET /api/users?status_not=deleted
GET /api/users?role_nin=guest,banned
GET /api/products?category_ne=archived
```

### SQL
```sql
SELECT * FROM users 
WHERE status != 'deleted'
AND role NOT IN ('guest', 'banned')
```

### Used By
- Excluding specific items
- "Show all except" scenarios

---

## LIKE / Pattern Filters

### Request
```
GET /api/users?name_like=john
GET /api/users?email_starts=admin
GET /api/users?email_ends=@gmail.com
GET /api/users?name_contains=smith
```

### SQL
```sql
-- contains
SELECT * FROM users WHERE name ILIKE '%john%'

-- starts with
SELECT * FROM users WHERE email ILIKE 'admin%'

-- ends with
SELECT * FROM users WHERE email ILIKE '%@gmail.com'
```

### Implementation
```javascript
if (req.query.name_like) {
  query += ' AND name ILIKE $' + (params.length + 1);
  params.push('%' + req.query.name_like + '%');
}

if (req.query.email_starts) {
  query += ' AND email ILIKE $' + (params.length + 1);
  params.push(req.query.email_starts + '%');
}
```

### Used By
- Autocomplete
- Search suggestions
- Name/email lookups

---

## Full-Text Search (Simple)

### Request
```
GET /api/users?search=john developer
GET /api/users?q=machine learning
GET /api/articles?query=climate change
```

### SQL (Basic LIKE)
```sql
SELECT * FROM users 
WHERE (
  name ILIKE '%john%' 
  OR email ILIKE '%john%'
  OR bio ILIKE '%john%'
)
```

### Implementation
```javascript
if (req.query.search) {
  const term = '%' + req.query.search + '%';
  query += ` AND (name ILIKE $${params.length + 1} 
             OR email ILIKE $${params.length + 1}
             OR bio ILIKE $${params.length + 1})`;
  params.push(term);
}
```

### Used By
- Simple search boxes
- Quick filters

---

## Full-Text Search (PostgreSQL tsvector)

### What is tsvector?
PostgreSQL's built-in full-text search. Converts text to searchable tokens with stemming, ranking, and language support.

### Setup
```sql
-- Add tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Populate tsvector (combines title + body)
UPDATE articles SET search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(body, '')), 'B');

-- Create GIN index for fast search
CREATE INDEX articles_search_idx ON articles USING GIN(search_vector);

-- Auto-update trigger
CREATE TRIGGER articles_search_update
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.english', title, body);
```

### Request
```
GET /api/articles?q=database optimization
```

### SQL (tsvector)
```sql
-- Basic search
SELECT * FROM articles 
WHERE search_vector @@ plainto_tsquery('english', 'database optimization');

-- With ranking
SELECT *, ts_rank(search_vector, query) AS rank
FROM articles, plainto_tsquery('english', 'database optimization') query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- With headline (highlighted snippets)
SELECT 
  id,
  ts_headline('english', body, query) AS snippet,
  ts_rank(search_vector, query) AS rank
FROM articles, plainto_tsquery('english', 'database optimization') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### Query Types
| Function | Input | Use Case |
|----------|-------|----------|
| `plainto_tsquery` | `database optimization` | Simple search |
| `phraseto_tsquery` | `database optimization` | Exact phrase |
| `websearch_to_tsquery` | `database OR optimization -sql` | Google-style |
| `to_tsquery` | `database & optimization` | Manual operators |

### Weights
| Weight | Priority | Use For |
|--------|----------|---------|
| A | Highest | Title |
| B | High | Subtitle, summary |
| C | Medium | Body text |
| D | Low | Metadata, tags |

### Implementation
```javascript
app.get('/api/articles', async (req, res) => {
  if (req.query.q) {
    const result = await db.query(`
      SELECT 
        id, title, 
        ts_headline('english', body, query, 'MaxWords=50') AS snippet,
        ts_rank(search_vector, query) AS rank
      FROM articles, websearch_to_tsquery('english', $1) query
      WHERE search_vector @@ query
      ORDER BY rank DESC
      LIMIT 20
    `, [req.query.q]);
    
    res.json({ data: result.rows });
  }
});
```

### Used By
- Blog search
- Documentation search
- Content management systems

---

## Filter Object (Advanced)

### Request
```
POST /api/users/search
Content-Type: application/json

{
  "filters": {
    "status": { "eq": "active" },
    "age": { "gte": 25, "lte": 40 },
    "department": { "in": ["Engineering", "Sales"] },
    "email": { "contains": "@gmail.com" },
    "name": { "not_eq": "Admin" }
  },
  "search": {
    "query": "john developer",
    "fields": ["name", "bio"]
  },
  "sort": [
    { "field": "created_at", "order": "desc" },
    { "field": "name", "order": "asc" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```