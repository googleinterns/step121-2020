const socket = io();

window.onload = function () {
  restaurantSearch();
  
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
      if (/[`!#$%\^&*+=\-\[\]\\';/{}|\\":<>\?]/.test(address)) {
        alert("Invalid characters were entered with the address. Please remove them and try again.");
        return;
      }

      let formattedAddress = address.replace(" ", "%20");
      formattedAddress = formattedAddress.replace(",", "%2C");
      const coords = await (await fetch(`/api/${formattedAddress}/geocode`)).json();
      
      if (coords.status === 200) {
        lat = coords.data.lat;
        long = coords.data.lng;
      } else {
        alert("We could not find the latitude and longitude of that address."
        + "Please try again, and make sure to follow the address guidelines.");
        return;
      }
    }

    let data;
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
      data = await resp.json();
    } catch (err) {
      console.log(err);
      alert("error posting to api");
      return;
    }

    if (data.status !== 200) {
      // TODO(ved): How should we display errors?
      console.log(data.error);
      alert("error posting to api");
      return;
    }

    socket.emit('data submitted', eventId);
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

async function getCoordinates(address) {
  let formattedAddress = address.replace(" ", "%20");
  formattedAddress = formattedAddress.replace(",", "%2C");
  const coords = await (await fetch(`/api/${formattedAddress}/geocode`)).json();
  return coords;
}
 
socket.on('refresh', (eventId) => {
  if (getEventId() === eventId) {
    console.log('Refresh message received from server via Socket.io. Refreshing restaurant results.');
    restaurantSearch();
  };
});
 
async function restaurantSearch() {
  const eventId = getEventId();
  const response = await (await fetch(`/api/${eventId}/restaurants`)).json();
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
  restaurantContainer.innerHTML = "";

  //This will be used to create a new div for every restaurant returned by the Places Library:
  allRestaurants.forEach((restaurant) => {
    let restaurantDiv = document.createElement("div");
    restaurantDiv.classList.add("restaurant-card");

    // Add information to the left side of the restaurant card. This contains name and atmospheric information
    let leftDiv = document.createElement("div");

    let name = document.createElement("h2");
    name.classList.add("restaurant-name");
    name.appendChild(document.createTextNode(restaurant.name));
    leftDiv.appendChild(name);

    let location = document.createElement("p");
    location.classList.add("restaurant-info");
    location.appendChild(
      document.createTextNode("Rating: " + restaurant.rating)
    );
    leftDiv.appendChild(location);

    restaurantDiv.appendChild(leftDiv);

    //Add information to the left side of the restaurant card. This contains contact information.
    let rightDiv = document.createElement("div");

    let address = document.createElement("p");
    address.classList.add("restaurant-basic-info");
    address.appendChild(document.createTextNode(restaurant.address));
    rightDiv.appendChild(address);

    let openingHours = document.createElement("p");
    openingHours.classList.add("restaurant-basic-info");
    openingHours.appendChild(document.createTextNode(restaurant.openingHours));
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
