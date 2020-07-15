/** Some Hard-coded data to display as participants temporarily. */

const participant1 = {
  name: "Spider-man",
  location: "New York",
};
const participant2 = {
  name: "Batman",
  location: "Gotham City",
};

const allParticipants = [participant1, participant2];

/**
 * Creates HTML elements for the participant details and adds it
 * to participants.html.
 *
 * For now, this function deals with hard-coded data, but this
 * can be used as a template for when we get data from Datastore.
 */
function showParticipants() {
  const participantContainer = document.getElementById("participant-container");

  //This will be used to create a new div for every participant grabbed from Datastore:
  allParticipants.forEach((participant) => {
    let newDiv = document.createElement("div");
    newDiv.classList.add("participant-card");

    let name = document.createElement("h2");
    name.classList.add("participant-name");
    name.appendChild(document.createTextNode(participant.name));
    newDiv.appendChild(name);

    let location = document.createElement("p");
    location.classList.add("participant-info");
    location.appendChild(document.createTextNode(participant.location));
    newDiv.appendChild(location);

    participantContainer.appendChild(newDiv);
  });
}
