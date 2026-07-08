const loading = document.getElementById("loading");

const THREE_URLS = [
  new URL("../vendor/three.min.js", import.meta.url).href,
  "https://unpkg.com/three@0.155.0/build/three.min.js",
];

start();

async function start() {
  try {
    loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Loading Three.js runtime...</span>";
    await loadThree();
    loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Generating the first chunks...</span>";
    const { startGame } = await import("./main.js");
    await startGame();
  } catch (error) {
    console.error(error);
    const message = error?.message || "Unknown startup error";
    loading.innerHTML = `<strong>Runtime failed to load.</strong><span>${message}</span>`;
  }
}

async function loadThree() {
  if (window.THREE) return;
  let lastError = null;
  for (const url of THREE_URLS) {
    try {
      await injectScript(url, 12000);
      if (window.THREE) return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Three.js unavailable");
}

function injectScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading ${src}`));
    }, timeoutMs);

    script.src = src;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.append(script);
  });
}
