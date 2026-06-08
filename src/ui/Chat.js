export class Chat {
  constructor({ onCommand }) {
    this.onCommand = onCommand;
    this.root = document.getElementById("chat");
    this.log = document.getElementById("chatLog");
    this.input = document.getElementById("chatInput");
    this.open = false;

    this.addMessage("Press T to chat. Try /tp 0 80 0 or /tp 500 500.");

    document.addEventListener("keydown", (event) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.isContentEditable);

      if (!this.open && !isTyping && event.code === "KeyT") {
        event.preventDefault();
        this.show();
        return;
      }

      if (this.open && event.code === "Escape") {
        event.preventDefault();
        this.hide();
      }
    });

    this.input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.code === "Enter") {
        event.preventDefault();
        this.submit();
      }
    });
  }

  isOpen() {
    return this.open;
  }

  show(text = "") {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.open = true;
    this.root.classList.add("open");
    this.input.value = text;
    this.input.focus();
  }

  hide() {
    this.open = false;
    this.input.value = "";
    this.input.blur();
    this.root.classList.remove("open");
  }

  submit() {
    const text = this.input.value.trim();
    if (!text) {
      this.hide();
      return;
    }

    this.addMessage(`> ${text}`);
    if (text.startsWith("/")) {
      const response = this.onCommand(text);
      if (response) this.addMessage(response);
    } else {
      this.addMessage("Single-player chat is local only.");
    }
    this.hide();
  }

  addMessage(text) {
    const line = document.createElement("div");
    line.textContent = text;
    this.log.append(line);
    while (this.log.children.length > 8) {
      this.log.firstElementChild.remove();
    }
    this.log.scrollTop = this.log.scrollHeight;
  }
}
