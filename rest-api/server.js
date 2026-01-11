/**
 * ============================================================================
 * REST API - Pagination & Filtering Implementation
 * ============================================================================
 * 
 * This file demonstrates complete pagination and filtering patterns for REST APIs.
 * Each pattern includes pros, cons, and when to use.
 * 
 * Run: npm install express
 *      node server.js
 * 
 * ============================================================================
 */

const express = require('express');
const app = express();
app.use(express.json());

/**
 * ============================================================================
 * MOCK DATABASE
 * ============================================================================
 */
const users = Array.from({ length: 150 }, (_, i) => ({
  id: i + 1,
  first_name: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'][i % 5],
  last_name: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown'][i % 5],
  email: `user${i + 1}@example.com`,
  age: 20 + (i % 40),
  status: ['active', 'inactive', 'pending'][i % 3],
  role: ['admin', 'user', 'moderator'][i % 3],
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
  department: ['Engineering', 'Sales', 'Marketing', 'Support'][i % 4],
  salary: 50000 + (i * 1000)
}));


/**
 * ============================================================================
 * PAGINATION METHOD 1: OFFSET-BASED (Traditional)
 * ============================================================================
 * 
 * How it works:
 *   - Client sends: page=2, limit=20 (or offset=20, limit=20)
 *   - Server skips first N records, returns next batch
 *   - SQL: SELECT * FROM users LIMIT 20 OFFSET 20
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PROS                                                                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ Simple to implement and understand                                   │
 * │ ✓ Client can jump to any page directly (page=50)                       │
 * │ ✓ Easy to show total pages and "Page X of Y"                           │
 * │ ✓ Works well with traditional UI pagination (1, 2, 3... buttons)       │
 * │ ✓ Stateless - no server-side cursor storage needed                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ CONS                                                                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✗ Performance degrades with large offsets (O(n) - must scan all rows)  │
 * │ ✗ Data inconsistency: new inserts/deletes shift pages                  │
 * │   - User on page 2, item deleted from page 1 → misses an item          │
 * │   - User on page 2, item added to page 1 → sees duplicate              │
 * │ ✗ Not suitable for real-time data or infinite scroll                   │
 * │ ✗ COUNT(*) for total can be expensive on large tables                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ WHEN TO USE                                                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • Admin dashboards with page number navigation                         │
 * │ • Small to medium datasets (< 10,000 records)                          │
 * │ • Data that doesn't change frequently                                  │
 * │ • When users need to jump to specific pages                            │
 * │ • Reports and data exports                                             │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ WHEN NOT TO USE                                                         │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • Large datasets (> 100,000 records)                                   │
 * │ • Real-time feeds (social media, chat, notifications)                  │
 * │ • Infinite scroll UIs                                                  │
 * │ • Data that changes frequently                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

app.get('/api/v1/users/offset', (req, res) => {
  // Parse pagination parameters
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  // In real DB: SELECT * FROM users LIMIT $limit OFFSET $offset
  // WARNING: Large offsets are slow! OFFSET 100000 scans 100000 rows first
  const paginatedUsers = users.slice(offset, offset + limit);
  const totalCount = users.length;
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    success: true,
    data: paginatedUsers,
    pagination: {
      // Current position
      page: page,
      limit: limit,
      offset: offset,
      
      // Totals (can be expensive to compute on large tables)
      total_count: totalCount,
      total_pages: totalPages,
      
      // Navigation helpers
      has_next: page < totalPages,
      has_prev: page > 1
    },
    // HATEOAS links for navigation
    links: {
      self: `/api/v1/users/offset?page=${page}&limit=${limit}`,
      first: `/api/v1/users/offset?page=1&limit=${limit}`,
      last: `/api/v1/users/offset?page=${totalPages}&limit=${limit}`,
      ...(page > 1 && { prev: `/api/v1/users/offset?page=${page - 1}&limit=${limit}` }),
      ...(page < totalPages && { next: `/api/v1/users/offset?page=${page + 1}&limit=${limit}` })
    }
  });
});


/**
 * ============================================================================
 * PAGINATION METHOD 2: CURSOR-BASED (Keyset Pagination)
 * ============================================================================
 * 
 * How it works:
 *   - Client sends: cursor=eyJpZCI6MTAwfQ (base64 encoded pointer)
 *   - Server decodes cursor, fetches records after that point
 *   - SQL: SELECT * FROM users WHERE id > 100 ORDER BY id LIMIT 20
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PROS                                                                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ Consistent performance O(1) regardless of position                   │
 * │   - Page 1 and page 1000 are equally fast                              │
 * │ ✓ No missing/duplicate items when data changes                         │
 * │ ✓ Perfect for infinite scroll and real-time feeds                      │
 * │ ✓ Works great with large datasets (millions of rows)                   │
 * │ ✓ Efficient with proper indexing (uses index seek, not scan)           │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ CONS                                                                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✗ Cannot jump to arbitrary page (no "go to page 50")                   │
 * │ ✗ Cannot easily show total count or "Page X of Y"                      │
 * │ ✗ More complex to implement, especially with multiple sort fields      │
 * │ ✗ Cursor can become invalid if referenced record is deleted            │
 * │ ✗ Harder to debug (opaque cursor vs. simple page number)               │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ WHEN TO USE                                                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • Infinite scroll UIs (mobile apps, social feeds)                      │
 * │ • Large datasets (> 10,000 records)                                    │
 * │ • Real-time data (notifications, activity feeds)                       │
 * │ • When data consistency during pagination is critical                  │
 * │ • API-first applications where clients iterate through all data        │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ WHEN NOT TO USE                                                         │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • Traditional page-number navigation is required                       │
 * │ • Users need to jump to specific pages                                 │
 * │ • Total count must be displayed                                        │
 * │ • Simple admin interfaces where offset is "good enough"                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

// Helper: Encode cursor (in production, consider encryption)
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

// Helper: Decode cursor
function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

app.get('/api/v1/users/cursor', (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const cursor = req.query.cursor;
  const direction = req.query.direction || 'forward'; // forward or backward

  let startIndex = 0;
  
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CURSOR', message: 'Invalid or expired cursor' }
      });
    }
    
    // Find position of cursor in dataset
    // In real DB: WHERE id > $cursor_id (for forward)
    const cursorIndex = users.findIndex(u => u.id === decoded.id);
    if (cursorIndex === -1) {
      return res.status(400).json({
        success: false,
        error: { code: 'CURSOR_NOT_FOUND', message: 'Cursor reference not found' }
      });
    }
    startIndex = cursorIndex + 1; // Start after cursor
  }

  // Fetch one extra to determine if there's a next page
  const paginatedUsers = users.slice(startIndex, startIndex + limit + 1);
  const hasMore = paginatedUsers.length > limit;
  const results = hasMore ? paginatedUsers.slice(0, limit) : paginatedUsers;

  // Build cursors
  const nextCursor = hasMore ? encodeCursor({ id: results[results.length - 1].id }) : null;
  const prevCursor = startIndex > 0 ? encodeCursor({ id: users[startIndex - 1].id }) : null;

  res.json({
    success: true,
    data: results,
    pagination: {
      limit: limit,
      has_more: hasMore,
      // Note: No total_count - this is intentional for cursor pagination
      // Computing total requires full table scan
    },
    cursors: {
      next: nextCursor,
      prev: prevCursor
    },
    links: {
      self: `/api/v1/users/cursor?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
      ...(nextCursor && { next: `/api/v1/users/cursor?limit=${limit}&cursor=${nextCursor}` }),
      ...(prevCursor && { prev: `/api/v1/users/cursor?limit=${limit}&cursor=${prevCursor}` })
    }
  });
});


/**
 * ============================================================================
 * PAGINATION METHOD 3: CURSOR-BASED WITH COMPOUND KEY
 * ============================================================================
 * 
 * For sorting by non-unique fields (e.g., created_at), we need a compound cursor
 * that includes both the sort field AND a unique tiebreaker (usually ID).
 * 
 * Example: Sort by created_at DESC
 *   - Two users created at same timestamp would have ambiguous order
 *   - Compound cursor: { created_at: "2024-01-15T10:00:00Z", id: 123 }
 *   - SQL: WHERE (created_at, id) < ($cursor_created_at, $cursor_id)
 *          ORDER BY created_at DESC, id DESC
 */

app.get('/api/v1/users/cursor-sorted', (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const cursor = req.query.cursor;
  const sortBy = req.query.sort_by || 'created_at';
  const sortOrder = req.query.sort_order || 'desc';

  // Sort users
  let sortedUsers = [...users].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  let startIndex = 0;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CURSOR', message: 'Invalid cursor' }
      });
    }

    // Find position using compound key (sort field + id)
    startIndex = sortedUsers.findIndex(u => {
      if (sortOrder === 'desc') {
        // For DESC: find first item where (sortField, id) < cursor
        return u[sortBy] < decoded.sort_value || 
               (u[sortBy] === decoded.sort_value && u.id < decoded.id);
      } else {
        // For ASC: find first item where (sortField, id) > cursor
        return u[sortBy] > decoded.sort_value || 
               (u[sortBy] === decoded.sort_value && u.id > decoded.id);
      }
    });

    if (startIndex === -1) startIndex = sortedUsers.length;
  }

  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + limit + 1);
  const hasMore = paginatedUsers.length > limit;
  const results = hasMore ? paginatedUsers.slice(0, limit) : paginatedUsers;

  // Compound cursor includes both sort field and ID
  const lastItem = results[results.length - 1];
  const nextCursor = hasMore && lastItem
    ? encodeCursor({ sort_value: lastItem[sortBy], id: lastItem.id })
    : null;

  res.json({
    success: true,
    data: results,
    pagination: {
      limit: limit,
      has_more: hasMore,
      sort_by: sortBy,
      sort_order: sortOrder
    },
    cursors: {
      next: nextCursor
    }
  });
});


/**
 * ============================================================================
 * FILTERING PATTERNS
 * ============================================================================
 * 
 * REST APIs typically use query parameters for filtering.
 * Below are common patterns from simple to advanced.
 */

app.get('/api/v1/users', (req, res) => {
  let filteredUsers = [...users];
  const appliedFilters = [];

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * FILTER PATTERN 1: Simple Equality
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * URL: /api/v1/users?status=active&role=admin
   * 
   * PROS:
   *   ✓ Very simple to understand and implement
   *   ✓ Easy to document
   *   ✓ Works well for exact matches
   * 
   * CONS:
   *   ✗ Limited to equality only (no ranges, no partial matches)
   *   ✗ Can get messy with many filters
   */
  if (req.query.status) {
    filteredUsers = filteredUsers.filter(u => u.status === req.query.status);
    appliedFilters.push({ field: 'status', operator: 'eq', value: req.query.status });
  }

  if (req.query.role) {
    filteredUsers = filteredUsers.filter(u => u.role === req.query.role);
    appliedFilters.push({ field: 'role', operator: 'eq', value: req.query.role });
  }

  if (req.query.department) {
    filteredUsers = filteredUsers.filter(u => u.department === req.query.department);
    appliedFilters.push({ field: 'department', operator: 'eq', value: req.query.department });
  }


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * FILTER PATTERN 2: Range Filters
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * URL: /api/v1/users?age_min=25&age_max=35
   * URL: /api/v1/users?created_after=2024-01-01&created_before=2024-12-31
   * URL: /api/v1/users?salary_gte=50000&salary_lte=100000
   * 
   * PROS:
   *   ✓ Clear naming convention
   *   ✓ Works well for numeric and date ranges
   *   ✓ Easy to combine (min + max)
   * 
   * CONS:
   *   ✗ More parameters to document
   *   ✗ Naming conventions vary (_min/_max, _gte/_lte, _from/_to)
   * 
   * Common Conventions:
   *   - Suffix: _min/_max, _gte/_lte, _gt/_lt, _from/_to, _after/_before
   *   - Bracket: age[gte]=25, age[lte]=35
   */
  
  // Age range
  if (req.query.age_min) {
    const minAge = parseInt(req.query.age_min);
    filteredUsers = filteredUsers.filter(u => u.age >= minAge);
    appliedFilters.push({ field: 'age', operator: 'gte', value: minAge });
  }

  if (req.query.age_max) {
    const maxAge = parseInt(req.query.age_max);
    filteredUsers = filteredUsers.filter(u => u.age <= maxAge);
    appliedFilters.push({ field: 'age', operator: 'lte', value: maxAge });
  }

  // Date range
  if (req.query.created_after) {
    const afterDate = new Date(req.query.created_after);
    filteredUsers = filteredUsers.filter(u => new Date(u.created_at) >= afterDate);
    appliedFilters.push({ field: 'created_at', operator: 'gte', value: req.query.created_after });
  }

  if (req.query.created_before) {
    const beforeDate = new Date(req.query.created_before);
    filteredUsers = filteredUsers.filter(u => new Date(u.created_at) <= beforeDate);
    appliedFilters.push({ field: 'created_at', operator: 'lte', value: req.query.created_before });
  }

  // Salary range (using _gte/_lte convention)
  if (req.query.salary_gte) {
    const minSalary = parseInt(req.query.salary_gte);
    filteredUsers = filteredUsers.filter(u => u.salary >= minSalary);
    appliedFilters.push({ field: 'salary', operator: 'gte', value: minSalary });
  }

  if (req.query.salary_lte) {
    const maxSalary = parseInt(req.query.salary_lte);
    filteredUsers = filteredUsers.filter(u => u.salary <= maxSalary);
    appliedFilters.push({ field: 'salary', operator: 'lte', value: maxSalary });
  }


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * FILTER PATTERN 3: Array/Multiple Values (IN operator)
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * URL: /api/v1/users?status=active,pending
   * URL: /api/v1/users?status[]=active&status[]=pending
   * URL: /api/v1/users?department=Engineering,Sales
   * 
   * PROS:
   *   ✓ Filter by multiple values in one parameter
   *   ✓ More efficient than multiple API calls
   * 
   * CONS:
   *   ✗ Need to decide on format (comma-separated vs array notation)
   *   ✗ Parsing is more complex
   */
  if (req.query.statuses) {
    const statusList = req.query.statuses.split(',').map(s => s.trim());
    filteredUsers = filteredUsers.filter(u => statusList.includes(u.status));
    appliedFilters.push({ field: 'status', operator: 'in', value: statusList });
  }

  if (req.query.departments) {
    const deptList = req.query.departments.split(',').map(d => d.trim());
    filteredUsers = filteredUsers.filter(u => deptList.includes(u.department));
    appliedFilters.push({ field: 'department', operator: 'in', value: deptList });
  }


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * FILTER PATTERN 4: Search / Partial Match
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * URL: /api/v1/users?search=john
   * URL: /api/v1/users?q=john
   * URL: /api/v1/users?name_contains=john
   * 
   * PROS:
   *   ✓ Flexible searching across fields
   *   ✓ User-friendly for search boxes
   * 
   * CONS:
   *   ✗ Can be slow without proper indexing (full-text search)
   *   ✗ Need to decide which fields to search
   */
  if (req.query.search || req.query.q) {
    const searchTerm = (req.query.search || req.query.q).toLowerCase();
    filteredUsers = filteredUsers.filter(u =>
      u.first_name.toLowerCase().includes(searchTerm) ||
      u.last_name.toLowerCase().includes(searchTerm) ||
      u.email.toLowerCase().includes(searchTerm)
    );
    appliedFilters.push({ field: 'multi', operator: 'search', value: searchTerm });
  }

  // Field-specific partial match
  if (req.query.email_contains) {
    const term = req.query.email_contains.toLowerCase();
    filteredUsers = filteredUsers.filter(u => u.email.toLowerCase().includes(term));
    appliedFilters.push({ field: 'email', operator: 'contains', value: term });
  }


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * SORTING
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * URL: /api/v1/users?sort=created_at
   * URL: /api/v1/users?sort=-created_at (descending with prefix)
   * URL: /api/v1/users?sort=last_name&order=asc
   * URL: /api/v1/users?sort=department,-salary (multi-field)
   * 
   * Common Conventions:
   *   - Prefix: -field for descending, +field or field for ascending
   *   - Separate param: sort=field&order=desc
   *   - Bracket: sort[field]=asc
   */
  if (req.query.sort) {
    const sortFields = req.query.sort.split(',');
    
    filteredUsers.sort((a, b) => {
      for (const field of sortFields) {
        const isDesc = field.startsWith('-');
        const fieldName = isDesc ? field.slice(1) : field.replace(/^\+/, '');
        
        let aVal = a[fieldName];
        let bVal = b[fieldName];
        
        // Handle different types
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return isDesc ? 1 : -1;
        if (aVal > bVal) return isDesc ? -1 : 1;
      }
      return 0;
    });
  }


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * FIELD SELECTION (Sparse Fieldsets)
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * URL: /api/v1/users?fields=id,first_name,email
   * 
   * PROS:
   *   ✓ Reduces payload size
   *   ✓ Client gets only what it needs
   *   ✓ Improves performance
   * 
   * CONS:
   *   ✗ More complex response handling
   *   ✗ Caching becomes harder (different field sets = different responses)
   */
  let selectedFields = null;
  if (req.query.fields) {
    selectedFields = req.query.fields.split(',').map(f => f.trim());
  }


  // Apply pagination (offset-based for this combined endpoint)
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const totalCount = filteredUsers.length;
  const totalPages = Math.ceil(totalCount / limit);
  let paginatedUsers = filteredUsers.slice(offset, offset + limit);

  // Apply field selection
  if (selectedFields) {
    paginatedUsers = paginatedUsers.map(user => {
      const filtered = {};
      selectedFields.forEach(field => {
        if (user.hasOwnProperty(field)) {
          filtered[field] = user[field];
        }
      });
      return filtered;
    });
  }

  res.json({
    success: true,
    data: paginatedUsers,
    meta: {
      filters_applied: appliedFilters,
      fields_selected: selectedFields,
      sort: req.query.sort || 'id'
    },
    pagination: {
      page: page,
      limit: limit,
      total_count: totalCount,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    }
  });
});


/**
 * ============================================================================
 * FILTER PATTERN 5: Filter Object (Advanced)
 * ============================================================================
 * 
 * For complex filtering, accept a JSON filter object.
 * 
 * POST /api/v1/users/search
 * Body: {
 *   "filters": {
 *     "status": { "eq": "active" },
 *     "age": { "gte": 25, "lte": 40 },
 *     "department": { "in": ["Engineering", "Sales"] },
 *     "email": { "contains": "@gmail.com" }
 *   },
 *   "sort": [
 *     { "field": "created_at", "order": "desc" }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20
 *   }
 * }
 * 
 * PROS:
 *   ✓ Very flexible and powerful
 *   ✓ Complex queries possible
 *   ✓ Consistent structure
 * 
 * CONS:
 *   ✗ Not cacheable (POST request)
 *   ✗ More complex to implement
 *   ✗ Harder to share URLs
 *   ✗ Security concerns (injection attacks)
 */

app.post('/api/v1/users/search', (req, res) => {
  let filteredUsers = [...users];
  const { filters = {}, sort = [], pagination = {} } = req.body;

  // Apply filters
  Object.entries(filters).forEach(([field, conditions]) => {
    Object.entries(conditions).forEach(([operator, value]) => {
      switch (operator) {
        case 'eq':
          filteredUsers = filteredUsers.filter(u => u[field] === value);
          break;
        case 'neq':
          filteredUsers = filteredUsers.filter(u => u[field] !== value);
          break;
        case 'gt':
          filteredUsers = filteredUsers.filter(u => u[field] > value);
          break;
        case 'gte':
          filteredUsers = filteredUsers.filter(u => u[field] >= value);
          break;
        case 'lt':
          filteredUsers = filteredUsers.filter(u => u[field] < value);
          break;
        case 'lte':
          filteredUsers = filteredUsers.filter(u => u[field] <= value);
          break;
        case 'in':
          filteredUsers = filteredUsers.filter(u => value.includes(u[field]));
          break;
        case 'nin':
          filteredUsers = filteredUsers.filter(u => !value.includes(u[field]));
          break;
        case 'contains':
          filteredUsers = filteredUsers.filter(u => 
            String(u[field]).toLowerCase().includes(value.toLowerCase())
          );
          break;
        case 'starts_with':
          filteredUsers = filteredUsers.filter(u => 
            String(u[field]).toLowerCase().startsWith(value.toLowerCase())
          );
          break;
      }
    });
  });

  // Apply sorting
  if (sort.length > 0) {
    filteredUsers.sort((a, b) => {
      for (const { field, order = 'asc' } of sort) {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal < bVal) return order === 'desc' ? 1 : -1;
        if (aVal > bVal) return order === 'desc' ? -1 : 1;
      }
      return 0;
    });
  }

  // Apply pagination
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const offset = (page - 1) * limit;
  
  const totalCount = filteredUsers.length;
  const paginatedUsers = filteredUsers.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedUsers,
    meta: {
      filters: filters,
      sort: sort
    },
    pagination: {
      page: page,
      limit: limit,
      total_count: totalCount,
      total_pages: Math.ceil(totalCount / limit)
    }
  });
});


/**
 * ============================================================================
 * START SERVER
 * ============================================================================
 */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`REST API running on http://localhost:${PORT}`);
  console.log(`
Available endpoints:
  GET  /api/v1/users/offset          - Offset pagination
  GET  /api/v1/users/cursor          - Cursor pagination
  GET  /api/v1/users/cursor-sorted   - Cursor with sorting
  GET  /api/v1/users                 - Filtering + sorting + pagination
  POST /api/v1/users/search          - Advanced filter object

Example requests:
  Offset:  curl "http://localhost:${PORT}/api/v1/users/offset?page=2&limit=10"
  Cursor:  curl "http://localhost:${PORT}/api/v1/users/cursor?limit=10"
  Filter:  curl "http://localhost:${PORT}/api/v1/users?status=active&age_min=25&sort=-created_at"
  Search:  curl -X POST "http://localhost:${PORT}/api/v1/users/search" -H "Content-Type: application/json" -d '{"filters":{"status":{"eq":"active"}}}'
  `);
});
