const iconToggleButton = document.querySelector("#iconToggleButton");
const iconToggleContainer = document.querySelector("#iconToggleContainer");
const screenSizeButton = document.querySelector("#screenSizeButton");
const chatInput = document.querySelector("#chatInput");
const sendButton = document.querySelector("#sendButton");
const geoButton = document.querySelector("#geoButton");
const messagesContainer = document.querySelector("#chatMessages");
const chatStatus = document.querySelector("#chatStatus");

const icons = {
  solid:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 0 0 8a8 8 0 0 0 16 0m-5.904-2.803a.5.5 0 1 1 .707.707L6.707 10h2.768a.5.5 0 0 1 0 1H5.5a.5.5 0 0 1-.5-.5V6.525a.5.5 0 0 1 1 0v2.768z" /></svg>',
  outline:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-5.904-2.854a.5.5 0 1 1 .707.708L6.707 9.95h2.768a.5.5 0 1 1 0 1H5.5a.5.5 0 0 1-.5-.5V6.475a.5.5 0 1 1 1 0v2.768z" /></svg>'
};
let isSolidIcon = true;
let geoResponsePending = false;
let socket;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let manuallyClosed = false;
const WS_URL = "wss://echo.websocket.org";

function updateIcon() {
  iconToggleContainer.innerHTML = isSolidIcon ? icons.solid : icons.outline;
}

iconToggleButton.addEventListener("click", () => {
  isSolidIcon = !isSolidIcon;
  updateIcon();
});

screenSizeButton.addEventListener("click", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  alert(`Размер окна: ${width} x ${height}`);
});

function setChatStatus(state, text) {
  chatStatus.textContent = text;
  chatStatus.className = state
    ? `chat__status chat__status--${state}`
    : "chat__status";
}

function connectSocket() {
  if (manuallyClosed) {
    return;
  }
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  setChatStatus("info", "Подключение...");
  socket = new WebSocket(WS_URL);

  socket.addEventListener("open", () => {
    addMessage("Соединение установлено", "server");
    setChatStatus("success", "Онлайн");
    reconnectAttempts = 0;
  });

  socket.addEventListener("message", (event) => {
    if (geoResponsePending) {
      geoResponsePending = false;
      return;
    }
    addMessage(event.data, "server");
  });

  socket.addEventListener("error", () => {
    setChatStatus("error", "Ошибка соединения");
    addMessage("Ошибка соединения с сервером", "server");
  });

  socket.addEventListener("close", () => {
    if (manuallyClosed) {
      return;
    }
    setChatStatus("error", "Соединение закрыто");
    addMessage("Соединение закрыто", "server");
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (manuallyClosed) {
    return;
  }
  clearTimeout(reconnectTimeout);
  const delay = Math.min(2000 * 2 ** reconnectAttempts, 8000);
  reconnectAttempts += 1;
  reconnectTimeout = setTimeout(() => {
    setChatStatus("info", "Повторное подключение...");
    connectSocket();
  }, delay);
}

function addMessage(content, type) {
  const message = document.createElement("div");
  message.className = `chat__message chat__message--${type}`;
  if (typeof content === "string") {
    message.textContent = content;
  } else {
    message.appendChild(content);
  }
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  updateMessagesEmptyState();
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) {
    return;
  }
  addMessage(text, "user");
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(text);
  } else {
    addMessage("Сообщение не отправлено: нет соединения", "server");
  }
  chatInput.value = "";
  updateSendButtonState();
}

sendButton.addEventListener("click", sendMessage);

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

chatInput.addEventListener("input", updateSendButtonState);

geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    addMessage("Геолокация не поддерживается", "server");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const link = document.createElement("a");
      link.href = `https://www.openstreetmap.org/#map=18/${latitude}/${longitude}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `OpenStreetMap (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
      addMessage(link, "user");
      if (socket && socket.readyState === WebSocket.OPEN) {
        geoResponsePending = true;
        socket.send(`geo:${latitude},${longitude}`);
      } else {
        addMessage("Геоданные не отправлены: нет соединения", "server");
      }
    },
    () => {
      addMessage("Не удалось получить геопозицию", "server");
    }
  );
});

function updateSendButtonState() {
  sendButton.disabled = chatInput.value.trim() === "";
}

function updateMessagesEmptyState() {
  if (messagesContainer.children.length === 0) {
    messagesContainer.classList.add("chat__messages--empty");
  } else {
    messagesContainer.classList.remove("chat__messages--empty");
  }
}

window.addEventListener("beforeunload", () => {
  manuallyClosed = true;
  clearTimeout(reconnectTimeout);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
});

updateIcon();
updateSendButtonState();
updateMessagesEmptyState();
connectSocket();
