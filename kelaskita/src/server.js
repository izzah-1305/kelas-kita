import http from 'node:http';
import app from './app.js';
import { config } from './config.js';
import { initSocket } from './socket.js';

const server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`KelasKita API berjalan di http://localhost:${config.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
