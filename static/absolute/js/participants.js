async function showParticipants() {
  const eventId = getEventId();
  const response = await (await fetch(`/api/${eventId}/participants`)).json();
  if (response.status === 200) {
    const participantContainer = document.getElementById(
      "participant-container"
    );
    const participants = response.data;
    participants
      .map((p) => ({ ...p, location: `${p.lat},${p.long}` }))
      .forEach((participant) => {
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
}

showParticipants();
