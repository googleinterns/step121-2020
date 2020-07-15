require("dotenv").config();
const { env } = require("process");
const { Datastore } = require("@google-cloud/datastore");

let datastore;
if (env.NODE_ENV === "production") {
  // The NODE_ENV environment variable is set
  // automatically by Google App Engine in production
  datastore = new Datastore({
    projectId: env.DATASTORE_PROJECT_ID,
  });
} else {
  // we're in local
  if (!env.DATASTORE_HOST || !env.DATASTORE_PORT || !env.DATASTORE_PROJECT_ID) {
    console.error(`missing one of required config values`);
    process.exit(1);
  }
  datastore = new Datastore({
    projectId: env.DATASTORE_PROJECT_ID,
    apiEndpoint: `${env.DATASTORE_HOST}:${env.DATASTORE_PORT}`,
  });
}

module.exports = datastore;
