const loading = document.getElementById("loading");

const BABYLON_URLS = [
  new URL("../vendor/babylon.js", import.meta.url).href,
  "https://cdn.babylonjs.com/babylon.js",
  "https://unpkg.com/babylonjs@7.54.2/babylon.js",
];

const THREE_URLS = [
  new URL("../vendor/three.min.js", import.meta.url).href,
  "https://unpkg.com/three@0.166.0/build/three.min.js",
];

start();

async function start() {
  try {
    const params = new URLSearchParams(location.search);
    const renderer = params.get("renderer") || "babylon";
    if (renderer === "three") {
      loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Loading Three.js runtime...</span>";
      await loadThree();
      loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Generating the first chunks...</span>";
      const { startGame } = await import("./main_three.js");
      await startGame();
      return;
    }

    loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Loading Babylon runtime...</span>";
    await loadBabylon();
    loading.innerHTML = "<strong>Minecraft Indev Unlimited</strong><span>Generating the first chunks...</span>";
    const { startGame } = await import("./main.js");
    await startGame();
  } catch (error) {
    console.error(error);
    loading.innerHTML =
      "<strong>Runtime failed to load.</strong><span>The local runtime file could not be loaded. Make sure vendor files are present, then reload.</span>";
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
