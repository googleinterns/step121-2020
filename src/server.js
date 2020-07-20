const { v4: uuidv4 } = require("uuid");
const express = require("express");
const cookieSession = require("cookie-session");
const datastore = require("./datastore");
const fetch = require("node-fetch");

const app = express();

const KIND_EVENT = "Event";
const URL_PARAM_EVENT_ID = `eventID`;

// TODO(ved): There's definitely a cleaner way to do this.
const PREFIX_API = "/api";

const ERROR_BAD_DB_INTERACTION = "BAD_DATABASE";
const ERROR_INVALID_EVENT_ID = "INVALID_EVENT_ID";
const ERROR_BAD_UUID = "BAD_UUID";

app.use(express.static("static"));

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

app.post(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}`,
  getEvent,
  async (request, response) => {
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

function averageGeolocation(coords) {
  if (coords.length === 1) {
    return coords[0];
  }
  let x = 0.0;
  let y = 0.0;
  let z = 0.0;

  for (let coord of coords) {
    let latitude = (coord.latitude * Math.PI) / 180;
    let longitude = (coord.longitude * Math.PI) / 180;

    x += Math.cos(latitude) * Math.cos(longitude);
    y += Math.cos(latitude) * Math.sin(longitude);
    z += Math.sin(latitude);
  }

  let total = coords.length;

  x = x / total;
  y = y / total;
  z = z / total;

  let centralLongitude = Math.atan2(y, x);
  let centralSquareRoot = Math.sqrt(x * x + y * y);
  let centralLatitude = Math.atan2(z, centralSquareRoot);

  return {
    latitude: (centralLatitude * 180) / Math.PI,
    longitude: (centralLongitude * 180) / Math.PI,
  };
}

let sessionName = "Get together";

// Mock data; expect ~ 37.790831, -122.407169
const sf = [
  {
    latitude: 37.797749,
    longitude: -122.412147,
  },
  {
    latitude: 37.789068,
    longitude: -122.390604,
  },
  {
    latitude: 37.785269,
    longitude: -122.421975,
  },
];

// Mock data; expect ~ 8.670552, -173.207864
const globe = [
  {
    // Japan
    latitude: 37.928969,
    longitude: 138.979637,
  },
  {
    // Nevada
    latitude: 39.029788,
    longitude: -119.594585,
  },
  {
    // New Zealand
    latitude: -39.298237,
    longitude: 175.717917,
  },
];

app.get(`${PREFIX_API}/:${URL_PARAM_EVENT_ID}/restaurants`, function () {
  let lat = averageGeolocation(sf).latitude.toString();
  let long = averageGeolocation(sf).longitude.toString();
  let radius = "50000";
  let type = "restaurant";
  let minprice = "0";
  let maxprice = "4";
  fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${long}&radius=${radius}&type=${type}&minprice=${minprice}&maxprice=${maxprice}&keyword=cruise&key=AIzaSyDDhfcuk15Apx3i72mFSilulsPtJReGhcY`
  ).then((response) => response.json());
});

const port = 8080;
app.get("/", (req, res) => res.redirect("../createSession.html"));
app.listen(port, () =>
  console.log(`Server listening on http://localhost:${port}`)
);
