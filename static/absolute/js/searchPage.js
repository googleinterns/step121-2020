const socket = io();
socket.emit("join", getEventId());

window.onload = function () {
  refreshUI();

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
      const coords = await (
        await fetch(`/api/geocode?address=${address}`)
      ).json();

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
    nameInput.value = "";
    addressInput.value = "";
  });

  document.getElementById("participants-btn").addEventListener("click", () => {
    const eventId = getEventId();
    window.location.href = `${window.location.origin}/${eventId}/participants`;
  });
  document.getElementById("share-invite-btn").addEventListener("click", () => {
    const url = `${window.location.origin}/${getEventId()}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert("Invite url copied to clipboard.");
      })
      .catch((err) => {
        alert("Failed to copy url to clipboard.");
      });
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
  refreshUI();
});

async function refreshUI() {
  const eventId = getEventId();
  const participantsResponse = await (
    await fetch(`/api/${eventId}/participants`)
  ).json();
  const restaurantsResponse = await (
    await fetch(`/api/${eventId}/restaurants`)
  ).json();

  initMap(participantsResponse, restaurantsResponse);
  showRestaurants(restaurantsResponse);
}

/**
 * Creates HTML elements for the restaurant details and adds it
 * to a container in searchResults.html.
 *
 * For now, this function deals with hard-coded data, but this
 * can be used as a template for when we get data the Places Library results.
 */
function showRestaurants(restaurantsResponse) {
  const allRestaurants = restaurantsResponse.data;
  const restaurantContainer = document.getElementById("restaurant-container");

  restaurantContainer.innerHTML = "";

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
    let openNow = "";
    if (restaurant.hasOwnProperty("opening_hours")) {
      openNow = Object.values(restaurant.opening_hours)
        ? "Open Now"
        : "Closed now";
    }
    openingHours.appendChild(document.createTextNode(openNow));
    rightDiv.appendChild(openingHours);

    restaurantDiv.appendChild(rightDiv);
    restaurantContainer.appendChild(restaurantDiv);
  });
}

// Initializes a Map.
async function initMap(participantsResponse, restaurantsResponse) {
  const eventId = getEventId();

  // Checks if restaurant API responses is successful and restaurant data is not empty.
  // Restuarant data could be empty in the case where there are no active participants in the database.
  if (
    restaurantsResponse.status === 200 &&
    restaurantsResponse.data.hasOwnProperty("results")
  ) {
    const map = new google.maps.Map(document.getElementById("map"), {
      // Centers Map around average geolocation when there is at least one participant.
      center: {
        lat: restaurantsResponse.location.latitude,
        lng: restaurantsResponse.location.longitude,
      },
      zoom: 13,
    });
    // Add restaurant markers.
    const restaurants = restaurantsResponse.data.results;
    restaurants.forEach((restaurant) => {
      new google.maps.Marker({
        position: {
          lat: restaurant.geometry.location.lat,
          lng: restaurant.geometry.location.lng,
        },
        map: map,
        title: restaurant.name,
      });
    });
    // Add participants markers.
    const participants = participantsResponse.data;
    const personIcon = "../images/personIcon.png";
    participants.forEach((participant) => {
      new google.maps.Marker({
        position: {
          lat: participant.lat,
          lng: participant.long,
        },
        map: map,
        title: participant.name,
        icon: personIcon,
        animation: google.maps.Animation.DROP,
      });
    });
  } else {
    //Default map is centered around Los Angeles.
    const map = new google.maps.Map(document.getElementById("map"), {
      center: {
        lat: 34.052235,
        lng: -118.243683,
      },
      zoom: 13,
    });
  }
}
