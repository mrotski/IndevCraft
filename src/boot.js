const loading = document.getElementById("loading");

const BABYLON_URLS = [
  new URL("../vendor/babylon.js", import.meta.url).href,
  "https://cdn.babylonjs.com/babylon.js",
  "https://unpkg.com/babylonjs@7.54.2/babylon.js",
];

start();

async function start() {
  try {
    loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Loading Babylon runtime...</span>";
    await loadBabylon();
    loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Generating the first chunks...</span>";
    const { startGame } = await import("./main.js");
    await startGame();
  } catch (error) {
    console.error(error);
    loading.innerHTML =
      "<strong>Babylon.js failed to load.</strong><span>The local runtime file could not be loaded. Make sure vendor/babylon.js is present, then reload.</span>";
  }
}

async function loadBabylon() {
  if (window.BABYLON) return;
  let lastError = null;
  for (const url of BABYLON_URLS) {
    try {
      await injectScript(url, 12000);
      if (window.BABYLON) return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Babylon.js unavailable");
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
