/** Some Hard-coded data to display as participants temporarily. */
var participant1 = {
    name: "Spider-man",
    location: "New York"
};
var participant2 = {
    name: "Batman",
    location: "Gotham City"
};
    
var allParticipants = [participant1, participant2];

/**
 * Creates HTML elements for the participant details and adds it
 * to participants.html.
 *
 * For now, this function deals with hard-coded data, but this 
 * can be used as a template for when we get data from Datastore.
 */
function showParticipants() {
    var participantContainer = document.getElementById('participant-container');

    //This will be used to create a new div for every participant grabbed from Datastore:
    allParticipants.forEach(participant => {
        var newDiv = document.createElement('div');
        newDiv.classList.add('participant')

        var name = document.createElement('p');
        name.classList.add('participant-name');
        name.appendChild(document.createTextNode(participant.name));
        newDiv.appendChild(name);

        var location = document.createElement('p');
        location.classList.add('participant-info');
        location.appendChild(document.createTextNode(participant.location));
        newDiv.appendChild(location);

        participantContainer.appendChild(newDiv);
    });
 }