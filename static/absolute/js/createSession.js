const createButton = document.getElementById("start-session-btn");
createButton.addEventListener("click", async () => {
  const response = await (
    await fetch("api/create", {
      method: "POST",
    })
  ).json();
  const { eventID } = response;
  window.location.href = `/${eventID}`;
});
