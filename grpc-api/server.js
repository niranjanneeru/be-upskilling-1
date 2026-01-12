const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const reflection = require('@grpc/reflection');
const path = require('path');

const users = Array.from({ length: 150 }, (_, i) => ({
  id: String(i + 1),
  first_name: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'][i % 5],
  last_name: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown'][i % 5],
  email: `user${i + 1}@example.com`,
  age: 20 + (i % 40),
  status: [1, 2, 3][i % 3],
  role: [1, 2, 3][i % 3],
  created_at: Math.floor((Date.now() - i * 86400000) / 1000),
  department: ['Engineering', 'Sales', 'Marketing', 'Support'][i % 4],
  salary: 50000 + (i * 1000)
}));

function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor) {
  try {
    if (!cursor) return null;
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

const serviceImplementation = {
  ListUsers: (call, callback) => {
    const { page_size = 20, page_token } = call.request;
    const limit = Math.min(100, Math.max(1, page_size));

    let startIndex = 0;
    if (page_token) {
      const decoded = decodeCursor(page_token);
      if (decoded) {
        const cursorIndex = users.findIndex(u => u.id === decoded.id);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }
    }

    const pageUsers = users.slice(startIndex, startIndex + limit + 1);
    const hasMore = pageUsers.length > limit;
    const results = hasMore ? pageUsers.slice(0, limit) : pageUsers;

    const nextPageToken = hasMore && results.length > 0
      ? encodeCursor({ id: results[results.length - 1].id })
      : '';

    callback(null, {
      users: results,
      next_page_token: nextPageToken,
      has_more: hasMore,
      total_count: users.length
    });
  }
};

const PROTO_PATH = path.join(__dirname, 'proto', 'user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: Number,
  defaults: true,
  oneofs: true,
  includeDirs: [
    path.join(__dirname, 'proto'),
    path.join(__dirname, 'node_modules', '@grpc', 'reflection', 'proto'),
    path.join(__dirname, 'node_modules', 'protobufjs')
  ]
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const userService = protoDescriptor.users.v1.UserService;

function startServer() {
  const server = new grpc.Server();
  server.addService(userService.service, serviceImplementation);
  
  const reflectionService = new reflection.ReflectionService(packageDefinition);
  reflectionService.addToServer(server);
  
  const port = process.env.PORT || 50051;
  
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('Failed to start server:', err);
        return;
      }
      
      console.log(`gRPC server running on port ${boundPort}`);
      console.log(`
Example using grpcurl:

  # List users (cursor-based pagination)
  grpcurl -plaintext -d '{"page_size": 10}' \\
    localhost:${boundPort} users.v1.UserService/ListUsers

  # Next page
  grpcurl -plaintext -d '{"page_size": 10, "page_token": "eyJpZCI6IjEwIn0="}' \\
    localhost:${boundPort} users.v1.UserService/ListUsers
      `);
    }
  );
}

startServer();
