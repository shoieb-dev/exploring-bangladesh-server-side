require("dotenv").config();
const createApp = require("./src/app");

const app = createApp();
const port = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Exploring Bangladesh server running at http://localhost:${port}`);
  });
}

module.exports = app;

