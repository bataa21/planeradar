// Plane Radar V5.0.6.3 — Presence heartbeat with deduplicated notices
(() => {
  const CONNECTION_KEY = "planeRadarOnlineConnection_v1";
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
  let placementEntered = false;
  let placementTimer = null;
  let connectionRef = null;
  let connectionListener = null;
  let wasDisconnected = false;
  let heartbeatTimer = null;

  function saveConnection(difficulty) {
    if (!roomCode || !role) return;
    try {
      localStorage.setItem(CONNECTION_KEY, JSON.stringify({
        roomCode,
        role,
        difficulty: Number(difficulty || document.getElementById("difficulty")?.value) || 8,
        savedAt: Date.now()
      }));
    } catch (_) {}
  }

  function loadConnection() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONNECTION_KEY) || "null");
      if (!saved || !/^\d{6}$/.test(saved.roomCode) || !["host", "guest"].includes(saved.role)) return null;
      return saved;
    } catch (_) {
      return null;
    }
  }

  function clearConnection() {
    try { localStorage.removeItem(CONNECTION_KEY); } catch (_) {}
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function startHeartbeat() {
    stopHeartbeat();
    if (!roomRef || !role) return;
    const field = role === "host" ? "hostSeenAt" : "guestSeenAt";
    const beat = () => {
      if (roomRef) roomRef.child(field).set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
    };
    beat();
    heartbeatTimer = setInterval(beat, 4000);
  }

  async function configurePresence() {
    if (!roomRef || !role) return;
    const field = role === "host" ? "hostOnline" : "guestOnline";
    const presenceRef = roomRef.child(field);
    try {
      await presenceRef.onDisconnect().set(false);
      await presenceRef.set(true);
      startHeartbeat();
    } catch (error) {
      console.error("Online presence update failed", error);
    }
  }

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

  function waitForServerRoom(reference, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reference.off("value", handleValue);
        resolve(value);
      };
      const handleValue = snapshot => {
        // Realtime Database may first emit an empty local-cache snapshot.
        // Keep listening until the server supplies the actual room.
        if (snapshot.exists()) finish(snapshot);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      reference.on("value", handleValue, error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reference.off("value", handleValue);
        reject(error);
      });
    });
  }

  function stopListening() {
    stopHeartbeat();
    if (roomRef && roomListener) roomRef.off("value", roomListener);
    if (connectionRef && connectionListener) connectionRef.off("value", connectionListener);
    roomListener = null;
    connectionRef = null;
    connectionListener = null;
  }

  function listenToRoom() {
    stopListening();
    roomListener = snapshot => {
      if (!snapshot.exists()) {
        setNote(t().cancelled, "error");
        stopListening();
        clearTimeout(placementTimer);
        placementTimer = null;
        placementEntered = false;
        clearConnection();
        roomRef = null;
        roomCode = "";
        role = "";
        restoreCreateLabel();
        if (window.handleOnlineRoomClosed) window.handleOnlineRoomClosed();
        return;
      }
      const room = snapshot.val();
      saveConnection(room.difficulty);
      statusKey = room.status === "connected" && room.guestUid ? "connected" : "waiting";
      setNote(t()[statusKey](roomCode), statusKey);
      restoreCreateLabel();
      if (window.updateOnlineRoomState) {
        window.updateOnlineRoomState({ ...room, roomCode, role });
      }
      if (room.hostReady && room.guestReady && !room.game && role === "host") {
        initializeOnlineGame(room.difficulty);
      }
      if (statusKey === "connected" && !placementEntered) {
        placementEntered = true;
        clearTimeout(placementTimer);
        placementTimer = setTimeout(() => {
          if (roomRef && window.enterOnlinePlacement) {
            window.enterOnlinePlacement({
              roomCode,
              role,
              difficulty: Number(room.difficulty) || 8,
              recovered: Boolean(loadConnection())
            });
            if (window.updateOnlineRoomState) {
              window.updateOnlineRoomState({ ...room, roomCode, role });
            }
          }
        }, 900);
      }
    };
    roomRef.on("value", roomListener, () => setNote(t().unavailable, "error"));

    connectionRef = database.ref(".info/connected");
    connectionListener = snapshot => {
      const connected = snapshot.val() === true;
      if (!connected) {
        stopHeartbeat();
        wasDisconnected = true;
        if (window.updateOnlineConnectionStatus) window.updateOnlineConnectionStatus("reconnecting");
      } else if (wasDisconnected) {
        wasDisconnected = false;
        if (window.updateOnlineConnectionStatus) window.updateOnlineConnectionStatus("restored");
      }
      if (connected) configurePresence();
    };
    connectionRef.on("value", connectionListener);
  }

  async function resumeSavedRoom() {
    const saved = loadConnection();
    if (!saved || roomRef) return false;
    try {
      const user = await ensureSignedIn();
      const reference = database.ref(`rooms/${saved.roomCode}`);
      const snapshot = await waitForServerRoom(reference, 7000);
      if (!snapshot?.exists()) {
        clearConnection();
        if (window.clearOnlineRecoveryState) window.clearOnlineRecoveryState();
        return false;
      }
      const room = snapshot.val();
      const ownsSeat = saved.role === "host"
        ? room.hostUid === user.uid
        : room.guestUid === user.uid;
      if (!ownsSeat) {
        clearConnection();
        if (window.clearOnlineRecoveryState) window.clearOnlineRecoveryState();
        return false;
      }
      roomRef = reference;
      roomCode = saved.roomCode;
      role = saved.role;
      statusKey = room.status === "connected" ? "connected" : "waiting";
      placementEntered = false;
      if (codeInput()) codeInput().value = roomCode;
      setNote(language() === "mn" ? "Тоглолтыг сэргээж байна…" : "Recovering match…", "busy");
      await configurePresence();
      listenToRoom();
      return true;
    } catch (error) {
      console.error("Online recovery failed", error);
      return false;
    }
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
    placementEntered = false;
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
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            difficulty: Number(document.getElementById("difficulty")?.value) || 8,
            hostReady: false,
            hostOnline: true,
            hostSeenAt: firebase.database.ServerValue.TIMESTAMP
          };
        }, undefined, false);
        if (!result.committed) continue;
        roomRef = candidateRef;
        roomCode = candidate;
        role = "host";
        saveConnection(Number(document.getElementById("difficulty")?.value) || 8);
        statusKey = "waiting";
        if (codeInput()) codeInput().value = candidate;
        await configurePresence();
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
    placementEntered = false;
    setNote(t().joining, "busy");
    try {
      const user = await ensureSignedIn();
      const candidateRef = database.ref(`rooms/${candidate}`);
      const initialSnapshot = await waitForServerRoom(candidateRef);
      if (!initialSnapshot || !initialSnapshot.exists()) {
        setNote(t().roomMissing, "error");
        setBusy(false);
        return;
      }
      const current = initialSnapshot.val();
      if (current.hostUid === user.uid) {
        setNote(t().ownRoom, "error");
        setBusy(false);
        return;
      }
      if (current.guestUid && current.guestUid !== user.uid) {
        setNote(t().roomFull, "error");
        setBusy(false);
        return;
      }
      // Security Rules permit this only while the guest slot is empty (or is
      // already owned by this user), so simultaneous third-player joins fail.
      await candidateRef.update({
        guestUid: user.uid,
        guestReady: false,
        guestOnline: true,
        guestSeenAt: firebase.database.ServerValue.TIMESTAMP,
        status: "connected"
      });
      roomRef = candidateRef;
      roomCode = candidate;
      role = "guest";
      saveConnection(current.difficulty);
      statusKey = "connected";
      await configurePresence();
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
    clearTimeout(placementTimer);
    placementTimer = null;
    placementEntered = false;
    stopListening();
    roomRef = null;
    roomCode = "";
    role = "";
    statusKey = "";
    clearConnection();
    if (window.clearOnlineRecoveryState) window.clearOnlineRecoveryState();
    try {
      await reference.onDisconnect().cancel();
      if (currentRole === "host") await reference.remove();
      else await reference.update({
        guestUid: null,
        guestReady: null,
        guestOnline: null,
        guestSeenAt: null,
        status: "waiting"
      });
    } catch (_) {
      // onDisconnect remains the fallback if the network disappears.
    }
    restoreCreateLabel();
  }

  async function setReady(isReady) {
    if (!roomRef || !role) return false;
    const field = role === "host" ? "hostReady" : "guestReady";
    try {
      await roomRef.child(field).set(Boolean(isReady));
      return true;
    } catch (error) {
      console.error("Ready update failed", error);
      return false;
    }
  }

  function volleyForDifficulty(difficulty) {
    if (Number(difficulty) <= 5) return 3;
    if (Number(difficulty) <= 8) return 4;
    return 6;
  }

  async function initializeOnlineGame(difficulty) {
    if (!roomRef || role !== "host") return false;
    try {
      const result = await roomRef.child("game").transaction(current => {
        if (current) return;
        return {
          turn: "host",
          shotsLeft: volleyForDifficulty(difficulty),
          sequence: 0,
          hostHits: 0,
          guestHits: 0,
          winner: ""
        };
      }, undefined, false);
      return result.committed || result.snapshot.exists();
    } catch (error) {
      console.error("Online game initialization failed", error);
      return false;
    }
  }

  async function sendShot(row, col) {
    if (!roomRef || !role) return false;
    try {
      const gameRef = roomRef.child("game");
      const result = await gameRef.transaction(game => {
        if (!game || game.winner || game.turn !== role) return;
        if (game.lastShot && game.lastShot.result === "pending") return;
        const sequence = Number(game.sequence || 0) + 1;
        return {
          ...game,
          sequence,
          lastShot: {
            sequence,
            attacker: role,
            row: Number(row),
            col: Number(col),
            result: "pending",
            createdAt: Date.now()
          }
        };
      }, undefined, false);
      return result.committed;
    } catch (error) {
      console.error("Online shot failed", error);
      return false;
    }
  }

  async function resolveShot(sequence, resultName, fleetDestroyed, distanceHints = {}) {
    if (!roomRef || !role) return false;
    try {
      const gameRef = roomRef.child("game");
      const result = await gameRef.transaction(game => {
        const shot = game?.lastShot;
        if (!shot || shot.sequence !== sequence || shot.result !== "pending") return;
        if (shot.attacker === role) return;

        const hitField = shot.attacker === "host" ? "hostHits" : "guestHits";
        const nextHits = Number(game[hitField] || 0) + (resultName === "hit" ? 1 : 0);
        const remaining = Math.max(0, Number(game.shotsLeft || 1) - 1);
        const nextTurn = shot.attacker === "host" ? "guest" : "host";
        const winner = fleetDestroyed ? shot.attacker : "";

        return {
          ...game,
          [hitField]: nextHits,
          winner,
          turn: winner ? shot.attacker : (remaining === 0 ? nextTurn : shot.attacker),
          shotsLeft: winner ? 0 : (remaining === 0
            ? volleyForDifficulty(document.getElementById("difficulty")?.value)
            : remaining),
          lastShot: {
            ...shot,
            result: resultName,
            distanceHints,
            resolvedBy: role,
            resolvedAt: Date.now()
          }
        };
      }, undefined, false);
      return result.committed;
    } catch (error) {
      console.error("Online shot resolution failed", error);
      return false;
    }
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
    setReady,
    sendShot,
    resolveShot,
    refreshLanguage,
    hasRoom: () => Boolean(roomRef),
    getSession: () => ({ roomCode, role })
  };

  window.addEventListener("load", () => {
    setTimeout(resumeSavedRoom, 350);
  });
})();
