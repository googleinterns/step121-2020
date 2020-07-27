window.onload = function () {
  initMap();
  showRestaurants();
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
      // TODO(ved): Use API to convert address --> long/lat
      alert("This is not yet supported");
      return;
    }

    let data;
    try {
      const resp = await fetch(`api/${getEventId()}`, {
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
    initMap();
    nameInput.value = "";
    addressInput.value = "";
  });
  document.getElementById("participants-btn").addEventListener("click", () => {
    const id = getEventId();
    window.location.href = `${window.location.origin}/${id}/participants`;
  });
};

function getPosition(options) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  );
}

/** Some Hard-coded data to display as restaurants temporarily. */
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

const allRestaurants = [restaurant1, restaurant2];

/**
 * Creates HTML elements for the restaurant details and adds it
 * to a container in searchResults.html.
 *
 * For now, this function deals with hard-coded data, but this
 * can be used as a template for when we get data the Places Library results.
 */
function showRestaurants() {
  const restaurantContainer = document.getElementById("restaurant-container");

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

// Initializes a Map.
async function initMap() {
  const eventId = getEventId();
  const response = await (await fetch(`/api/${eventId}/restaurants`)).json();

  // Checks if API response is successful and data is not an empty object.
  // Data could be empty in the case where there are no user locations in the database.
  if (response.status === 200 && Object.keys(response.data).length !== 0) {
    const map = new google.maps.Map(document.getElementById("map"), {
      // Centers Map around average geolocation.
      center: {
        lat: response.location.latitude,
        lng: response.location.longitude,
      },
      zoom: 10,
    });
    const restaurants = response.data.results;
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
  }
}
