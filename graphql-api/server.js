/**
 * ============================================================================
 * GraphQL API - Pagination & Filtering Implementation
 * ============================================================================
 * 
 * This file demonstrates complete pagination and filtering patterns for GraphQL.
 * Each pattern includes pros, cons, and when to use.
 * 
 * Run: npm install
 *      node server.js
 * 
 * ============================================================================
 */

const { ApolloServer, gql } = require('apollo-server');

/**
 * ============================================================================
 * MOCK DATABASE
 * ============================================================================
 */
const users = Array.from({ length: 150 }, (_, i) => ({
  id: String(i + 1),
  firstName: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'][i % 5],
  lastName: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown'][i % 5],
  email: `user${i + 1}@example.com`,
  age: 20 + (i % 40),
  status: ['ACTIVE', 'INACTIVE', 'PENDING'][i % 3],
  role: ['ADMIN', 'USER', 'MODERATOR'][i % 3],
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  department: ['Engineering', 'Sales', 'Marketing', 'Support'][i % 4],
  salary: 50000 + (i * 1000)
}));


/**
 * ============================================================================
 * GRAPHQL SCHEMA
 * ============================================================================
 */

const typeDefs = gql`
  """
  ============================================================================
  ENUMS
  ============================================================================
  """
  enum UserStatus {
    ACTIVE
    INACTIVE
    PENDING
  }

  enum UserRole {
    ADMIN
    USER
    MODERATOR
  }

  enum SortOrder {
    ASC
    DESC
  }

  """
  Sortable fields for users
  """
  enum UserSortField {
    CREATED_AT
    FIRST_NAME
    LAST_NAME
    EMAIL
    AGE
    SALARY
  }


  """
  ============================================================================
  CORE TYPES
  ============================================================================
  """
  type User {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    age: Int!
    status: UserStatus!
    role: UserRole!
    createdAt: String!
    department: String!
    salary: Int!
    
    # Computed field
    fullName: String!
  }


  """
  ============================================================================
  PAGINATION METHOD 1: SIMPLE LIST (No Pagination)
  ============================================================================
  
  When to use:
    • Small, bounded lists (< 100 items)
    • Dropdown options, enum values
    • Data that won't grow unbounded
  
  When NOT to use:
    • Any list that could grow large
    • User-generated content
    • Logs, events, transactions
  """
  type Query {
    """
    Simple list - returns all users (use only for small datasets!)
    WARNING: This doesn't scale. Use for demo purposes only.
    """
    allUsers: [User!]!


    """
    ============================================================================
    PAGINATION METHOD 2: OFFSET-BASED (Simple)
    ============================================================================
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ PROS                                                                    │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ ✓ Simple to implement and understand                                   │
    │ ✓ Easy to jump to specific page                                        │
    │ ✓ Can show total count and "Page X of Y"                               │
    │ ✓ Works with traditional pagination UI                                 │
    └─────────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ CONS                                                                    │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ ✗ Performance degrades with large offsets                              │
    │ ✗ Data inconsistency with inserts/deletes during pagination            │
    │ ✗ Not recommended by Relay specification                               │
    │ ✗ Doesn't work well with real-time data                                │
    └─────────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ WHEN TO USE                                                             │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ • Admin dashboards                                                     │
    │ • Small datasets (< 10K records)                                       │
    │ • When page jumping is required                                        │
    │ • Simple internal tools                                                │
    └─────────────────────────────────────────────────────────────────────────┘
    """
    usersOffset(
      "Number of items to return (max 100)"
      limit: Int = 20
      "Number of items to skip"
      offset: Int = 0
      "Filter criteria"
      filter: UserFilter
      "Sort order"
      sort: UserSort
    ): UserOffsetResult!


    """
    ============================================================================
    PAGINATION METHOD 3: CURSOR-BASED (Relay Connection Specification)
    ============================================================================
    
    This follows the Relay Connection Specification, the de facto standard
    for cursor-based pagination in GraphQL.
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ PROS                                                                    │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ ✓ Consistent performance O(1) regardless of position                   │
    │ ✓ No missing/duplicate items when data changes                         │
    │ ✓ Industry standard (Relay, Apollo, Shopify, GitHub all use this)      │
    │ ✓ Perfect for infinite scroll                                          │
    │ ✓ Supports forward and backward pagination                             │
    │ ✓ Works great with real-time subscriptions                             │
    └─────────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ CONS                                                                    │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ ✗ More complex to implement                                            │
    │ ✗ Cannot jump to arbitrary page                                        │
    │ ✗ More verbose schema (Connection, Edge, PageInfo types)               │
    │ ✗ Computing totalCount can still be expensive                          │
    │ ✗ Learning curve for developers new to GraphQL                         │
    └─────────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ WHEN TO USE                                                             │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ • Large datasets                                                       │
    │ • Infinite scroll UIs                                                  │
    │ • Real-time feeds                                                      │
    │ • Mobile applications                                                  │
    │ • Any production GraphQL API                                           │
    └─────────────────────────────────────────────────────────────────────────┘
    """
    users(
      "Returns the first n elements from the list"
      first: Int
      "Returns elements after the cursor"
      after: String
      "Returns the last n elements from the list"
      last: Int
      "Returns elements before the cursor"
      before: String
      "Filter criteria"
      filter: UserFilter
      "Sort order"
      sort: UserSort
    ): UserConnection!


    """
    Get a single user by ID (Node interface pattern)
    """
    user(id: ID!): User

    """
    Generic node lookup (Relay Global Object Identification)
    """
    node(id: ID!): Node
  }


  """
  ============================================================================
  OFFSET PAGINATION TYPES
  ============================================================================
  """
  type UserOffsetResult {
    "List of users"
    items: [User!]!
    
    "Pagination metadata"
    pageInfo: OffsetPageInfo!
    
    "Total count of matching items"
    totalCount: Int!
  }

  type OffsetPageInfo {
    "Current limit"
    limit: Int!
    
    "Current offset"
    offset: Int!
    
    "Total number of pages"
    totalPages: Int!
    
    "Current page number (1-indexed)"
    currentPage: Int!
    
    "Has more items after current page"
    hasNextPage: Boolean!
    
    "Has items before current page"
    hasPreviousPage: Boolean!
  }


  """
  ============================================================================
  CURSOR PAGINATION TYPES (Relay Connection Specification)
  ============================================================================
  
  The Connection pattern consists of:
    1. Connection - contains edges and pageInfo
    2. Edge - contains cursor and node
    3. PageInfo - pagination metadata
    4. Node - the actual data
  
  Why this structure?
    • Edges can carry metadata about the relationship
    • Cursors are per-edge, enabling stable pagination
    • PageInfo is standardized across all connections
    • Clients (like Relay) can handle this automatically
  """
  
  "Node interface for global object identification"
  interface Node {
    id: ID!
  }

  type UserConnection {
    "List of edges (cursor + node pairs)"
    edges: [UserEdge!]!
    
    "Pagination information"
    pageInfo: PageInfo!
    
    """
    Total count of items matching the filter.
    NOTE: Computing this requires a full count query, which can be expensive.
    Consider making this optional or removing for large datasets.
    """
    totalCount: Int
  }

  type UserEdge {
    "Opaque cursor for this edge (used for pagination)"
    cursor: String!
    
    "The user at this edge"
    node: User!
  }

  type PageInfo {
    "Are there more items after the last edge?"
    hasNextPage: Boolean!
    
    "Are there items before the first edge?"
    hasPreviousPage: Boolean!
    
    "Cursor of the first edge (null if empty)"
    startCursor: String
    
    "Cursor of the last edge (null if empty)"
    endCursor: String
  }


  """
  ============================================================================
  FILTERING TYPES
  ============================================================================
  
  GraphQL approach to filtering:
    1. Use input types for filter objects
    2. Support multiple operators per field
    3. Allow combining filters (implicit AND)
    4. For OR logic, use explicit or: [] array
  """
  
  input UserFilter {
    "Filter by status"
    status: UserStatus
    
    "Filter by multiple statuses"
    statusIn: [UserStatus!]
    
    "Filter by role"
    role: UserRole
    
    "Filter by department"
    department: String
    
    "Filter by multiple departments"
    departmentIn: [String!]
    
    "Age filters"
    ageGte: Int
    ageLte: Int
    ageEq: Int
    
    "Salary filters"
    salaryGte: Int
    salaryLte: Int
    
    "Date filters"
    createdAfter: String
    createdBefore: String
    
    "Search across name and email"
    search: String
    
    "Email contains"
    emailContains: String
    
    """
    Combine multiple filters with OR logic.
    Example: { or: [{ status: ACTIVE }, { role: ADMIN }] }
    """
    or: [UserFilter!]
    
    """
    Combine multiple filters with AND logic (usually implicit).
    Example: { and: [{ ageGte: 25 }, { ageLte: 40 }] }
    """
    and: [UserFilter!]
  }

  """
  ============================================================================
  SORTING TYPES
  ============================================================================
  """
  input UserSort {
    field: UserSortField!
    order: SortOrder = ASC
  }
`;


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
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// Apply filters to user list
function applyFilters(userList, filter) {
  if (!filter) return userList;

  let result = [...userList];

  // Handle OR logic
  if (filter.or && filter.or.length > 0) {
    const orResults = filter.or.map(f => applyFilters(userList, f));
    const orIds = new Set(orResults.flat().map(u => u.id));
    result = result.filter(u => orIds.has(u.id));
  }

  // Handle AND logic
  if (filter.and && filter.and.length > 0) {
    for (const f of filter.and) {
      result = applyFilters(result, f);
    }
  }

  // Simple equality filters
  if (filter.status) {
    result = result.filter(u => u.status === filter.status);
  }

  if (filter.statusIn) {
    result = result.filter(u => filter.statusIn.includes(u.status));
  }

  if (filter.role) {
    result = result.filter(u => u.role === filter.role);
  }

  if (filter.department) {
    result = result.filter(u => u.department === filter.department);
  }

  if (filter.departmentIn) {
    result = result.filter(u => filter.departmentIn.includes(u.department));
  }

  // Range filters
  if (filter.ageGte !== undefined) {
    result = result.filter(u => u.age >= filter.ageGte);
  }

  if (filter.ageLte !== undefined) {
    result = result.filter(u => u.age <= filter.ageLte);
  }

  if (filter.ageEq !== undefined) {
    result = result.filter(u => u.age === filter.ageEq);
  }

  if (filter.salaryGte !== undefined) {
    result = result.filter(u => u.salary >= filter.salaryGte);
  }

  if (filter.salaryLte !== undefined) {
    result = result.filter(u => u.salary <= filter.salaryLte);
  }

  // Date filters
  if (filter.createdAfter) {
    const afterDate = new Date(filter.createdAfter);
    result = result.filter(u => new Date(u.createdAt) >= afterDate);
  }

  if (filter.createdBefore) {
    const beforeDate = new Date(filter.createdBefore);
    result = result.filter(u => new Date(u.createdAt) <= beforeDate);
  }

  // Search
  if (filter.search) {
    const term = filter.search.toLowerCase();
    result = result.filter(u =>
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }

  if (filter.emailContains) {
    const term = filter.emailContains.toLowerCase();
    result = result.filter(u => u.email.toLowerCase().includes(term));
  }

  return result;
}

// Apply sorting
function applySorting(userList, sort) {
  if (!sort) return userList;

  const fieldMap = {
    CREATED_AT: 'createdAt',
    FIRST_NAME: 'firstName',
    LAST_NAME: 'lastName',
    EMAIL: 'email',
    AGE: 'age',
    SALARY: 'salary'
  };

  const field = fieldMap[sort.field] || 'createdAt';
  const isDesc = sort.order === 'DESC';

  return [...userList].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

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
 * ============================================================================
 * RESOLVERS
 * ============================================================================
 */

const resolvers = {
  Query: {
    /**
     * Simple list - no pagination (DON'T USE FOR LARGE DATASETS)
     */
    allUsers: () => users,


    /**
     * ────────────────────────────────────────────────────────────────────────
     * OFFSET-BASED PAGINATION
     * ────────────────────────────────────────────────────────────────────────
     */
    usersOffset: (_, { limit = 20, offset = 0, filter, sort }) => {
      // Apply filters
      let filteredUsers = applyFilters(users, filter);
      
      // Apply sorting
      filteredUsers = applySorting(filteredUsers, sort);

      // Calculate totals
      const totalCount = filteredUsers.length;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      // Slice for current page
      const items = filteredUsers.slice(offset, offset + limit);

      return {
        items,
        totalCount,
        pageInfo: {
          limit,
          offset,
          totalPages,
          currentPage,
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0
        }
      };
    },


    /**
     * ────────────────────────────────────────────────────────────────────────
     * CURSOR-BASED PAGINATION (Relay Connection)
     * ────────────────────────────────────────────────────────────────────────
     * 
     * Implementation follows Relay Connection Specification:
     * https://relay.dev/graphql/connections.htm
     * 
     * Arguments:
     *   first + after: Forward pagination
     *   last + before: Backward pagination
     * 
     * Rules:
     *   - Cannot use first + last together
     *   - first/last must be positive
     *   - after/before are opaque cursors
     */
    users: (_, { first, after, last, before, filter, sort }) => {
      // Validate arguments
      if (first !== undefined && last !== undefined) {
        throw new Error('Cannot use both "first" and "last"');
      }

      if (first !== undefined && first < 0) {
        throw new Error('"first" must be a positive integer');
      }

      if (last !== undefined && last < 0) {
        throw new Error('"last" must be a positive integer');
      }

      // Apply filters and sorting
      let filteredUsers = applyFilters(users, filter);
      filteredUsers = applySorting(filteredUsers, sort);

      // Default limit
      const limit = first || last || 20;
      const maxLimit = 100;
      const actualLimit = Math.min(limit, maxLimit);

      let startIndex = 0;
      let endIndex = filteredUsers.length;

      // Handle 'after' cursor (forward pagination)
      if (after) {
        const decoded = decodeCursor(after);
        if (decoded) {
          const afterIndex = filteredUsers.findIndex(u => u.id === decoded.id);
          if (afterIndex !== -1) {
            startIndex = afterIndex + 1;
          }
        }
      }

      // Handle 'before' cursor (backward pagination)
      if (before) {
        const decoded = decodeCursor(before);
        if (decoded) {
          const beforeIndex = filteredUsers.findIndex(u => u.id === decoded.id);
          if (beforeIndex !== -1) {
            endIndex = beforeIndex;
          }
        }
      }

      // Slice the data
      let slicedUsers = filteredUsers.slice(startIndex, endIndex);

      // Apply first/last limits
      let edges;
      let hasNextPage = false;
      let hasPreviousPage = false;

      if (first !== undefined) {
        // Forward pagination: take first N items
        hasNextPage = slicedUsers.length > actualLimit;
        hasPreviousPage = startIndex > 0;
        edges = slicedUsers.slice(0, actualLimit).map(user => ({
          cursor: encodeCursor({ id: user.id }),
          node: user
        }));
      } else if (last !== undefined) {
        // Backward pagination: take last N items
        hasPreviousPage = slicedUsers.length > actualLimit;
        hasNextPage = endIndex < filteredUsers.length;
        const startSlice = Math.max(0, slicedUsers.length - actualLimit);
        edges = slicedUsers.slice(startSlice).map(user => ({
          cursor: encodeCursor({ id: user.id }),
          node: user
        }));
      } else {
        // Default: forward pagination
        hasNextPage = slicedUsers.length > actualLimit;
        hasPreviousPage = startIndex > 0;
        edges = slicedUsers.slice(0, actualLimit).map(user => ({
          cursor: encodeCursor({ id: user.id }),
          node: user
        }));
      }

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: filteredUsers.length
      };
    },


    /**
     * Single user lookup
     */
    user: (_, { id }) => {
      return users.find(u => u.id === id);
    },


    /**
     * Node interface (Relay Global Object Identification)
     */
    node: (_, { id }) => {
      // In real app, decode ID to determine type
      return users.find(u => u.id === id);
    }
  },


  User: {
    /**
     * Computed field example
     */
    fullName: (user) => `${user.firstName} ${user.lastName}`
  },


  Node: {
    __resolveType: (obj) => {
      // Determine type based on object properties
      if (obj.firstName) return 'User';
      return null;
    }
  }
};


/**
 * ============================================================================
 * START SERVER
 * ============================================================================
 */

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true
});

server.listen({ port: 4000 }).then(({ url }) => {
  console.log(`GraphQL API running at ${url}`);
  console.log(`
Example Queries:

# Offset pagination
query {
  usersOffset(limit: 10, offset: 0, filter: { status: ACTIVE }) {
    items {
      id
      firstName
      lastName
      status
    }
    totalCount
    pageInfo {
      currentPage
      totalPages
      hasNextPage
    }
  }
}

# Cursor pagination (Relay)
query {
  users(first: 10, filter: { ageGte: 25, ageLte: 40 }) {
    edges {
      cursor
      node {
        id
        firstName
        age
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

# Next page
query {
  users(first: 10, after: "eyJpZCI6IjEwIn0=") {
    edges {
      node {
        id
        firstName
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# With filtering and sorting
query {
  users(
    first: 20
    filter: {
      status: ACTIVE
      departmentIn: ["Engineering", "Sales"]
      salaryGte: 60000
    }
    sort: { field: SALARY, order: DESC }
  ) {
    edges {
      node {
        id
        firstName
        department
        salary
      }
    }
    totalCount
  }
}

# Search
query {
  users(first: 10, filter: { search: "john" }) {
    edges {
      node {
        id
        fullName
        email
      }
    }
  }
}
  `);
});
