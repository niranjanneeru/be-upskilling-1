/**
 * ============================================================================
 * gRPC API - Pagination & Filtering Implementation
 * ============================================================================
 * 
 * This file demonstrates complete pagination and filtering patterns for gRPC.
 * Each pattern includes pros, cons, and when to use.
 * 
 * Setup:
 *   npm install
 *   node server.js
 * 
 * Note: This is a simplified implementation using dynamic proto loading.
 * In production, you would compile the .proto file and use generated code.
 * 
 * ============================================================================
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

/**
 * ============================================================================
 * MOCK DATABASE
 * ============================================================================
 */
const users = Array.from({ length: 150 }, (_, i) => ({
  id: String(i + 1),
  first_name: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'][i % 5],
  last_name: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown'][i % 5],
  email: `user${i + 1}@example.com`,
  age: 20 + (i % 40),
  status: [1, 2, 3][i % 3], // ACTIVE=1, INACTIVE=2, PENDING=3
  role: [1, 2, 3][i % 3],   // ADMIN=1, USER=2, MODERATOR=3
  created_at: { seconds: Math.floor((Date.now() - i * 86400000) / 1000), nanos: 0 },
  department: ['Engineering', 'Sales', 'Marketing', 'Support'][i % 4],
  salary: 50000 + (i * 1000)
}));


/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

// Encode cursor (base64)
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

// Decode cursor
function decodeCursor(cursor) {
  try {
    if (!cursor) return null;
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Apply filters to user list
 */
function applyFilters(userList, filter) {
  if (!filter) return userList;

  let result = [...userList];

  // Status equality filter
  if (filter.status && filter.status !== 0) {
    result = result.filter(u => u.status === filter.status);
  }

  // Status IN filter
  if (filter.statuses && filter.statuses.length > 0) {
    result = result.filter(u => filter.statuses.includes(u.status));
  }

  // Role filter
  if (filter.role && filter.role !== 0) {
    result = result.filter(u => u.role === filter.role);
  }

  // Department equality
  if (filter.department) {
    result = result.filter(u => u.department === filter.department);
  }

  // Department IN filter
  if (filter.departments && filter.departments.length > 0) {
    result = result.filter(u => filter.departments.includes(u.department));
  }

  // Age range filters (using wrapper types)
  if (filter.age_min && filter.age_min.value !== undefined) {
    result = result.filter(u => u.age >= filter.age_min.value);
  }

  if (filter.age_max && filter.age_max.value !== undefined) {
    result = result.filter(u => u.age <= filter.age_max.value);
  }

  if (filter.age_eq && filter.age_eq.value !== undefined) {
    result = result.filter(u => u.age === filter.age_eq.value);
  }

  // Salary range filters
  if (filter.salary_min && filter.salary_min.value !== undefined) {
    result = result.filter(u => u.salary >= filter.salary_min.value);
  }

  if (filter.salary_max && filter.salary_max.value !== undefined) {
    result = result.filter(u => u.salary <= filter.salary_max.value);
  }

  // Text search
  if (filter.search) {
    const term = filter.search.toLowerCase();
    result = result.filter(u =>
      u.first_name.toLowerCase().includes(term) ||
      u.last_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }

  // Email contains
  if (filter.email_contains) {
    const term = filter.email_contains.toLowerCase();
    result = result.filter(u => u.email.toLowerCase().includes(term));
  }

  // ID list filter (batch lookup)
  if (filter.ids && filter.ids.length > 0) {
    result = result.filter(u => filter.ids.includes(u.id));
  }

  return result;
}

/**
 * Apply sorting
 */
function applySorting(userList, sort) {
  if (!sort || !sort.field || sort.field === 0) {
    return userList;
  }

  const fieldMap = {
    1: 'created_at',
    2: 'first_name',
    3: 'last_name',
    4: 'email',
    5: 'age',
    6: 'salary'
  };

  const field = fieldMap[sort.field];
  if (!field) return userList;

  const isDesc = sort.order === 2; // DESC

  return [...userList].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

    // Handle timestamp comparison
    if (field === 'created_at') {
      aVal = aVal.seconds;
      bVal = bVal.seconds;
    }

    // Handle string comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return isDesc ? 1 : -1;
    if (aVal > bVal) return isDesc ? -1 : 1;
    return 0;
  });
}

/**
 * Calculate search relevance score
 */
function calculateSearchScore(user, query) {
  const term = query.toLowerCase();
  let score = 0;

  // Exact match on email = highest score
  if (user.email.toLowerCase() === term) score += 100;
  else if (user.email.toLowerCase().includes(term)) score += 30;

  // Name matches
  const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
  if (fullName === term) score += 80;
  else if (fullName.includes(term)) score += 40;

  // First name starts with query
  if (user.first_name.toLowerCase().startsWith(term)) score += 20;

  // Last name starts with query
  if (user.last_name.toLowerCase().startsWith(term)) score += 20;

  return score;
}


/**
 * ============================================================================
 * SERVICE IMPLEMENTATIONS
 * ============================================================================
 */

const serviceImplementation = {
  /**
   * ──────────────────────────────────────────────────────────────────────────
   * GET USER (Unary RPC)
   * ──────────────────────────────────────────────────────────────────────────
   */
  GetUser: (call, callback) => {
    const { id } = call.request;
    const user = users.find(u => u.id === id);

    if (!user) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `User with id ${id} not found`
      });
    }

    callback(null, user);
  },


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * LIST USERS - OFFSET PAGINATION (Unary RPC)
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ PROS                                                                    │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ✓ Simple to understand and implement                                   │
   * │ ✓ Can jump to any page directly (page_number=50)                       │
   * │ ✓ Easy to show "Page X of Y" in UI                                     │
   * │ ✓ Works well with traditional pagination controls                      │
   * └─────────────────────────────────────────────────────────────────────────┘
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ CONS                                                                    │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ✗ Performance degrades with large page numbers (OFFSET is O(n))        │
   * │ ✗ Data inconsistency: inserts/deletes shift items between pages        │
   * │ ✗ total_count requires COUNT(*) which can be slow                      │
   * └─────────────────────────────────────────────────────────────────────────┘
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ WHEN TO USE                                                             │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ • Admin dashboards with page number navigation                         │
   * │ • Small to medium datasets (< 10,000 records)                          │
   * │ • Data that doesn't change frequently                                  │
   * │ • When users need to jump to specific pages                            │
   * └─────────────────────────────────────────────────────────────────────────┘
   */
  ListUsersOffset: (call, callback) => {
    const { page_size = 20, page_number = 1, filter, sort } = call.request;

    // Validate and constrain page size
    const limit = Math.min(100, Math.max(1, page_size));
    const page = Math.max(1, page_number);
    const offset = (page - 1) * limit;

    // Apply filters and sorting
    let filteredUsers = applyFilters(users, filter);
    filteredUsers = applySorting(filteredUsers, sort);

    // Calculate pagination metadata
    const totalCount = filteredUsers.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Get page of results
    const pageUsers = filteredUsers.slice(offset, offset + limit);

    callback(null, {
      users: pageUsers,
      total_count: totalCount,
      total_pages: totalPages,
      current_page: page,
      has_next_page: page < totalPages,
      has_previous_page: page > 1
    });
  },


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * LIST USERS - CURSOR PAGINATION (Unary RPC)
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ PROS                                                                    │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ✓ Consistent O(1) performance regardless of position                   │
   * │ ✓ No missing/duplicate items when data changes                         │
   * │ ✓ Perfect for infinite scroll and real-time feeds                      │
   * │ ✓ Scales to millions of records                                        │
   * └─────────────────────────────────────────────────────────────────────────┘
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ CONS                                                                    │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ✗ Cannot jump to arbitrary page                                        │
   * │ ✗ Cannot easily show "Page X of Y"                                     │
   * │ ✗ More complex to implement (especially with multi-field sorting)      │
   * │ ✗ Cursor can become invalid if referenced record is deleted            │
   * └─────────────────────────────────────────────────────────────────────────┘
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ WHEN TO USE                                                             │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ • Large datasets (> 10,000 records)                                    │
   * │ • Infinite scroll UIs                                                  │
   * │ • Real-time feeds (notifications, activity, chat)                      │
   * │ • Mobile applications (memory/bandwidth efficiency)                    │
   * │ • When data consistency during pagination is critical                  │
   * └─────────────────────────────────────────────────────────────────────────┘
   */
  ListUsersCursor: (call, callback) => {
    const { page_size = 20, page_token, filter, sort } = call.request;

    // Validate page size
    const limit = Math.min(100, Math.max(1, page_size));

    // Apply filters and sorting
    let filteredUsers = applyFilters(users, filter);
    filteredUsers = applySorting(filteredUsers, sort);

    // Find start position from cursor
    let startIndex = 0;
    if (page_token) {
      const decoded = decodeCursor(page_token);
      if (decoded) {
        const cursorIndex = filteredUsers.findIndex(u => u.id === decoded.id);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }
    }

    // Get page of results (fetch one extra to check for more)
    const pageUsers = filteredUsers.slice(startIndex, startIndex + limit + 1);
    const hasMore = pageUsers.length > limit;
    const results = hasMore ? pageUsers.slice(0, limit) : pageUsers;

    // Build next page token
    const nextPageToken = hasMore && results.length > 0
      ? encodeCursor({ id: results[results.length - 1].id })
      : '';

    callback(null, {
      users: results,
      next_page_token: nextPageToken,
      has_more: hasMore,
      total_count: { value: filteredUsers.length }
    });
  },


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * STREAM USERS - SERVER STREAMING RPC
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ PROS                                                                    │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ✓ No pagination needed - streams all results                           │
   * │ ✓ Memory efficient - client processes one item at a time               │
   * │ ✓ Real-time delivery of results                                        │
   * │ ✓ Perfect for data exports and synchronization                         │
   * │ ✓ Client can cancel stream at any time                                 │
   * │ ✓ Backpressure handling built into gRPC                                │
   * └─────────────────────────────────────────────────────────────────────────┘
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ CONS                                                                    │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ✗ Client must handle streaming (more complex than unary)               │
   * │ ✗ Cannot "go back" or jump to specific position                        │
   * │ ✗ Connection must stay open for duration                               │
   * │ ✗ Error handling is more complex (partial results)                     │
   * │ ✗ Not cacheable                                                        │
   * └─────────────────────────────────────────────────────────────────────────┘
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ WHEN TO USE                                                             │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ • Data exports (CSV, reports, backups)                                 │
   * │ • Large data synchronization between services                          │
   * │ • Real-time event feeds                                                │
   * │ • ETL pipelines                                                        │
   * │ • When client needs ALL matching data                                  │
   * │ • Webhook delivery systems                                             │
   * └─────────────────────────────────────────────────────────────────────────┘
   */
  StreamUsers: (call) => {
    const { filter, sort, limit = 0 } = call.request;

    // Apply filters and sorting
    let filteredUsers = applyFilters(users, filter);
    filteredUsers = applySorting(filteredUsers, sort);

    // Apply limit if specified
    if (limit > 0) {
      filteredUsers = filteredUsers.slice(0, limit);
    }

    // Stream each user with small delay to simulate real streaming
    let index = 0;
    
    const sendNext = () => {
      // Check if client cancelled
      if (call.cancelled) {
        return;
      }

      if (index < filteredUsers.length) {
        call.write(filteredUsers[index]);
        index++;
        // Use setImmediate for better performance, setTimeout for demo
        setImmediate(sendNext);
      } else {
        call.end();
      }
    };

    sendNext();

    // Handle client cancellation
    call.on('cancelled', () => {
      console.log('Stream cancelled by client');
    });
  },


  /**
   * ──────────────────────────────────────────────────────────────────────────
   * SEARCH USERS - FULL-TEXT SEARCH WITH RELEVANCE
   * ──────────────────────────────────────────────────────────────────────────
   * 
   * In production, use Elasticsearch, Algolia, or PostgreSQL full-text search.
   * This is a simplified implementation for demonstration.
   */
  SearchUsers: (call, callback) => {
    const { query, filter, page_size = 20, page_token, sort } = call.request;

    // Apply filters first
    let filteredUsers = applyFilters(users, filter);

    // Apply search with relevance scoring
    let searchResults = [];
    if (query) {
      searchResults = filteredUsers
        .map(user => ({
          user,
          score: calculateSearchScore(user, query),
          highlights: [] // In production, generate highlighted snippets
        }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score); // Sort by relevance
    } else {
      searchResults = filteredUsers.map(user => ({
        user,
        score: 1,
        highlights: []
      }));
    }

    // Apply additional sorting if specified
    if (sort && sort.field) {
      searchResults = applySorting(searchResults.map(r => r.user), sort)
        .map(user => searchResults.find(r => r.user.id === user.id));
    }

    // Cursor pagination
    const limit = Math.min(100, Math.max(1, page_size));
    let startIndex = 0;

    if (page_token) {
      const decoded = decodeCursor(page_token);
      if (decoded) {
        const cursorIndex = searchResults.findIndex(r => r.user.id === decoded.id);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }
    }

    const pageResults = searchResults.slice(startIndex, startIndex + limit + 1);
    const hasMore = pageResults.length > limit;
    const results = hasMore ? pageResults.slice(0, limit) : pageResults;

    const nextPageToken = hasMore && results.length > 0
      ? encodeCursor({ id: results[results.length - 1].user.id })
      : '';

    callback(null, {
      results: results,
      next_page_token: nextPageToken,
      has_more: hasMore,
      total_count: searchResults.length
    });
  }
};


/**
 * ============================================================================
 * SERVER SETUP
 * ============================================================================
 */

// Load proto file
const PROTO_PATH = path.join(__dirname, 'proto', 'user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: Number,
  defaults: true,
  oneofs: true,
  includeDirs: [path.join(__dirname, 'proto')]
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const userService = protoDescriptor.users.v1.UserService;

// Create and start server
function startServer() {
  const server = new grpc.Server();
  
  server.addService(userService.service, serviceImplementation);
  
  const port = process.env.PORT || 50051;
  
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('Failed to start server:', err);
        return;
      }
      
      server.start();
      console.log(`gRPC server running on port ${boundPort}`);
      console.log(`
Available RPCs:
  GetUser(id)                    - Get single user
  ListUsersOffset(...)           - Offset-based pagination
  ListUsersCursor(...)           - Cursor-based pagination
  StreamUsers(...)               - Server streaming (all results)
  SearchUsers(...)               - Full-text search with relevance

Example using grpcurl:

  # List methods
  grpcurl -plaintext localhost:${boundPort} list users.v1.UserService

  # Get user
  grpcurl -plaintext -d '{"id": "1"}' localhost:${boundPort} users.v1.UserService/GetUser

  # Offset pagination
  grpcurl -plaintext -d '{"page_size": 10, "page_number": 1}' \\
    localhost:${boundPort} users.v1.UserService/ListUsersOffset

  # Cursor pagination
  grpcurl -plaintext -d '{"page_size": 10}' \\
    localhost:${boundPort} users.v1.UserService/ListUsersCursor

  # With filter
  grpcurl -plaintext -d '{"page_size": 10, "filter": {"status": 1, "age_min": {"value": 25}}}' \\
    localhost:${boundPort} users.v1.UserService/ListUsersCursor

  # Stream users
  grpcurl -plaintext -d '{"filter": {"status": 1}, "limit": 5}' \\
    localhost:${boundPort} users.v1.UserService/StreamUsers

  # Search
  grpcurl -plaintext -d '{"query": "john", "page_size": 10}' \\
    localhost:${boundPort} users.v1.UserService/SearchUsers
      `);
    }
  );
}

startServer();
