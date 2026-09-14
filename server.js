import { createApp } from './server/app.js';
import { config } from './server/config.js';

const { app, database } = await createApp();
const server = app.listen(config.port, () => {
  console.log(`TypeSense server listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
