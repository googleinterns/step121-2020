window.onload = function () {
  initMap();
  showRestaurants();
};

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
