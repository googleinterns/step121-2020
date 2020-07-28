const socket = io();
socket.emit("join", getEventId());

window.onload = function () {
  searchRestaurants();

  document.getElementById("search-btn").addEventListener("click", async () => {
    const nameInput = document.getElementById("name-input");
    const name = nameInput.value;

    const addressInput = document.getElementById("address-input");
    const address = addressInput.value;

    let lat = null;
    let long = null;

    if (address === "") {
      // Use Geolocation
      try {
        const {
          coords: { latitude, longitude },
        } = await getPosition({ enableHighAccuracy: true });
        lat = latitude;
        long = longitude;
      } catch (err) {
        alert("Failed to get position, please enter address.");
        return;
      }
    } else {
      const coords = await (await fetch(`/api/geocode?address=${address}`)).json();

      if (coords.status === 200) {
        lat = coords.data.lat;
        long = coords.data.lng;
      } else {
        alert(
          "We could not find the latitude and longitude of that address. Please check your address for misspellings."
        );
        return;
      }
    }

    let postResponse;
    const eventId = getEventId();
    try {
      const resp = await fetch(`api/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          location: [lat, long],
        }),
      });
      postResponse = await resp.json();
    } catch (err) {
      console.log(err);
      alert("error posting to api");
      return;
    }

    if (postResponse.status !== 200) {
      // TODO(ved): How should we display errors?
      console.log(postResponse.error);
      alert("error posting to api");
      return;
    }

    //Data was submitted successfully. We send a message to the server to then update each client with the same event ID.
    socket.emit("data submitted", eventId);
    nameInput.value = "";
    addressInput.value = "";
  });

  document.getElementById("participants-btn").addEventListener("click", () => {
    const eventId = getEventId();
    window.location.href = `${window.location.origin}/${eventId}/participants`;
  });
};

function getPosition(options) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  );
}

//This message is recieved from the server indicating that information has been submitted, and the client needs to refresh.
socket.on("refresh", () => {
  console.log(
    "Refresh message received from server via Socket.io. Refreshing restaurant results."
  );
  searchRestaurants();
});

async function searchRestaurants() {
  const eventId = getEventId();
  const response = await (await fetch(`/api/${eventId}/restaurants`)).json();
  if (response.status !== 200) {
    console.log("Error fetching restaurants: " + response.error);
    return;
  }

  initMap();
  showRestaurants(response.data);
}

/**
 * Creates HTML elements for the restaurant details and adds it
 * to a container in searchResults.html.
 *
 * For now, this function deals with hard-coded data, but this
 * can be used as a template for when we get data the Places Library results.
 */
function showRestaurants(allRestaurants) {
  const restaurantContainer = document.getElementById("restaurant-container");

  if (!allRestaurants.hasOwnProperty("results")) {
    let instructions = document.createElement("p");
    instructions.classList.add("search-instructions");
    instructions.appendChild(
      document.createTextNode(
        "No one has added their information yet! Fill out the form above to start seeing some results."
      )
    );

    restaurantContainer.appendChild(instructions);
    return;
  }

  restaurantContainer.innerHTML = "";

  //This will be used to create a new div for every restaurant returned by the Places Library:
  allRestaurants.results.forEach((restaurant) => {
    let restaurantDiv = document.createElement("div");
    restaurantDiv.classList.add("restaurant-card");

    // Add information to the left side of the restaurant card. This contains name and atmospheric information
    let leftDiv = document.createElement("div");

    let name = document.createElement("h2");
    name.classList.add("restaurant-name");
    let restaurantName = restaurant.hasOwnProperty("name")
      ? restaurant.name
      : "";
    name.appendChild(document.createTextNode(restaurantName));
    leftDiv.appendChild(name);

    let rating = document.createElement("p");
    rating.classList.add("restaurant-info");
    let restaurantRating = restaurant.hasOwnProperty("rating")
      ? restaurant.rating
      : "Unknown";
    rating.appendChild(document.createTextNode("Rating: " + restaurantRating));
    leftDiv.appendChild(rating);

    restaurantDiv.appendChild(leftDiv);

    //Add information to the left side of the restaurant card. This contains contact information.
    let rightDiv = document.createElement("div");

    let address = document.createElement("p");
    address.classList.add("restaurant-basic-info");
    let restaurantVicinity = restaurant.hasOwnProperty("vicinity")
      ? restaurant.vicinity
      : "";
    address.appendChild(document.createTextNode(restaurantVicinity));
    rightDiv.appendChild(address);

    let openingHours = document.createElement("p");
    openingHours.classList.add("restaurant-basic-info");
    let restaurantHours = restaurant.hasOwnProperty("opening_hours")
      ? Object.values(restaurant.opening_hours)
      : "Unknown";
    openingHours.appendChild(
      document.createTextNode("Open Now: " + restaurantHours)
    );
    rightDiv.appendChild(openingHours);

    restaurantDiv.appendChild(rightDiv);
    restaurantContainer.appendChild(restaurantDiv);
  });
}

// Initializes a map
function initMap() {
  const map = new google.maps.Map(document.getElementById("map"), {
    center: {
      lat: 46.2276,
      lng: 2.2137,
    },
    zoom: 6,
  });

  const Marker = new google.maps.Marker({
    position: {
      lat: 48.8584,
      lng: 2.2945,
    },
    map: map,
    title: "Eiffel tower",
  });
}
