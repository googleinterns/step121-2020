require("dotenv").config();
const { env } = require("process");
const { Datastore } = require("@google-cloud/datastore");

if (!env.DATASTORE_HOST || !env.DATASTORE_PORT || !env.DATASTORE_PROJECT_ID) {
  console.error(`missing one of required config values`);
  process.exit(1);
}

const datastore = new Datastore({
  projectId: env.DATASTORE_PROJECT_ID,
  apiEndpoint: `${env.DATASTORE_HOST}:${env.DATASTORE_PORT}`,
});

module.exports = datastore;
