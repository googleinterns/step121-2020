const socket = io();
socket.emit("join", getEventId());

window.onload = function () {
  initInviteButton();
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
        headers: window.HEADER_CONTENT_TYPE_JSON,
        body: JSON.stringify({
          name,
          address,
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

async function initInviteButton() {
  const response = await (await fetch(`api/${getEventId()}/name`)).json();
  const name = response.data;
  const inviteButton = document.getElementById("share-invite-btn");
  inviteButton.textContent = `Copy Invite URL for "${name}"`;
}

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

  fetch(`/api/${eventId}/me`)
    .then((response) => response.json())
    .then(({ data: { name, address } = {} }) => {
      document.getElementById("name-input").value = name ? name : "";
      document.getElementById("address-input").value = address ? address : "";
    });

  let failure = false;
  let map = null;
  const LACoords = [34.052235, -118.243683];

  fetch(`/api/${eventId}/participants`)
    .then((response) => response.json())
    .then(({ status, data }) => {
      if (status != 200 || failure) {
        failure = true;
        return;
      }
      const { participants, center } = data;
      if (participants.length == 0) {
        if (center !== null)
          console.error(`Expected center to be null, it was: ${center}`);
        // If there's no participants, center the map around LA
        map = centerMap(map, ...LACoords);
      } else {
        const { latitude, longitude } = center;
        map = centerMap(map, latitude, longitude);
        addParticipants(map, participants);
      }
    });

  fetch(`/api/${eventId}/restaurants`)
    .then((response) => response.json())
    .then(({ status, data }) => {
      if (status != 200 || failure) {
        failure = true;
        return;
      }
      const { places, center } = data;
      if (places.length === 0) {
        if (center !== null)
          console.error(`Expected center to be null, it was: ${center}`);
        map = centerMap(map, ...LACoords);
      } else {
        const { latitude, longitude } = center;
        map = centerMap(map, latitude, longitude);
        const domNodes = showRestaurants(places);
        addRestaurants(map, places, domNodes);
      }
    });
}

/**
 * Creates HTML elements for the restaurant details and adds it
 * to a container in searchResults.html.
 */
function showRestaurants(restaurants) {
  const restaurantContainer = document.getElementById("restaurant-container");

  restaurantContainer.innerHTML = "";

  if (restaurants.length === 0) {
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

  const domNodes = [];
  //This will be used to create a new div for every restaurant returned by the Places Library:
  for (const restaurant of restaurants) {
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
    domNodes.push(restaurantDiv);
    restaurantContainer.appendChild(restaurantDiv);
  }
  return domNodes;
}

function addParticipants(map, participants) {
  const personIcon = "../images/personIcon.png";
  for (const participant of participants) {
    new google.maps.Marker({
      position: {
        lat: participant.lat,
        lng: participant.long,
      },
      map,
      title: participant.name,
      icon: personIcon,
      animation: google.maps.Animation.DROP,
    });
  }
}

function addRestaurants(map, restaurants, restaurantCards) {
  for (let i = 0; i < restaurants.length; i++) {
    const restaurant = restaurants[i];
    const card = restaurantCards[i];
    const marker = new google.maps.Marker({
      position: {
        lat: restaurant.geometry.location.lat,
        lng: restaurant.geometry.location.lng,
      },
      map: map,
      title: restaurant.name,
    });
    marker.addListener("click", () => {
      card.scrollIntoView({ behavior: "smooth", alignToTop: true });
    });
  }
}

function centerMap(map, lat, lng) {
  // Don't need to worry about race conditions b/c JS is single threaded
  if (map === null) {
    map = new google.maps.Map(document.getElementById("map"), {
      center: {
        lat,
        lng,
      },
      zoom: 13,
    });
  } else {
    map.setCenter(new google.maps.LatLng(lat, lng));
  }
  return map;
}
