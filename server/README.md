# Backend
## Credentials
The application is configured through a .env file. There's a .env.sample file with credentials that should work for local development. Copy that file to .env to configure the server for local development.

The server will automatically read any variables in .env and add it to its own environment. During production, we can either directly add a .env file containing a production configuration to the production area, or, we can launch the server and set the environment variables ourselves.

## Datastore Emulation
For launching a datastore emulator locally, run `yarn run datastore:start`. This requires Docker to be installed. If you are using Cloud Shell, then the `gcloud` sdk should already be installed, so you can probably manually launch a datastore emulator.

## Server
For testing the server, run `yarn run watch`. This will launch the server. It will also restart the server everytime a source file changes.