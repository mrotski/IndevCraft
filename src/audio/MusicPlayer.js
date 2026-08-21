export class MusicPlayer {
  constructor() {
    this.tracks = [
      new URL("../music/1.ogg", import.meta.url).href,
      new URL("../music/2.ogg", import.meta.url).href,
      new URL("../music/3.ogg", import.meta.url).href,
    ];
    this.audio = null;
    this.enabled = false;
    this.lastIndex = -1;
    this.currentIndex = -1;
    this.startBound = this.start.bind(this);
    this.handleEndedBound = this.handleEnded.bind(this);
  }

  attachUserGestureListeners(target = document) {
    const startOnce = () => {
      this.start();
      target.removeEventListener("pointerdown", startOnce, true);
      target.removeEventListener("keydown", startOnce, true);
      target.removeEventListener("touchstart", startOnce, true);
    };

    target.addEventListener("pointerdown", startOnce, true);
    target.addEventListener("keydown", startOnce, true);
    target.addEventListener("touchstart", startOnce, true);
  }

  start() {
    if (this.enabled) return;
    this.enabled = true;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.audio.volume = 0.35;
      this.audio.addEventListener("ended", this.handleEndedBound);
    }
    this.playNextTrack();
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  handleEnded() {
    if (!this.enabled) return;
    this.playNextTrack();
  }

  playNextTrack() {
    const nextIndex = this.pickNextIndex();
    this.currentIndex = nextIndex;
    this.lastIndex = nextIndex;
    this.audio.src = this.tracks[nextIndex];
    const playPromise = this.audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.warn("Music playback was blocked or failed", error);
        this.enabled = false;
      });
    }
  }

  pickNextIndex() {
    if (this.tracks.length <= 1) return 0;

    let nextIndex = this.lastIndex;
    for (let attempts = 0; attempts < 8; attempts++) {
      const candidate = Math.floor(Math.random() * this.tracks.length);
      if (candidate !== this.lastIndex) {
        nextIndex = candidate;
        break;
      }
    }

    if (nextIndex === this.lastIndex) {
      nextIndex = (this.lastIndex + 1) % this.tracks.length;
    }
    return nextIndex;
  }
}
