import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 4001);
const dbPath = process.env.GENIUS_DB_PATH ?? "genius-allspark.sqlite3";

const { app } = buildServer({ dbPath });

app
  .listen({ port, host: "127.0.0.1" })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Super Construtor escutando em http://127.0.0.1:${port} (banco: ${dbPath})`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
