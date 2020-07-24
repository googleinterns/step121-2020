const { v4: uuidv4 } = require("uuid");
const process = require("process");
const { env } = process;
const path = require("path");
const express = require("express");
const fromEntries = require("object.fromentries");
const cookieSession = require("cookie-session");
const datastore = require("./datastore");
const fetch = require("node-fetch");

const app = express();

const KIND_EVENT = "Event";

const URL_PARAM_EVENT_ID = `eventID`;
const URL_PARAM_ADDRESS = `address`;

// TODO(ved): There's definitely a cleaner way to do this.
const PREFIX_API = "/api";

const ERROR_BAD_DB_INTERACTION = "BAD_DATABASE";
const ERROR_INVALID_EVENT_ID = "INVALID_EVENT_ID";
const ERROR_BAD_UUID = "BAD_UUID";
const ERROR_GEOCODING_FAILED = "GEOCODING_FAILED";

app.use(express.static("static/absolute"));

function getAbsolutePath(htmlFileName) {
  return path.join(process.cwd(), "static", htmlFileName);
}

app.get("/", (_, response) => {
  response.redirect("/create");
});

app.get(`/create`, (_, response) => {
  response.sendFile(getAbsolutePath("createSession.html"));
});

app.get(`/:${URL_PARAM_EVENT_ID}`, (_, response) => {
  response.sendFile(getAbsolutePath("searchPage.html"));
});

app.get(`/:${URL_PARAM_EVENT_ID}/participants`, (_, response) => {
  response.sendFile(getAbsolutePath("participants.html"));
});

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
      console.error(err);
      response.status(500).json({
        status: 500,
        error: {
          type: ERROR_BAD_DB_INTERACTION,
        },
      });
    });
}

app.post(`${PREFIX_API}/create`, async (_, response) => {
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

/**
 * Sample post body:
 * {
 *   name: "bob",
 *   location: "[123, 321]"
 * }
 */
app.post(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}`,
  getEvent,
  async (request, response) => {
    const { body, datastoreKey: key, event } = request;
    const [lat, long] = body.location;
    const { name } = body;
    event.users = event.users || {};
    const userInfo = event.users[request.session.userID] || {};
    event.users[request.session.userID] = { ...userInfo, name, lat, long };
    datastore
      // Datastore attaches a "symbol" (https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
      // to any entities returned from a query. We don't want to store this attached metadata back into the database
      // so we remove it with Object.fromEntries
      .save({ key, data: fromEntries(Object.entries(event)) })
      .then(() => {
        response.json({ status: 200 });
      })
      .catch((err) => {
        console.error(err);
        response
          .status(500)
          .json({ status: 500, error: { type: ERROR_BAD_DB_INTERACTION } });
      });
  }
);

app.get(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/details`,
  getEvent,
  async (request, response) => {
    response.json({ status: 200, data: request.event });
  }
);

app.get(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/me`,
  getEvent,
  async (request, response) => {
    const { event } = request;
    const users = event.users || {};
    const userInfo = users[request.session.userID] || {};
    response.json({
      status: 200,
      data: userInfo,
    });
  }
);

app.get(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/participants`,
  getEvent,
  async (request, response) => {
    const { event } = request;
    const users = event.users || {};
    response.json({
      status: 200,
      data: Object.values(users),
    });
  }
);

app.get(
  `${PREFIX_API}/:${URL_PARAM_ADDRESS}/geocode`,
  async (request, response) => {
    let address = request.params[URL_PARAM_ADDRESS];

    let geocodeRequest =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      address +
      "&key=" +
      env.API_KEY;

    try {
      const geocodeResponse = await (await fetch(geocodeRequest)).json();
      const geocodeResponseStatus = geocodeResponse.status;

      if (geocodeResponseStatus !== "OK") {
        console.error("Geocoding error occured. Api response status: " + geocodeResponseStatus)
        response
          .status(500)
          .json({ status: 500, error: { type: geocodeResponseStatus } });
      } else {
        response.json({
          status: 200,
          data: geocodeResponse.results[0].geometry.location,
        });
      }
    } catch (err) {
      console.error(err);
      response
        .status(500)
        .json({ status: 500, error: { type: ERROR_GEOCODING_FAILED } });
    }
  }
);

/** Some Hard-coded data to display as restaurants temporarily. */
function getRestaurants() {
  const restaurant1 = {
    name: "Nice Cafe",
    address: "123 N. Street st.",
    latLong: { lat: 37.0, lng: -122.0 },
    rating: 5,
    priceLevel: 2,
    openingHours: "8:00am - 10:00pm",
  };

  const restaurant2 = {
    name: "Bad Cafe",
    address: "987 S. Street st.",
    latLong: { lat: -37.0, lng: 122.0 },
    rating: 2,
    priceLevel: 4,
    openingHours: "12:00am - 9:00am",
  };

  return [restaurant1, restaurant2];
}

app.get(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/restaurants`,
  async (request, response) => {
    const restaurants = getRestaurants();
    response.json({
      status: 200,
      data: Object.values(restaurants),
    });
  }
);

const port = 8080;
const server = app.listen(port, () =>
  console.log(`Server listening on port: ${port}`)
);

const io = require("socket.io")(server);

io.on("connection", (socket) => {
  socket.on("data submitted", (eventID) => {
    io.emit("refresh", eventID);
  });
});
