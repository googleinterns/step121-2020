const createButton = document.getElementById("start-session-btn");
createButton.addEventListener("click", async () => {
  const response = await (
    await fetch("api/create", {
      method: "POST",
      headers: window.HEADER_CONTENT_TYPE_JSON,
      body: JSON.stringify({
        name: document.getElementById("session-name").value,
      }),
    })
  ).json();
  const { eventID } = response;
  window.location.href = `/${eventID}`;
});
