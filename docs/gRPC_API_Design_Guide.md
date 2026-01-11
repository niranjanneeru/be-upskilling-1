# gRPC API Design Guide
## Designing Stable Services

---

## 1. Core Concepts

### What is gRPC?

- Uses Protocol Buffers (Protobuf) for serialization
- Runs on HTTP/2
- Call remote methods like local functions

### Four Communication Patterns

| Pattern | Flow | Use Case |
|---------|------|----------|
| **Unary** | Request → Response | Simple fetch, CRUD |
| **Server Streaming** | Request → Stream of responses | Live feed, large lists |
| **Client Streaming** | Stream of requests → Response | File upload, aggregation |
| **Bidirectional** | Stream ↔ Stream | Chat, real-time sync |

---

## 2. Proto File Structure

### Basic Structure

```protobuf
syntax = "proto3";

package mycompany.users.v1;

option go_package = "github.com/mycompany/api/users/v1";
option java_package = "com.mycompany.api.users.v1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// Service definition
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
}

// Messages
message User {
  string id = 1;
  string first_name = 2;
  string last_name = 3;
  string email = 4;
  google.protobuf.Timestamp created_at = 5;
}
```

---

## 3. Naming Conventions

### Package Names - lowercase with dots

```protobuf
package mycompany.users.v1;      # ✓
package mycompany.orders.v1;     # ✓
package mycompany.payments.v2;   # ✓

package MyCompany.Users;         # ❌
package my_company_users;        # ❌
```

### Service Names - PascalCase + "Service"

```protobuf
service UserService { ... }       # ✓
service OrderService { ... }      # ✓
service PaymentService { ... }    # ✓

service userService { ... }       # ❌
service Users { ... }             # ❌
service User_Service { ... }      # ❌
```

### RPC Method Names - PascalCase Verbs

```protobuf
service UserService {
  # Standard CRUD
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
  
  # Custom actions
  rpc ActivateUser(ActivateUserRequest) returns (User);
  rpc DeactivateUser(DeactivateUserRequest) returns (User);
  rpc SendVerificationEmail(SendVerificationEmailRequest) returns (SendVerificationEmailResponse);
}
```

**Naming Patterns:**

| Action | Pattern | Example |
|--------|---------|---------|
| Get single | `Get{Resource}` | `GetUser`, `GetOrder` |
| List multiple | `List{Resources}` | `ListUsers`, `ListOrders` |
| Create | `Create{Resource}` | `CreateUser`, `CreateOrder` |
| Update | `Update{Resource}` | `UpdateUser`, `UpdateOrder` |
| Delete | `Delete{Resource}` | `DeleteUser`, `DeleteOrder` |
| Custom | `{Verb}{Resource}` | `ActivateUser`, `CancelOrder` |

### Message Names - PascalCase

```protobuf
message User { ... }                    # ✓
message GetUserRequest { ... }          # ✓
message ListUsersResponse { ... }       # ✓
message CreateUserRequest { ... }       # ✓

message user { ... }                    # ❌
message get_user_request { ... }        # ❌
message getUserRequest { ... }          # ❌
```

**Request/Response Pattern:**
```protobuf
rpc GetUser(GetUserRequest) returns (GetUserResponse);
rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
```

Or return the resource directly:
```protobuf
rpc GetUser(GetUserRequest) returns (User);
rpc CreateUser(CreateUserRequest) returns (User);
```

### Field Names - snake_case

```protobuf
message User {
  string id = 1;
  string first_name = 2;           # ✓ snake_case
  string last_name = 3;            # ✓ snake_case
  string email_address = 4;        # ✓ snake_case
  google.protobuf.Timestamp created_at = 5;
  bool is_active = 6;
}
```

| ❌ Wrong | ✓ Correct |
|----------|-----------|
| `firstName` | `first_name` |
| `lastName` | `last_name` |
| `createdAt` | `created_at` |
| `isActive` | `is_active` |

### Enum Names - PascalCase with SCREAMING_SNAKE values

```protobuf
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;    # Always have UNSPECIFIED = 0
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_CONFIRMED = 2;
  ORDER_STATUS_SHIPPED = 3;
  ORDER_STATUS_DELIVERED = 4;
  ORDER_STATUS_CANCELLED = 5;
}

enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_ADMIN = 1;
  USER_ROLE_MODERATOR = 2;
  USER_ROLE_USER = 3;
  USER_ROLE_GUEST = 4;
}
```

**Rules:**
- Prefix values with enum name (avoids conflicts)
- Always have `_UNSPECIFIED = 0` as first value
- Use SCREAMING_SNAKE_CASE

---

## 4. Field Numbers

### Rules for Field Numbers

```protobuf
message User {
  string id = 1;           # 1-15: frequently used (1 byte)
  string first_name = 2;
  string last_name = 3;
  string email = 4;
  
  string phone = 16;       # 16-2047: less frequent (2 bytes)
  string bio = 17;
  
  // Reserved range: 19000-19999 (protobuf internal)
}
```

**Best Practices:**
- Use 1-15 for frequently used fields (smaller encoding)
- Never change field numbers after deployment
- Reserve numbers when removing fields

### Reserved Fields (Critical!)

When removing fields, **reserve** the number and name:

```protobuf
message User {
  reserved 5, 6;                    # Reserved numbers
  reserved "legacy_name", "old_email";  # Reserved names
  
  string id = 1;
  string first_name = 2;
  string last_name = 3;
  string email = 4;
  // field 5 was: string legacy_name
  // field 6 was: string old_email
  string phone = 7;
}
```

**Why Reserve?**
- Prevents accidental reuse of field numbers
- Old data with removed fields won't corrupt
- Documents what was removed

---

## 5. Common Patterns

### Request/Response Messages

```protobuf
// Get single
message GetUserRequest {
  string id = 1;
}

// List with pagination
message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;
  string order_by = 4;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

// Create
message CreateUserRequest {
  string first_name = 1;
  string last_name = 2;
  string email = 3;
  string password = 4;
}

// Update (partial)
message UpdateUserRequest {
  string id = 1;
  google.protobuf.FieldMask update_mask = 2;
  string first_name = 3;
  string last_name = 4;
  string email = 5;
}

// Delete
message DeleteUserRequest {
  string id = 1;
}
```

### Streaming Patterns

```protobuf
service DataService {
  // Server streaming - server sends multiple responses
  rpc StreamEvents(StreamEventsRequest) returns (stream Event);
  
  // Client streaming - client sends multiple requests
  rpc UploadFile(stream FileChunk) returns (UploadResponse);
  
  // Bidirectional streaming
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message StreamEventsRequest {
  string topic = 1;
  google.protobuf.Timestamp since = 2;
}

message Event {
  string id = 1;
  string type = 2;
  bytes payload = 3;
  google.protobuf.Timestamp timestamp = 4;
}

message FileChunk {
  bytes data = 1;
  int64 offset = 2;
}

message UploadResponse {
  string file_id = 1;
  int64 total_bytes = 2;
}
```

### Wrapper Types for Nullable Fields

Proto3 scalars can't distinguish between "not set" and "default value":

```protobuf
import "google/protobuf/wrappers.proto";

message User {
  string id = 1;
  string name = 2;
  
  // These can be null
  google.protobuf.StringValue nickname = 3;
  google.protobuf.Int32Value age = 4;
  google.protobuf.BoolValue is_premium = 5;
}
```

Or use `optional` keyword (proto3 syntax):
```protobuf
message User {
  string id = 1;
  string name = 2;
  optional string nickname = 3;
  optional int32 age = 4;
}
```

---

## 6. gRPC Status Codes

### Standard Codes

| Code | Name | HTTP Equiv | When to Use |
|------|------|------------|-------------|
| 0 | `OK` | 200 | Success |
| 1 | `CANCELLED` | 499 | Client cancelled |
| 2 | `UNKNOWN` | 500 | Unknown error |
| 3 | `INVALID_ARGUMENT` | 400 | Validation failed |
| 4 | `DEADLINE_EXCEEDED` | 504 | Timeout |
| 5 | `NOT_FOUND` | 404 | Resource not found |
| 6 | `ALREADY_EXISTS` | 409 | Resource already exists |
| 7 | `PERMISSION_DENIED` | 403 | Not authorized |
| 8 | `RESOURCE_EXHAUSTED` | 429 | Rate limited |
| 9 | `FAILED_PRECONDITION` | 400 | Invalid state |
| 10 | `ABORTED` | 409 | Concurrency conflict |
| 11 | `OUT_OF_RANGE` | 400 | Value out of range |
| 12 | `UNIMPLEMENTED` | 501 | Not implemented |
| 13 | `INTERNAL` | 500 | Server error |
| 14 | `UNAVAILABLE` | 503 | Service unavailable |
| 15 | `DATA_LOSS` | 500 | Data corruption |
| 16 | `UNAUTHENTICATED` | 401 | Not authenticated |

### Using Status Codes

```javascript
// Node.js example
const grpc = require('@grpc/grpc-js');

function getUser(call, callback) {
  const user = db.findUser(call.request.id);
  
  if (!user) {
    callback({
      code: grpc.status.NOT_FOUND,
      message: `User ${call.request.id} not found`
    });
    return;
  }
  
  callback(null, user);
}
```

### Rich Error Details

```protobuf
import "google/rpc/error_details.proto";
import "google/rpc/status.proto";

// Can include detailed error info
// - BadRequest (field violations)
// - RetryInfo (when to retry)
// - QuotaFailure (which quota exceeded)
// - PreconditionFailure (what precondition failed)
```

---

## 7. Versioning

### Package-Based Versioning

```protobuf
// v1
package mycompany.users.v1;

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}

// v2 (breaking changes)
package mycompany.users.v2;

service UserService {
  rpc GetUser(GetUserRequest) returns (UserResponse);  // Changed return type
}
```

### Running Multiple Versions

```
users-service/
├── v1/
│   └── user_service.proto
├── v2/
│   └── user_service.proto
└── server.go  # Registers both v1 and v2
```

### Backward Compatible Evolution

**Safe changes (no new version needed):**
- Add new fields (with new numbers)
- Add new RPC methods
- Add new services
- Add new enum values

**Breaking changes (need new version):**
- Remove/rename fields
- Change field types
- Change field numbers
- Remove RPC methods
- Change RPC signatures

---

## 8. Best Practices

### Always Set Deadlines

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

response, err := client.GetUser(ctx, request)
```

```javascript
const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

client.getUser(request, { deadline }, (err, response) => {
  // ...
});
```

### Use Interceptors for Cross-Cutting Concerns

```go
// Logging interceptor
func loggingInterceptor(ctx context.Context, req interface{}, 
    info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    
    start := time.Now()
    resp, err := handler(ctx, req)
    log.Printf("Method: %s, Duration: %v, Error: %v", 
        info.FullMethod, time.Since(start), err)
    return resp, err
}

// Apply
server := grpc.NewServer(
    grpc.UnaryInterceptor(loggingInterceptor),
)
```

### Keep Messages Small

```protobuf
// ❌ Too large
message User {
  string id = 1;
  string name = 2;
  bytes profile_image = 3;      // Could be megabytes!
  repeated Order orders = 4;     // Could be thousands!
}

// ✓ Better - reference by ID
message User {
  string id = 1;
  string name = 2;
  string profile_image_url = 3;
}

message GetUserOrdersRequest {
  string user_id = 1;
  int32 page_size = 2;
  string page_token = 3;
}
```

### Health Checking

```protobuf
// Use standard health checking
// https://github.com/grpc/grpc/blob/master/doc/health-checking.md

service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}
```

---

## 9. Quick Reference

### Naming Summary

| Element | Convention | Example |
|---------|------------|---------|
| Package | lowercase.with.dots | `mycompany.users.v1` |
| Service | PascalCase + Service | `UserService` |
| RPC Methods | PascalCase | `GetUser`, `ListUsers` |
| Messages | PascalCase | `User`, `GetUserRequest` |
| Fields | snake_case | `first_name`, `created_at` |
| Enums | PascalCase | `OrderStatus` |
| Enum Values | PREFIX_SCREAMING_SNAKE | `ORDER_STATUS_PENDING` |

### Proto File Checklist

- [ ] Package name includes version (`v1`, `v2`)
- [ ] Service names end with "Service"
- [ ] RPC methods use verb-noun pattern
- [ ] Messages use PascalCase
- [ ] Fields use snake_case
- [ ] Field numbers assigned correctly (1-15 for common)
- [ ] Reserved fields documented
- [ ] Enum has UNSPECIFIED = 0
- [ ] Timestamps use `google.protobuf.Timestamp`

### gRPC Status Code Quick Reference

| Situation | Code |
|-----------|------|
| Success | `OK` (0) |
| Validation error | `INVALID_ARGUMENT` (3) |
| Not found | `NOT_FOUND` (5) |
| Already exists | `ALREADY_EXISTS` (6) |
| Not authorized | `PERMISSION_DENIED` (7) |
| Not authenticated | `UNAUTHENTICATED` (16) |
| Rate limited | `RESOURCE_EXHAUSTED` (8) |
| Timeout | `DEADLINE_EXCEEDED` (4) |
| Server error | `INTERNAL` (13) |
| Service down | `UNAVAILABLE` (14) |

---

## 10. References

| Resource | URL |
|----------|-----|
| Official gRPC Docs | https://grpc.io/docs |
| Proto3 Language Guide | https://protobuf.dev/programming-guides/proto3 |
| gRPC Status Codes | https://grpc.io/docs/guides/status-codes |
| Google API Design Guide | https://cloud.google.com/apis/design |
| gRPC Best Practices | https://grpc.io/docs/guides/performance |
| Health Checking Protocol | https://github.com/grpc/grpc/blob/master/doc/health-checking.md |
| Error Handling | https://grpc.io/docs/guides/error |
| gRPC-Web (Browser) | https://grpc.io/docs/platforms/web |
| Buf (Proto Linting) | https://buf.build |
| Google Well-Known Types | https://protobuf.dev/reference/protobuf/google.protobuf |
