const express = require('express');
const app = express();
app.use(express.json());

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
 * START SERVER
 * ============================================================================
 */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`REST API running on http://localhost:${PORT}`);
  console.log(`
Available endpoint:
  GET  /api/v1/users/cursor  - Cursor-based pagination

Example request:
  curl "http://localhost:${PORT}/api/v1/users/cursor?limit=10"
  `);
});
