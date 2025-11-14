const http = require('http');

const PORT = process.env.PORT || 4000;

const sampleTasks = [
  {
    id: 1,
    title: 'UI 마크업 검토',
    status: 'IN_PROGRESS',
    dueDate: '2025-11-14',
  },
  {
    id: 2,
    title: '백엔드 API 명세 정리',
    status: 'TODO',
    dueDate: '2025-11-15',
  },
  {
    id: 3,
    title: '테스트 케이스 작성',
    status: 'BLOCKED',
    dueDate: '2025-11-16',
  },
];

const server = http.createServer((req, res) => {
  if (req.url === '/api/tasks' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(JSON.stringify({ tasks: sampleTasks }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Test backend server running at http://localhost:${PORT}`);
});

