const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8su0x.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const dbName = process.env.DB_NAME || "traveller";

let client;
let database;

/**
 * Returns a connected MongoDB database instance (cached).
 * Safe for serverless: reuses client across invocations when possible.
 */
async function connectToDatabase() {
  if (database) return database;

  if (!process.env.DB_USER || !process.env.DB_PASS) {
    throw new Error("Missing DB_USER / DB_PASS environment variables. Copy .env.example to .env");
  }

  if (!client) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    await client.connect();
    console.log("MongoDB connected");
  }

  database = client.db(dbName);
  return database;
}

function getCollections(db) {
  return {
    packages: db.collection("packages"),
    bookings: db.collection("bookings"),
    users: db.collection("users"),
  };
}

module.exports = connectToDatabase;
module.exports.getCollections = getCollections;
module.exports.dbName = dbName;

