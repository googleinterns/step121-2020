// Get the event ID from the current URL
function getEventId() {
  // https://ogene.com/1/participants
  const currentURL = window.location.href;
  // https://ogene.com
  const prefix = window.location.origin;
  // 1/participants
  const postfix = currentURL.slice(prefix.length + 1);
  // 1
  const slashIdx = postfix.indexOf("/");
  if (slashIdx !== -1) {
    return parseInt(postfix.slice(0, slashIdx));
  } else {
    return parseInt(postfix);
  }
}
window.getEventId = getEventId;
