# GraphQL API Design Guide
## Designing Stable Schemas

---

## 1. Core Concepts

### What is GraphQL?

- Single endpoint: `POST /graphql`
- Client specifies exactly what data it needs
- Strongly typed schema

### Three Operation Types

| Operation | Purpose | Example |
|-----------|---------|---------|
| **Query** | Read data | Fetch user profile |
| **Mutation** | Write/modify data | Create order, update user |
| **Subscription** | Real-time updates | Live notifications |

---

## 2. Naming Conventions

### Types - PascalCase

```graphql
type User {
  id: ID!
  firstName: String!
  lastName: String!
  email: String!
}

type Order {
  id: ID!
  total: Float!
  status: OrderStatus!
}

type ProductVariant {
  id: ID!
  sku: String!
  price: Float!
}
```

### Fields - camelCase

```graphql
type User {
  id: ID!
  firstName: String!
  lastName: String!      
  createdAt: DateTime!   
  emailVerified: Boolean!
}
```

### Queries - camelCase Nouns

```graphql
type Query {
  # Single resource - singular noun
  user(id: ID!): User
  order(id: ID!): Order
  
  # Collections - plural noun
  users(first: Int, after: String): UserConnection!
  orders(filter: OrderFilter): OrderConnection!
  
  # Current user
  me: User
}
```

### Mutations - camelCase Verbs

```graphql
type Mutation {
  # Pattern: verbNoun
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
  
  # Actions
  cancelOrder(id: ID!): CancelOrderPayload!
  refundPayment(input: RefundPaymentInput!): RefundPaymentPayload!
  sendVerificationEmail(userId: ID!): SendEmailPayload!
}
```

### Input Types - PascalCase + "Input"

```graphql
input CreateUserInput {
  firstName: String!
  lastName: String!
  email: String!
  password: String!
}

input UpdateUserInput {
  id: ID!
  firstName: String
  lastName: String
  email: String
}

input OrderFilter {
  status: OrderStatus
  createdAfter: DateTime
  createdBefore: DateTime
}
```

### Payload Types - PascalCase + "Payload"

```graphql
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type DeleteUserPayload {
  deletedUserId: ID
  success: Boolean!
  errors: [UserError!]!
}
```

### Enums - PascalCase with SCREAMING_SNAKE values

```graphql
enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

enum UserRole {
  ADMIN
  MODERATOR
  USER
  GUEST
}
```

---

## 3. Schema Design Patterns

### Nullability

Use `!` (non-null) by default for required fields:

```graphql
type User {
  id: ID!              # Always exists
  email: String!       # Required
  firstName: String!   # Required
  phone: String        # Optional (nullable)
  avatarUrl: String    # Optional (nullable)
}
```

**Rule:** If a field can ever be null, don't use `!`

### Connections for Pagination (Relay Spec)

```graphql
type Query {
  users(
    first: Int
    after: String
    last: Int
    before: String
  ): UserConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

**Usage:**
```graphql
query {
  users(first: 10) {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Node Interface (Global Object Identification)

```graphql
interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  name: String!
}

type Order implements Node {
  id: ID!
  total: Float!
}

type Query {
  node(id: ID!): Node
}
```

---

## 4. Error Handling

### Errors Array (Standard GraphQL)

```json
{
  "data": null,
  "errors": [
    {
      "message": "User not found",
      "path": ["user"],
      "locations": [{ "line": 2, "column": 3 }],
      "extensions": {
        "code": "NOT_FOUND",
        "field": "id"
      }
    }
  ]
}
```

### Errors in Payload (Recommended for Mutations)

```graphql
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String
  code: String!
  message: String!
}
```

**Response:**
```json
{
  "data": {
    "createUser": {
      "user": null,
      "errors": [
        {
          "field": "email",
          "code": "ALREADY_EXISTS",
          "message": "Email is already registered"
        }
      ]
    }
  }
}
```

### Common Error Codes

| Code | When to Use |
|------|-------------|
| `NOT_FOUND` | Resource doesn't exist |
| `ALREADY_EXISTS` | Duplicate resource |
| `INVALID_INPUT` | Validation failed |
| `UNAUTHORIZED` | Not authenticated |
| `FORBIDDEN` | Not authorized |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## 5. Deprecation

### Deprecating Fields

```graphql
type User {
  id: ID!
  name: String! @deprecated(reason: "Use firstName and lastName instead")
  firstName: String!
  lastName: String!
  
  email: String!
  emailAddress: String! @deprecated(reason: "Use email instead")
}
```

### Deprecating Enum Values

```graphql
enum OrderStatus {
  PENDING
  PROCESSING @deprecated(reason: "Use CONFIRMED instead")
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}
```

### Deprecation Best Practices

1. Always provide a reason
2. Point to the replacement
3. Keep deprecated fields working
4. Monitor usage before removal
5. Announce removal timeline

---

## 6. Best Practices

### Avoid N+1 Queries - Use DataLoader

**Problem:**
```graphql
query {
  users {
    id
    orders {    # N queries for N users!
      id
    }
  }
}
```

**Solution:** Batch with DataLoader
```javascript
const orderLoader = new DataLoader(async (userIds) => {
  const orders = await db.orders.findByUserIds(userIds);
  return userIds.map(id => orders.filter(o => o.userId === id));
});
```

### Query Complexity Limits

Prevent malicious deep/wide queries:

```graphql
# Dangerous - deeply nested
query {
  users {
    friends {
      friends {
        friends {
          friends { ... }
        }
      }
    }
  }
}
```

**Implement:**
- Maximum depth limit (e.g., 10 levels)
- Query complexity scoring
- Timeout limits

### Input Validation

```graphql
input CreateUserInput {
  email: String!      # Validate email format
  password: String!   # Validate min length
  age: Int            # Validate range (0-150)
}
```

Validate in resolvers:
```javascript
const resolvers = {
  Mutation: {
    createUser: (_, { input }) => {
      if (!isValidEmail(input.email)) {
        throw new UserInputError('Invalid email format');
      }
      if (input.password.length < 8) {
        throw new UserInputError('Password too short');
      }
      // ... create user
    }
  }
};
```

---

## 7. Versioning Strategy

### No URL Versioning!

```
❌ /graphql/v1
❌ /graphql/v2

✓ /graphql (single endpoint, always)
```

### Evolve Schema Instead

1. **Add new fields** (non-breaking)
2. **Deprecate old fields** with `@deprecated`
3. **Monitor usage** of deprecated fields
4. **Remove after migration period**

```graphql
# Evolution example
type User {
  # Phase 1: Add new fields
  name: String! @deprecated(reason: "Use firstName + lastName")
  firstName: String!
  lastName: String!
  
  # Phase 2: After migration, remove
  # name field removed entirely
}
```

---

## 8. Quick Reference

### Naming Summary

| Type | Convention | Example |
|------|------------|---------|
| Types | PascalCase | `User`, `OrderItem` |
| Fields | camelCase | `firstName`, `createdAt` |
| Queries | camelCase | `user`, `users`, `me` |
| Mutations | verbNoun | `createUser`, `cancelOrder` |
| Inputs | PascalCase + Input | `CreateUserInput` |
| Payloads | PascalCase + Payload | `CreateUserPayload` |
| Enums | PascalCase | `OrderStatus` |
| Enum Values | SCREAMING_SNAKE | `PENDING`, `IN_PROGRESS` |

### Schema Checklist

- [ ] Types use PascalCase
- [ ] Fields use camelCase
- [ ] Required fields marked with `!`
- [ ] Lists use Connections pattern
- [ ] Mutations return Payload types
- [ ] Errors included in Payload
- [ ] Deprecated fields have reasons
- [ ] DataLoader for nested queries
- [ ] Query complexity limits set

---

## 9. References

| Resource | URL |
|----------|-----|
| Official GraphQL Docs | https://graphql.org/learn |
| GraphQL Specification | https://spec.graphql.org |
| Apollo Server Docs | https://www.apollographql.com/docs/apollo-server |
| Relay Connection Spec | https://relay.dev/graphql/connections.htm |
| GraphQL Best Practices | https://graphql.org/learn/best-practices |
| Apollo Error Handling | https://www.apollographql.com/docs/apollo-server/data/errors |
| DataLoader | https://github.com/graphql/dataloader |
| GraphQL Cursor Connections | https://relay.dev/graphql/connections.htm |
| GitHub GraphQL API (Example) | https://docs.github.com/en/graphql |
| Shopify GraphQL Design Tutorial | https://shopify.dev/docs/api/usage/pagination-graphql |
