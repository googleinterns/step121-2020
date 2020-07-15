const { execSync } = require("child_process");
require("dotenv").config();
const process = require("process");
const { env } = process;

if (!env.DATASTORE_HOST || !env.DATASTORE_PORT || !env.DATASTORE_PROJECT_ID) {
  console.error(`missing one of required config values`);
  process.exit(1);
}
const command = [
  `docker run -d`,
  `-e "DATASTORE_PROJECT_ID=${env.DATASTORE_PROJECT_ID}"`,
  `-e "DATASTORE_LISTEN_ADDRESS=0.0.0.0:8081"`,
  `-h ${env.DATASTORE_HOST}`,
  `-p ${env.DATASTORE_PORT}:8081`,
  `--rm singularities/datastore-emulator`,
].join(" ");
console.log(`Executing command: "${command}"`);
const result = execSync(command).toString();
console.log(`Started docker container. Stop it with: "docker stop ${result}"`);
