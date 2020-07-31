# General
## Dev Workflow
Use `npm run format` before submitting a PR to ensure all your files are properly formatted.

## Deployment
- Go to your Google Cloud Shell instance
- Run `gcloud app deploy` inside the project folder
  - It may ask you to set your GCP project id
- That's it!

# Front-end
Front-end files are in the "static" directory. They are served from the back-end server.

# Backend
## Credentials
The application is configured through a .env file.  
A .env file contains values for environment variables.  
There's a .env.sample file with credentials that should work for local development. Copy that file to .env to configure the server for local development.

The server will automatically read any variables in the .env file and add it to its own process environment.  
When deploying, set the DATASTORE_PROJECT_ID to the GCP project id and remove the other 2 environment variable values from the .env file (they are only needed for development).

Don't set DATASTORE_PROJECT_ID to the GCP project id when developing locally because then you will modify the production database (if you are using Google Cloud Shell)!

## Datastore Emulation
For launching a datastore emulator locally, run `npm run datastore:start`. This requires Docker to be installed. If you are using Cloud Shell, then the `gcloud` sdk should already be installed, so you can probably manually launch a datastore emulator.

## Server
For testing the server, run `npm run watch`. This will launch the server. It will also restart the server every time a source file changes.

Because of socket.io, we need to kill the server from the command line before restarting it (if using `npm run watch`). nodemon.json contains a command for nodemon to use to restart the server (instead of whatever nodemon does by default).

For this to work, you need to be running Linux and have the `fuser` command installed. You might also need to tweak the delay field for your computer. The higher the delay field, the longer nodemon will wait before restarting the server. This will give time for the `fuser` command to run.

If all of this sounds like too much work, just use `npm run start` and restart the server manually with Ctrl-C.