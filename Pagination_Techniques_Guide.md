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

## Full-Text Search (Elasticsearch)

### When to Use
- Very large datasets (millions of documents)
- Complex search requirements
- Need for facets, aggregations
- Multi-language support
- Real-time indexing

### Index Mapping
```json
PUT /articles
{
  "mappings": {
    "properties": {
      "title": { 
        "type": "text",
        "analyzer": "english",
        "boost": 2.0
      },
      "body": { 
        "type": "text",
        "analyzer": "english"
      },
      "tags": { 
        "type": "keyword"
      },
      "created_at": { 
        "type": "date"
      }
    }
  }
}
```

### Search Query
```json
POST /articles/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "database optimization",
            "fields": ["title^2", "body"],
            "type": "best_fields"
          }
        }
      ],
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "created_at": { "gte": "2024-01-01" } } }
      ]
    }
  },
  "highlight": {
    "fields": {
      "body": { "fragment_size": 150 }
    }
  },
  "from": 0,
  "size": 20
}
```

### Response
```json
{
  "hits": {
    "total": { "value": 42 },
    "hits": [
      {
        "_score": 12.5,
        "_source": {
          "title": "Database Optimization Techniques",
          "body": "..."
        },
        "highlight": {
          "body": ["...improve <em>database</em> <em>optimization</em>..."]
        }
      }
    ]
  }
}
```

### Used By
- E-commerce product search
- Log analysis (ELK stack)
- Large-scale applications

---

## Full-Text Search (Algolia)

### When to Use
- Need instant search (< 50ms)
- Typo tolerance required
- Managed service preferred
- E-commerce search

### Index Setup
```javascript
const algoliasearch = require('algoliasearch');
const client = algoliasearch('APP_ID', 'API_KEY');
const index = client.initIndex('articles');

// Configure index
index.setSettings({
  searchableAttributes: ['title', 'body', 'tags'],
  attributesForFaceting: ['category', 'author'],
  customRanking: ['desc(views)', 'desc(created_at)']
});

// Add records
index.saveObjects(articles, { autoGenerateObjectIDIfNotExist: true });
```

### Search
```javascript
const results = await index.search('database optimization', {
  filters: 'category:tech AND created_at > 1704067200',
  hitsPerPage: 20,
  page: 0,
  attributesToHighlight: ['title', 'body'],
  facets: ['category', 'author']
});
```

### Response
```json
{
  "hits": [
    {
      "title": "Database Optimization",
      "_highlightResult": {
        "title": {
          "value": "<em>Database</em> <em>Optimization</em>"
        }
      }
    }
  ],
  "nbHits": 42,
  "page": 0,
  "nbPages": 3,
  "facets": {
    "category": { "tech": 30, "tutorial": 12 }
  }
}
```

### Used By
- Stripe documentation
- Twitch
- Medium
- Many e-commerce sites

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

### Supported Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{ "status": { "eq": "active" } }` |
| `not_eq` / `ne` | Not equals | `{ "status": { "ne": "deleted" } }` |
| `gt` | Greater than | `{ "age": { "gt": 18 } }` |
| `gte` | Greater than or equal | `{ "age": { "gte": 21 } }` |
| `lt` | Less than | `{ "price": { "lt": 100 } }` |
| `lte` | Less than or equal | `{ "price": { "lte": 99.99 } }` |
| `in` | In array | `{ "status": { "in": ["a", "b"] } }` |
| `nin` / `not_in` | Not in array | `{ "role": { "nin": ["guest"] } }` |
| `contains` | Contains substring | `{ "name": { "contains": "john" } }` |
| `starts` | Starts with | `{ "email": { "starts": "admin" } }` |
| `ends` | Ends with | `{ "email": { "ends": ".com" } }` |
| `is_null` | Is null | `{ "phone": { "is_null": true } }` |
| `is_not_null` | Is not null | `{ "email": { "is_not_null": true } }` |

### Used By
- Complex admin interfaces
- Report builders
- Advanced search UIs

---

## GraphQL Filtering

### Schema
```graphql
input UserFilter {
  status: UserStatus
  status_in: [UserStatus!]
  age_gte: Int
  age_lte: Int
  department: String
  department_in: [String!]
  search: String
  created_after: DateTime
  created_before: DateTime
  
  # Logical operators
  AND: [UserFilter!]
  OR: [UserFilter!]
  NOT: UserFilter
}

type Query {
  users(
    filter: UserFilter
    sort: UserSort
    first: Int
    after: String
  ): UserConnection!
}
```

### Query
```graphql
query {
  users(
    filter: {
      status: ACTIVE
      age_gte: 25
      department_in: ["Engineering", "Sales"]
      OR: [
        { search: "john" }
        { search: "jane" }
      ]
    }
    sort: { field: CREATED_AT, order: DESC }
    first: 20
  ) {
    edges {
      node {
        id
        name
        email
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Used By
- GitHub GraphQL API
- Shopify Storefront API
- Modern GraphQL APIs

---

## Filtering Comparison

| Method | Complexity | Flexibility | Performance | Use Case |
|--------|------------|-------------|-------------|----------|
| Simple Equality | Low | Low | Fast | Basic filters |
| Range Filters | Low | Medium | Fast | Numeric/date ranges |
| LIKE/Pattern | Low | Medium | Medium | Simple text search |
| tsvector | Medium | High | Fast | PostgreSQL full-text |
| Elasticsearch | High | Very High | Very Fast | Large-scale search |
| Algolia | Medium | High | Very Fast | Instant search |
| Filter Object | Medium | Very High | Varies | Complex queries |

---

## Quick Reference

### Pagination
| Method | Parameter | Best For |
|--------|-----------|----------|
| Offset | `?page=2&limit=20` | Admin dashboards |
| Cursor | `?cursor=abc&limit=20` | Infinite scroll |
| Page Token | `?page_token=xyz` | Hide internals |

### Filtering
| Type | Parameter | Example |
|------|-----------|---------|
| Equality | `?status=active` | Single value match |
| Range | `?age_gte=25&age_lte=40` | Numeric ranges |
| Array | `?status=a,b,c` | Multiple values |
| Search | `?q=search+term` | Text search |
| Pattern | `?name_like=john` | Partial match |

### Full-Text Search
| Method | Best For |
|--------|----------|
| LIKE | Simple, small data |
| tsvector | PostgreSQL, medium data |
| Elasticsearch | Large scale, complex |
| Algolia | Instant search, typo tolerance |
