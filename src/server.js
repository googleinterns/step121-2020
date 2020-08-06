const { v4: uuidv4 } = require("uuid");
const process = require("process");
const path = require("path");
const express = require("express");
const fromEntries = require("object.fromentries");
const cookieSession = require("cookie-session");
const datastore = require("./datastore");
const fetch = require("node-fetch");
const { env } = process;

const app = express();

const KIND_EVENT = "Event";
const URL_PARAM_EVENT_ID = `eventID`;

// TODO(ved): There's definitely a cleaner way to do this.
const PREFIX_API = "/api";

const ERROR_BAD_DB_INTERACTION = "BAD_DATABASE";
const ERROR_INVALID_EVENT_ID = "INVALID_EVENT_ID";
const ERROR_BAD_UUID = "BAD_UUID";
const ERROR_GEOCODING_FAILED = "GEOCODING_FAILED";
const ERROR_REVERSE_GEOCODING_FAILED = "REVERSE_GEOCODING_FAILED";
const ERROR_BAD_PLACES_API_INTERACTION = "BAD_PLACES_API";
const ERROR_PLACE_DETAILS_FAILED = "PLACE_DETAILS_FAILED";

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

app.post(`${PREFIX_API}/create`, async (request, response) => {
  const { name } = request.body;
  const key = datastore.key([KIND_EVENT]);
  const result = await datastore.save({ key, data: { users: {}, name } });
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
    const [lat, long] = body.location;
    const { name, address } = body;

    event.users = event.users || {};
    const userInfo = event.users[request.session.userID] || {};
    event.users[request.session.userID] = {
      ...userInfo,
      name,
      lat,
      long,
      address,
    };
    datastore
      // Datastore attaches a "symbol" (https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
      // to any entities returned from a query. We don't want to store this attached metadata back into the database
      // so we remove it with Object.fromEntries
      .save({ key, data: fromEntries(Object.entries(event)) })
      .then(() => {
        response.json({ status: 200 });
        io.in(request.params[URL_PARAM_EVENT_ID]).emit("refresh");
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
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/name`,
  getEvent,
  async (request, response) => {
    response.json({ status: 200, data: request.event.name });
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
  if (coords.length === 0) {
    return {};
  }
  if (coords.length === 1) {
    return {
      latitude: coords[0].lat,
      longitude: coords[0].long,
    };
  } else {
    let x = 0.0;
    let y = 0.0;
    let z = 0.0;
    for (let coord of coords) {
      let latitude = (coord.lat * Math.PI) / 180;
      let longitude = (coord.long * Math.PI) / 180;

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
}

app.get(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/restaurants`,
  getEvent,
  async (request, response) => {
    const { event } = request;
    const users = event.users || {};
    const userData = Object.values(users);

    if (userData.length > 0) {
      const { latitude, longitude } = averageGeolocation(userData);
      const lat = latitude.toString();
      const long = longitude.toString();
      const rankby = "distance";
      const type = "restaurant";
      const minprice = "0";
      const maxprice = "4";

      try {
        const placesApiResponse = await (
          await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${long}&rankby=${rankby}&type=${type}&minprice=${minprice}&maxprice=${maxprice}&key=${env.API_KEY_PLACES}`
          )
        ).json();

        const { status } = placesApiResponse;
        if (status !== "OK") {
          console.error("Places API error. Status: " + status);
          response.status(500).json({
            status: 500,
            error: { type: status },
          });
        } else {
          // Normalize undefined or null to an empty array
          response.json({
            status: 200,
            data: {
              places: placesApiResponse.results || [],
              attributions: placesApiResponse.html_attributions || [],
              center: { latitude, longitude },
            },
          });
        }
        // Catch Fetch error
      } catch (err) {
        console.error("Fetch error");
        response.status(500).json({
          status: 500,
          error: { type: ERROR_BAD_PLACES_API_INTERACTION },
        });
      }
    } else {
      response.json({
        status: 200,
        data: {
          places: [],
          attributions: [],
          center: null,
        },
      });
    }
  }
);

app.get(`${PREFIX_API}/placedetails`, async (request, response) => {
  const placeId = encodeForURL(request.query.id);
  const fields = encodeForURL(request.query.fields);

  const placeDetailsRequest =
    "https://maps.googleapis.com/maps/api/place/details/json?place_id=" +
    placeId +
    "&fields=" +
    fields +
    "&key=" +
    env.API_KEY_PLACES;

  try {
    const placeDetailsResponse = await (
      await fetch(placeDetailsRequest)
    ).json();
    const responseStatus = placeDetailsResponse.status;

    if (responseStatus !== "OK") {
      console.error(
        "Place Details error occured. Api response status: " + responseStatus
      );
      response
        .status(500)
        .json({ status: 500, error: { type: responseStatus } });
    } else {
      response.json({
        status: 200,
        data: placeDetailsResponse,
      });
    }
  } catch (err) {
    console.error(err);
    response
      .status(500)
      .json({ status: 500, error: { type: ERROR_PLACE_DETAILS_FAILED } });
  }
});

app.get(
  `${PREFIX_API}/:${URL_PARAM_EVENT_ID}/participants`,
  getEvent,
  async (request, response) => {
    const { event } = request;
    const users = Object.values(event.users || {});
    response.json({
      status: 200,
      data: {
        participants: users,
        center: users.length > 0 ? averageGeolocation(users) : null,
      },
    });
  }
);

app.get(`${PREFIX_API}/geocode`, async (request, response) => {
  const address = encodeForURL(request.query.address);

  const geocodeRequest =
    "https://maps.googleapis.com/maps/api/geocode/json?address=" +
    address +
    "&key=" +
    env.API_KEY_GEOCODE;

  try {
    const geocodeResponse = await (await fetch(geocodeRequest)).json();
    const geocodeResponseStatus = geocodeResponse.status;

    if (geocodeResponseStatus !== "OK") {
      console.error(
        "Geocoding error occured. Api response status: " + geocodeResponseStatus
      );
      response
        .status(500)
        .json({ status: 500, error: { type: geocodeResponseStatus } });
    } else {
      response.json({
        status: 200,
        //TODO (Asha): Display the location (and other user information) currently used the user in case they want to change it. This will be helpful if the most relevent geocoding response is not the one the user wants.
        data: geocodeResponse.results[0].geometry.location,
      });
    }
  } catch (err) {
    console.error(err);
    response
      .status(500)
      .json({ status: 500, error: { type: ERROR_GEOCODING_FAILED } });
  }
});

function encodeForURL(string) {
  const formattedString = encodeURIComponent(string)
    .replace("!", "%21")
    .replace("*", "%2A")
    .replace("'", "%27")
    .replace("(", "%28")
    .replace(")", "%29");
  return formattedString;
}

app.get(`${PREFIX_API}/reverseGeocode`, async (request, response) => {
  const latlng = request.query.latlng;

  const reverseGeocodeRequest = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=
    ${env.API_KEY_GEOCODE}`;

  try {
    const reverseGeocodeResponse = await (
      await fetch(reverseGeocodeRequest)
    ).json();
    const { status } = reverseGeocodeResponse;

    if (status !== "OK") {
      console.error(
        "Reverse Geocoding error occured. Api response status: " + status
      );
      response.status(500).json({ status: 500, error: { type: status } });
    } else {
      response.json({
        status: 200,
        data: reverseGeocodeResponse.results[0].formatted_address,
      });
    }
  } catch (err) {
    console.error(err);
    response
      .status(500)
      .json({ status: 500, error: { type: ERROR_REVERSE_GEOCODING_FAILED } });
  }
});

const port = 8080;
const server = app.listen(port, () =>
  console.log(`Server listening on http://localhost:${port}`)
);

//Attach Socket.io to the existing express server.
const io = require("socket.io")(server);

//When socket.io is connected to the server, we can listen for events.
io.on("connection", (socket) => {
  //Add client socket to a room based on the session ID. This will allow only clients with the same ID to communicate.
  socket.on("join", (eventId) => {
    socket.join(eventId);
  });
});
