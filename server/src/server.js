const { v4: uuidv4 } = require("uuid");
const express = require("express");
const cookieSession = require("cookie-session");
const datastore = require("./datastore");
const app = express();

const KIND_EVENT = "Event";

const URL_PARAM_EVENT_ID = `eventID`;

const ERROR_BAD_DB_INTERACTION = "BAD_DATABASE";
const ERROR_INVALID_EVENT_ID = "INVALID_EVENT_ID";
const ERROR_BAD_UUID = "BAD_UUID";

// Parse request bodies with the json content header into JSON
app.use(express.json());

app.use(
  cookieSession({
    name: "session",
    keys: ["secret1"],
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  })
);

/**
 * Middleware that attaches to every request and checks if there
 * is a user id. If not, we assume this is a new user and give
 * them a new uuid that is stored in their cookie.
 */
app.use((request, response, next) => {
  if (request.session.isNew) {
    // Don't worry about collision
    const uuid = uuidv4();
    request.session.userID = uuid;
  } else {
    if (
      // regex that matches valid uuids
      !/^[a-z0-9]{8}-[a-z0-9]{4}-4[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{12}$/.test(
        request.session.userID
      )
    ) {
      return response.status(500).json({
        status: 500,
        error: { type: ERROR_BAD_UUID },
      });
    }
  }
  next();
});

/**
 *  Middleware that can be used on routes that match `/:${URL_PARAM_EVENT_ID}/...`
 *  This will fetch the event from Datastore and attach it and its key to
 *  request.event and request.datastoreKey respectively.
 *
 *  It will return an error if, for any reason, the event could not be found.
 */
async function getEvent(request, response, next) {
  const key = datastore.key([
    KIND_EVENT,
    // If the url is: /1/details
    // then `request.params[URL_PARAM_EVENT_ID]` will be 1
    parseInt(request.params[URL_PARAM_EVENT_ID]),
  ]);
  datastore
    .runQuery(datastore.createQuery(KIND_EVENT).filter("__key__", "=", key))
    .then((results) => {
      // results[0] is the actual returned entities
      // results[1] is metadata about the request (e.g are there additional results)
      const events = results[0];
      if (events.length === 0) {
        response.status(400).json({
          status: 400,
          error: {
            type: ERROR_INVALID_EVENT_ID,
          },
        });
      } else {
        const event = events[0];
        if (
          event === undefined ||
          event === null ||
          typeof event !== "object"
        ) {
          response.status(500).json({
            status: 500,
            error: {
              type: ERROR_BAD_DB_INTERACTION,
            },
          });
        } else {
          request.event = event;
          request.datastoreKey = key;
          next();
        }
      }
    })
    .catch((err) => {
      // TODO(ved): Potentially log to file instead of stderr
      console.error(err)
      response.status(500).json({
        status: 500,
        error: {
          type: ERROR_BAD_DB_INTERACTION,
        },
      });
    });
}

app.post("/create", async (_, response) => {
  const key = datastore.key([KIND_EVENT]);
  const result = await datastore.save({ key, data: { users: {} } });
  response.send({
    // Datastore automatically generates a unique id
    // for the key associated with our entity. This is the only
    // way to get it :(
    // TODO: Check if the production data store server uses
    // random numbers. The local emulator increments the ids,
    // which makes them easily guessable. That's bad!
    eventID: result[0].mutationResults[0].key.path[0].id,
  });
});

app.post(`/:${URL_PARAM_EVENT_ID}`, getEvent, async (request, response) => {
  const { body, datastoreKey: key, event } = request;
  const location = JSON.parse(body.location);
  const [lat, long] = location;
  const { name } = body;
  event.users = event.users || {};
  const userInfo = event.users[request.session.userID] || {};
  event.users[request.session.userID] = { ...userInfo, name, lat, long };
  datastore
    // Datastore attaches a "symbol" (https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
    // to any entities returned from a query. We don't want to store this attached metadata back into the database
    // so we remove it with Object.fromEntries
    .save({ key, data: Object.fromEntries(Object.entries(event)) })
    .then(() => {
      response.json({ status: 200 });
    })
    .catch((err) => {
      console.error(err)
      response
        .status(500)
        .json({ status: 500, error: { type: ERROR_BAD_DB_INTERACTION } });
    });
});

app.get(`/:${URL_PARAM_EVENT_ID}/details`, getEvent, async (request, response) => {
  response.json({ status: 200, data: request.event });
});

app.get(`/:${URL_PARAM_EVENT_ID}/me`, getEvent, async (request, response) => {
  const { event } = request;
  const users = event.users || {};
  const userInfo = users[request.session.userID] || {};
  response.json({
    status: 200,
    data: userInfo,
  });
});

const port = 3000;
app.listen(port, () =>
  console.log(`Server listening at http://localhost:${port}`)
);
