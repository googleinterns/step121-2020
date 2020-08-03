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
 */
async function showRestaurants(restaurantResponse) {
  const restaurantContainer = document.getElementById("restaurant-container");
  restaurantContainer.innerHTML = "";

  if (restaurantResponse.status !== 200) {
    let restaurantErrorMessage = document.createElement("p");
    restaurantErrorMessage.classList.add("search-instructions");
    let messageText =
      restaurantResponse.data === "ZERO_RESULTS"
        ? "We could not find any restaurants. Check to make sure you are using the correct address."
        : "Something went wrong when searching for restaurants.";
    restaurantErrorMessage.appendChild(document.createTextNode(messageText));

    restaurantContainer.appendChild(restaurantErrorMessage);
    return;
  }

  const allRestaurants = restaurantResponse.data;

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

  //Used to get additional information about the restaurant results.
  const fields = "url,formatted_phone_number,website,review";

  //Create a new div for every restaurant returned by the Places Library:
  let restaurantIndex = 1;
  for (restaurant of allRestaurants.results) {
    //Get additional details for every restaurant using that restaurant's place id.
    let placeDetailsResponse = await (
      await fetch(
        `/api/placedetails?fields=${fields}&id=${restaurant.place_id}`
      )
    ).json();

    let additionalDetails =
      placeDetailsResponse.status === 200
        ? placeDetailsResponse.data.result
        : {};

    //Create a restaurant card to hold information about each restaurant.
    let infoDiv = document.createElement("div");
    infoDiv.classList.add("info-div");

    //Create a section to hold the image.
    try {
      let imageDiv = document.createElement("div");

      let width = "150"; //px
      let placePhotosRequest =
        "https://maps.googleapis.com/maps/api/place/photo?photoreference=" +
        restaurant.photos[0].photo_reference +
        "&maxwidth=" +
        width +
        "&key=" +
        "APIKey";

      let image = document.createElement("img");
      image.src = placePhotosRequest;
      image.width = width;

      imageDiv.appendChild(image);
      infoDiv.appendChild(imageDiv);
    } catch (err) {
      console.log("Restaurant image could not be retrieved. Error: " + err);
    }

    // Add information to the left side of the restaurant card. This contains name and atmospheric information.
    let leftDiv = document.createElement("div");

    let name = document.createElement("h2");
    name.classList.add("restaurant-name");
    let restaurantName = restaurant.hasOwnProperty("name")
      ? restaurant.name
      : "";
    name.appendChild(
      document.createTextNode(restaurantIndex + ". " + restaurantName)
    );
    leftDiv.appendChild(name);

    if (restaurant.hasOwnProperty("rating")) {
      let rating = document.createElement("p");
      rating.classList.add("restaurant-info");
      rating.appendChild(
        document.createTextNode("Rating: " + restaurant.rating)
      );
      leftDiv.appendChild(rating);
    }

    if (restaurant.hasOwnProperty("price_level")) {
      let priceLevel = document.createElement("p");
      priceLevel.classList.add("restaurant-info");
      priceLevel.appendChild(
        document.createTextNode("$".repeat(restaurant.price_level))
      );
      leftDiv.appendChild(priceLevel);
    }

    infoDiv.appendChild(leftDiv);

    //Add information to the left side of the restaurant card. This contains basic and contact information.
    let rightDiv = document.createElement("div");

    if (restaurant.hasOwnProperty("vicinity")) {
      let address = document.createElement("p");
      address.classList.add("restaurant-basic-info");
      address.appendChild(document.createTextNode(restaurant.vicinity));
      rightDiv.appendChild(address);
    }

    if (additionalDetails.hasOwnProperty("formatted_phone_number")) {
      let phoneNumber = document.createElement("p");
      phoneNumber.classList.add("restaurant-basic-info");
      phoneNumber.appendChild(
        document.createTextNode(additionalDetails.formatted_phone_number)
      );
      rightDiv.appendChild(phoneNumber);
    }

    if (additionalDetails.hasOwnProperty("website")) {
      let website = document.createElement("p");
      website.classList.add("restaurant-basic-info");

      let link = document.createElement("a");
      link.appendChild(document.createTextNode("Website"));
      link.href = additionalDetails.website;

      website.appendChild(link);
      rightDiv.appendChild(website);
    }

    if (restaurant.hasOwnProperty("opening_hours")) {
      let openingHours = document.createElement("p");
      openingHours.classList.add("restaurant-basic-info");
      let openNow = Object.values(restaurant.opening_hours)
        ? "Open Now"
        : "Closed Now";

      openingHours.appendChild(document.createTextNode(openNow));
      rightDiv.appendChild(openingHours);
    }

    infoDiv.appendChild(rightDiv);

    //Show reviews and a link to restaurant listing on Google when 'show more' button is clicked.
    let moreInfoDiv = document.createElement("div");
    moreInfoDiv.classList.add("restaurant-info");

    //Add review section to the card.
    if (additionalDetails.hasOwnProperty("reviews")) {
      let reviewContainer = document.createElement("div");

      //Create header for review section.
      let reviewDivHeader = document.createElement("h3");
      reviewDivHeader.appendChild(document.createTextNode("Reviews"));
      reviewDivHeader.classList.add("review-header");
      reviewContainer.appendChild(reviewDivHeader);

      reviewContainer.appendChild(document.createElement("hr"));

      let reviews = additionalDetails.reviews;
      for (i = 0; i < reviews.length && i < 2; i++) {
        //Show only two results for simplicity.
        let reviewerName = reviews[i].hasOwnProperty("author_name")
          ? reviews[i].author_name
          : "";
        let reviewTime = reviews[i].hasOwnProperty("relative_time_description")
          ? reviews[i].relative_time_description
          : "";

        let individualReviewHeader = document.createElement("p");
        individualReviewHeader.appendChild(
          document.createTextNode(reviewerName + " - " + reviewTime)
        );
        let reviewText = document.createElement("p");
        reviewText.appendChild(
          document.createTextNode('"' + reviews[i].text + '"')
        );

        let individualReviewDiv = document.createElement("div");
        individualReviewDiv.classList.add("individual-review");
        individualReviewDiv.appendChild(individualReviewHeader);
        individualReviewDiv.appendChild(reviewText);

        reviewContainer.appendChild(individualReviewDiv);
        reviewContainer.appendChild(document.createElement("hr"));
      }
      moreInfoDiv.appendChild(reviewContainer);
      moreInfoDiv.appendChild(document.createElement("br"));
    }

    if (additionalDetails.hasOwnProperty("url")) {
      let listingLink = document.createElement("a");
      listingLink.appendChild(document.createTextNode("See Listing on Google"));
      listingLink.href = additionalDetails.url;

      moreInfoDiv.appendChild(listingLink);
    }

    moreInfoDiv.style.display = "none";

    //Create a link to show and hide the moreInfoDiv (reviews and restaurant listing).
    let showMoreLink = document.createElement("p");
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
    let restaurantCardDiv = document.createElement("div");
    restaurantCardDiv.classList.add("restaurant-card");

    restaurantCardDiv.appendChild(infoDiv);
    restaurantCardDiv.appendChild(moreInfoDiv);
    restaurantCardDiv.appendChild(showMoreLink);

    restaurantContainer.appendChild(restaurantCardDiv);
    restaurantIndex++;
  }
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
