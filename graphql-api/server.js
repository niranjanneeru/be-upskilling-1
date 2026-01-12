const { ApolloServer, gql } = require('apollo-server');

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

const typeDefs = gql`
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
    fullName: String!
  }

  type Query {
    users(
      "Returns the first n elements from the list"
      first: Int
      "Returns elements after the cursor"
      after: String
    ): UserConnection!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int
  }

  type UserEdge {
    cursor: String!
    node: User!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }
`;


function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

const resolvers = {
  Query: {
    users: (_, { first, after }) => {
      const limit = Math.min(first || 20, 100);
      let startIndex = 0;

      if (after) {
        const decoded = decodeCursor(after);
        if (decoded) {
          const afterIndex = users.findIndex(u => u.id === decoded.id);
          if (afterIndex !== -1) {
            startIndex = afterIndex + 1;
          }
        }
      }

      const slicedUsers = users.slice(startIndex, startIndex + limit + 1);
      const hasNextPage = slicedUsers.length > limit;
      const results = hasNextPage ? slicedUsers.slice(0, limit) : slicedUsers;

      const edges = results.map(user => ({
        cursor: encodeCursor({ id: user.id }),
        node: user
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: startIndex > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: users.length
      };
    }
  },

  User: {
    fullName: (user) => `${user.firstName} ${user.lastName}`
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true
});

server.listen({ port: 4000 }).then(({ url }) => {
  console.log(`GraphQL API running at ${url}`);
  console.log(`
Example Query:

query {
  users(first: 10) {
    edges {
      cursor
      node {
        id
        firstName
        lastName
        email
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Next page
query {
  users(first: 10, after: "eyJpZCI6IjEwIn0=") {
    edges {
      node { id firstName }
    }
    pageInfo { hasNextPage endCursor }
  }
}
  `);
});
