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
        showRestaurants(places);
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
    const instructions = document.createElement("p");
    instructions.classList.add("search-instructions");
    instructions.appendChild(
      document.createTextNode(
        "No one has added their information yet! Fill out the form above to start seeing some results."
      )
    );
    restaurantContainer.appendChild(instructions);
    return;
  }

  //Create a new div for every restaurant returned by the Places Library:
  let restaurantIndex = 1;
  const domNodes = [];
  //This will be used to create a new div for every restaurant returned by the Places Library:
  for (const restaurant of restaurants) {
    //Create a section to hold information about each restaurant.
    const infoDiv = document.createElement("div");
    infoDiv.classList.add("info-div");

    //Create a section to hold the image.
    try {
      const imageDiv = document.createElement("div");

      const width = "150"; //px
      const placePhotosRequest =
        "https://maps.googleapis.com/maps/api/place/photo?photoreference=" +
        restaurant.photos[0].photo_reference +
        "&maxwidth=" +
        width +
        "&key=" +
        "ApiKey";

      const image = document.createElement("img");
      image.src = placePhotosRequest;
      image.width = width;

      imageDiv.appendChild(image);
      infoDiv.appendChild(imageDiv);
    } catch (err) {
      console.log("Restaurant image could not be retrieved. Error: " + err);
    }

    // Add information to the left side of the restaurant card. This contains name and atmospheric information.
    const leftDiv = document.createElement("div");

    const name = document.createElement("h2");
    name.classList.add("restaurant-name");
    const restaurantName = restaurant.hasOwnProperty("name")
      ? restaurant.name
      : "";
    name.appendChild(
      document.createTextNode(restaurantIndex + ". " + restaurantName)
    );
    leftDiv.appendChild(name);

    if (restaurant.hasOwnProperty("rating")) {
      const rating = document.createElement("p");
      rating.classList.add("restaurant-info");
      rating.appendChild(
        document.createTextNode("Rating: " + restaurant.rating)
      );
      leftDiv.appendChild(rating);
    }

    if (restaurant.hasOwnProperty("price_level")) {
      const priceLevel = document.createElement("p");
      priceLevel.classList.add("restaurant-info");
      priceLevel.appendChild(
        document.createTextNode("$".repeat(restaurant.price_level))
      );
      leftDiv.appendChild(priceLevel);
    }

    infoDiv.appendChild(leftDiv);

    //Add information to the left side of the restaurant card. This contains basic and contact information.
    const rightDiv = document.createElement("div");

    if (restaurant.hasOwnProperty("vicinity")) {
      const address = document.createElement("p");
      address.classList.add("restaurant-basic-info");
      address.appendChild(document.createTextNode(restaurant.vicinity));
      rightDiv.appendChild(address);
    }

    if (
      restaurant.hasOwnProperty("additional_details") &&
      restaurant.additional_details.hasOwnProperty("formatted_phone_number")
    ) {
      const phoneNumber = document.createElement("p");
      phoneNumber.classList.add("restaurant-basic-info");
      phoneNumber.appendChild(
        document.createTextNode(
          restaurant.additional_details.formatted_phone_number
        )
      );
      rightDiv.appendChild(phoneNumber);
    }

    if (
      restaurant.hasOwnProperty("additional_details") &&
      restaurant.additional_details.hasOwnProperty("website")
    ) {
      const website = document.createElement("p");
      website.classList.add("restaurant-basic-info");

      const link = document.createElement("a");
      link.appendChild(document.createTextNode("Website"));
      link.href = restaurant.additional_details.website;

      website.appendChild(link);
      rightDiv.appendChild(website);
    }

    if (restaurant.hasOwnProperty("opening_hours")) {
      const openingHours = document.createElement("p");
      openingHours.classList.add("restaurant-basic-info");
      const openNow = Object.values(restaurant.opening_hours)
        ? "Open Now"
        : "Closed Now";

      openingHours.appendChild(document.createTextNode(openNow));
      rightDiv.appendChild(openingHours);
    }

    infoDiv.appendChild(rightDiv);

    //Show reviews and a link to restaurant listing on Google when 'show more' button is clicked.
    const moreInfoDiv = document.createElement("div");
    moreInfoDiv.classList.add("restaurant-info");

    //Add review section to the card.
    if (
      restaurant.hasOwnProperty("additional_details") &&
      restaurant.additional_details.hasOwnProperty("reviews")
    ) {
      const reviewContainer = document.createElement("div");

      //Create header for review section.
      const reviewDivHeader = document.createElement("h3");
      reviewDivHeader.appendChild(document.createTextNode("Reviews"));
      reviewDivHeader.classList.add("review-header");
      reviewContainer.appendChild(reviewDivHeader);

      reviewContainer.appendChild(document.createElement("hr"));

      const reviews = restaurant.additional_details.reviews;
      for (i = 0; i < reviews.length && i < 2; i++) {
        //Show only two results for simplicity.
        const reviewerName = reviews[i].hasOwnProperty("author_name")
          ? reviews[i].author_name
          : "";
        const reviewTime = reviews[i].hasOwnProperty(
          "relative_time_description"
        )
          ? reviews[i].relative_time_description
          : "";

        const individualReviewHeader = document.createElement("p");
        individualReviewHeader.appendChild(
          document.createTextNode(reviewerName + " - " + reviewTime)
        );
        const reviewText = document.createElement("p");
        reviewText.appendChild(
          document.createTextNode('"' + reviews[i].text + '"')
        );

        const individualReviewDiv = document.createElement("div");
        individualReviewDiv.classList.add("individual-review");
        individualReviewDiv.appendChild(individualReviewHeader);
        individualReviewDiv.appendChild(reviewText);

        reviewContainer.appendChild(individualReviewDiv);
        reviewContainer.appendChild(document.createElement("hr"));
      }
      moreInfoDiv.appendChild(reviewContainer);
      moreInfoDiv.appendChild(document.createElement("br"));
    }

    if (
      restaurant.hasOwnProperty("additional_details") &&
      restaurant.additional_details.hasOwnProperty("url")
    ) {
      const listingLink = document.createElement("a");
      listingLink.appendChild(document.createTextNode("See Listing on Google"));
      listingLink.href = restaurant.additional_details.url;

      moreInfoDiv.appendChild(listingLink);
    }

    moreInfoDiv.style.display = "none";

    //Create a link to show and hide the moreInfoDiv (reviews and restaurant listing).
    const showMoreLink = document.createElement("p");
    showMoreLink.classList.add("show-more-link", "restaurant-info");
    showMoreLink.innerHTML = "Show More &#8595;"; //With down arrow

    showMoreLink.onclick = function () {
      if (moreInfoDiv.style.display === "inline") {
        moreInfoDiv.style.display = "none";
        showMoreLink.innerHTML = "Show More &#8595;"; //With down arrow
      } else {
        moreInfoDiv.style.display = "inline";
        showMoreLink.innerHTML = "Show Less &#8593;"; //With up arrow
      }
    };

    //Add the two info sections and show more/show less button to a restaurant card div.
    const restaurantCardDiv = document.createElement("div");
    restaurantCardDiv.classList.add("restaurant-card");

    restaurantCardDiv.appendChild(infoDiv);
    restaurantCardDiv.appendChild(moreInfoDiv);
    restaurantCardDiv.appendChild(showMoreLink);

    domNodes.push(restaurantCardDiv);
    restaurantContainer.appendChild(restaurantCardDiv);
    restaurantIndex++;
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
      card.classList.add("scroll-to");
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
