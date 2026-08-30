// Plane Radar V5.0.2 — Firebase room connection
(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyBboHmeEIgq7hEyV9KTPOtoMXGn6ofF3tQ",
    authDomain: "plane-radar-online.firebaseapp.com",
    databaseURL: "https://plane-radar-online-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "plane-radar-online",
    storageBucket: "plane-radar-online.firebasestorage.app",
    messagingSenderId: "1064139000800",
    appId: "1:1064139000800:web:7acd1f89af514460d13985"
  };

  const copy = {
    en: {
      connecting: "Connecting securely…",
      creating: "Creating room…",
      joining: "Joining room…",
      waiting: code => `Room ${code} · Waiting for your friend…`,
      connected: code => `✅ Friend connected · Room ${code}`,
      copied: code => `Room code ${code} copied.`,
      copyCode: code => `📋 Copy ${code}`,
      roomMissing: "Room not found. Check the six-digit code.",
      roomFull: "That room already has two players.",
      ownRoom: "Open this code on your friend’s device.",
      invalidCode: "Enter the six-digit room code.",
      offline: "No internet connection. Try again when online.",
      unavailable: "Online connection could not start. Please try again.",
      cancelled: "Room closed."
    },
    mn: {
      connecting: "Аюулгүй холбогдож байна…",
      creating: "Өрөө үүсгэж байна…",
      joining: "Өрөөнд нэгдэж байна…",
      waiting: code => `Өрөө ${code} · Найзыгаа хүлээж байна…`,
      connected: code => `✅ Найз холбогдлоо · Өрөө ${code}`,
      copied: code => `Өрөөний ${code} код хуулагдлаа.`,
      copyCode: code => `📋 ${code} хуулах`,
      roomMissing: "Өрөө олдсонгүй. 6 оронтой кодоо шалгана уу.",
      roomFull: "Энэ өрөөнд хоёр тоглогч холбогдсон байна.",
      ownRoom: "Энэ кодыг найзынхаа төхөөрөмж дээр оруулна уу.",
      invalidCode: "Өрөөний 6 оронтой кодыг оруулна уу.",
      offline: "Интернэт холболт алга. Холбогдоод дахин оролдоно уу.",
      unavailable: "Онлайн холболт эхэлсэнгүй. Дахин оролдоно уу.",
      cancelled: "Өрөө хаагдлаа."
    }
  };

  let auth;
  let database;
  let roomRef = null;
  let roomCode = "";
  let role = "";
  let roomListener = null;
  let statusKey = "";
  let ready = false;

  const language = () => window.getPlaneRadarLanguage
    ? window.getPlaneRadarLanguage()
    : "en";
  const t = () => copy[language()] || copy.en;
  const note = () => document.getElementById("battleEntryNote");
  const createButton = () => document.getElementById("createRoomBtn");
  const joinButton = () => document.getElementById("joinRoomBtn");
  const codeInput = () => document.getElementById("roomCodeInput");

  function setNote(message, state = "") {
    const element = note();
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  }

  function setBusy(busy) {
    if (createButton()) createButton().disabled = busy;
    if (joinButton()) joinButton().disabled = busy;
    if (codeInput()) codeInput().disabled = busy;
  }

  function restoreCreateLabel() {
    if (!createButton()) return;
    if (role === "host" && roomCode) {
      createButton().textContent = t().copyCode(roomCode);
      createButton().disabled = false;
      return;
    }
    const base = window.getPlaneRadarText ? window.getPlaneRadarText("createRoom") : "Create Room";
    createButton().textContent = `➕ ${base}`;
    createButton().disabled = false;
  }

  function initialize() {
    if (ready) return true;
    if (!window.firebase) return false;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    ready = true;
    return true;
  }

  async function ensureSignedIn() {
    if (!initialize()) throw new Error("firebase-unavailable");
    if (auth.currentUser) return auth.currentUser;
    const credential = await auth.signInAnonymously();
    return credential.user;
  }

  function makeRoomCode() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(100000 + (values[0] % 900000));
  }

  function stopListening() {
    if (roomRef && roomListener) roomRef.off("value", roomListener);
    roomListener = null;
  }

  function listenToRoom() {
    stopListening();
    roomListener = snapshot => {
      if (!snapshot.exists()) {
        setNote(t().cancelled, "error");
        stopListening();
        roomRef = null;
        roomCode = "";
        role = "";
        restoreCreateLabel();
        return;
      }
      const room = snapshot.val();
      statusKey = room.status === "connected" && room.guestUid ? "connected" : "waiting";
      setNote(t()[statusKey](roomCode), statusKey);
      restoreCreateLabel();
    };
    roomRef.on("value", roomListener, () => setNote(t().unavailable, "error"));
  }

  async function copyCurrentCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setNote(t().copied(roomCode), "success");
      setTimeout(() => {
        if (roomCode) setNote(t()[statusKey || "waiting"](roomCode), statusKey || "waiting");
      }, 1600);
    } catch (_) {
      if (codeInput()) {
        codeInput().focus();
        codeInput().select();
      }
    }
  }

  async function createRoom() {
    if (role === "host" && roomCode) {
      await copyCurrentCode();
      return;
    }
    if (!navigator.onLine) {
      setNote(t().offline, "error");
      return;
    }
    setBusy(true);
    setNote(t().connecting, "busy");
    try {
      const user = await ensureSignedIn();
      setNote(t().creating, "busy");
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = makeRoomCode();
        const candidateRef = database.ref(`rooms/${candidate}`);
        const result = await candidateRef.transaction(current => {
          if (current !== null) return;
          return {
            hostUid: user.uid,
            status: "waiting",
            createdAt: firebase.database.ServerValue.TIMESTAMP
          };
        }, undefined, false);
        if (!result.committed) continue;
        roomRef = candidateRef;
        roomCode = candidate;
        role = "host";
        statusKey = "waiting";
        if (codeInput()) codeInput().value = candidate;
        await roomRef.onDisconnect().remove();
        listenToRoom();
        setNote(t().waiting(candidate), "waiting");
        restoreCreateLabel();
        setBusy(false);
        return;
      }
      throw new Error("room-code-collision");
    } catch (error) {
      console.error("Create room failed", error);
      setNote(t().unavailable, "error");
      setBusy(false);
      restoreCreateLabel();
    }
  }

  async function joinRoom() {
    const candidate = (codeInput()?.value || "").replace(/\D/g, "").slice(0, 6);
    if (candidate.length !== 6) {
      setNote(t().invalidCode, "error");
      return;
    }
    if (!navigator.onLine) {
      setNote(t().offline, "error");
      return;
    }
    setBusy(true);
    setNote(t().joining, "busy");
    try {
      const user = await ensureSignedIn();
      const candidateRef = database.ref(`rooms/${candidate}`);
      let reason = "missing";
      const result = await candidateRef.transaction(current => {
        if (!current) {
          reason = "missing";
          return;
        }
        if (current.hostUid === user.uid) {
          reason = "own";
          return;
        }
        if (current.guestUid && current.guestUid !== user.uid) {
          reason = "full";
          return;
        }
        reason = "ok";
        return { ...current, guestUid: user.uid, status: "connected" };
      }, undefined, false);
      if (!result.committed) {
        const messages = { missing: t().roomMissing, own: t().ownRoom, full: t().roomFull };
        setNote(messages[reason] || t().unavailable, "error");
        setBusy(false);
        return;
      }
      roomRef = candidateRef;
      roomCode = candidate;
      role = "guest";
      statusKey = "connected";
      await roomRef.onDisconnect().update({ guestUid: null, status: "waiting" });
      listenToRoom();
      setNote(t().connected(candidate), "connected");
      setBusy(false);
    } catch (error) {
      console.error("Join room failed", error);
      setNote(t().unavailable, "error");
      setBusy(false);
    }
  }

  async function leaveRoom() {
    if (!roomRef) return;
    const reference = roomRef;
    const currentRole = role;
    stopListening();
    roomRef = null;
    roomCode = "";
    role = "";
    statusKey = "";
    try {
      await reference.onDisconnect().cancel();
      if (currentRole === "host") await reference.remove();
      else await reference.update({ guestUid: null, status: "waiting" });
    } catch (_) {
      // onDisconnect remains the fallback if the network disappears.
    }
    restoreCreateLabel();
  }

  function refreshLanguage() {
    if (!roomCode) return;
    setNote(t()[statusKey || "waiting"](roomCode), statusKey || "waiting");
    restoreCreateLabel();
  }

  window.PlaneRadarOnline = {
    createRoom,
    joinRoom,
    leaveRoom,
    refreshLanguage,
    hasRoom: () => Boolean(roomRef)
  };
})();
