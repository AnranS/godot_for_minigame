let position = 0;
let lastPostTime = 0;

worker.onMessage(event => {
  if (event.type === "ended") {
    position = 0;
    lastPostTime = 0;
    return;
  }
  if (event.type === "init") {
    position = 0;
    lastPostTime = 0;
    return;
  }
  if (event.type === "process") {
    position += event.inputLength;
    if (event.currentTime - lastPostTime > 0.1) {
      lastPostTime = event.currentTime;
      worker.postMessage({ type: "position", data: position });
    }
  }
});
