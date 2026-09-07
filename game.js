// Box of Lies — estado del juego + render de pantallas. Vanilla JS, sin build.
const app = document.getElementById("app");

const S = {
  screen: "setup",
  players: [], // {name, score}
  totalRounds: 6,
  round: 0,
  activeIndex: 0,
  imagePool: [],
  currentImage: null,
  activeTruth: null, // true = dijo la verdad, false = mintió
  voters: [], // índices de jugadores que votan esta ronda
  voteCursor: 0,
  votes: [], // {index, guessTruth}
  lastBonus: false,
};

// ---------- helpers de DOM ----------
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

function render() {
  clear(app);
  app.appendChild(SCREENS[S.screen]());
}

// ---------- mazo de imágenes sin repetir ----------
function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawImage() {
  if (S.imagePool.length === 0) S.imagePool = shuffledIndices(EXOTIC_IMAGES.length);
  return EXOTIC_IMAGES[S.imagePool.pop()];
}

// ---------- flujo del juego ----------
function addPlayer(name) {
  name = name.trim();
  if (!name) return;
  S.players.push({ name, score: 0 });
  render();
}

function removePlayer(i) {
  S.players.splice(i, 1);
  render();
}

function startGame(rounds) {
  S.totalRounds = rounds;
  S.round = 0;
  S.imagePool = shuffledIndices(EXOTIC_IMAGES.length);
  startRound();
}

function startRound() {
  S.activeIndex = S.round % S.players.length;
  S.currentImage = drawImage();
  S.activeTruth = null;
  S.voters = S.players.map((_, i) => i).filter((i) => i !== S.activeIndex);
  S.voteCursor = 0;
  S.votes = [];
  S.screen = "pass-active";
  render();
}

function confirmPassActive() { S.screen = "active-image"; render(); }

function markTruth(saidTruth) {
  S.activeTruth = saidTruth;
  S.screen = S.voters.length === 0 ? (computeScores(), "reveal") : "pass-vote";
  render();
}

function confirmPassVote() { S.screen = "vote"; render(); }

function submitVote(guessTruth) {
  S.votes.push({ index: S.voters[S.voteCursor], guessTruth });
  S.voteCursor++;
  S.screen = S.voteCursor < S.voters.length ? "pass-vote" : "suspense";
  render();
}

function revealResult() {
  computeScores();
  S.screen = "reveal";
  render();
}

function computeScores() {
  let wrong = 0;
  for (const v of S.votes) {
    if (v.guessTruth === S.activeTruth) S.players[v.index].score += 1;
    else wrong++;
  }
  S.lastBonus = S.voters.length > 0 && wrong > S.voters.length / 2;
  if (S.lastBonus) S.players[S.activeIndex].score += 1;
}

function nextRound() {
  S.round++;
  if (S.round >= S.totalRounds) { S.screen = "podium"; render(); }
  else startRound();
}

function resetGame() {
  for (const p of S.players) p.score = 0;
  S.round = 0;
  S.screen = "setup";
  render();
}

// ---------- pantallas ----------
const SCREENS = {
  setup() {
    const card = el("div", { class: "card" }, el("h1", { text: "Box of Lies" }));

    const nameInput = el("input", { type: "text", placeholder: "Nombre del jugador" });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { addPlayer(nameInput.value); nameInput.value = ""; }
    });
    const addBtn = el("button", {
      class: "btn blue", text: "Agregar jugador",
      onclick: () => { addPlayer(nameInput.value); nameInput.value = ""; nameInput.focus(); },
    });
    card.appendChild(nameInput);
    card.appendChild(addBtn);

    const list = el("ul", { class: "player-list" });
    S.players.forEach((p, i) => {
      list.appendChild(el("li", {},
        el("span", { text: p.name }),
        el("button", { text: "x", onclick: () => removePlayer(i) })
      ));
    });
    card.appendChild(list);

    if (S.players.length < 3) {
      card.appendChild(el("p", { text: "Necesitás al menos 3 jugadores para poder jugar." }));
    }

    if (EXOTIC_IMAGES.length === 0) {
      card.appendChild(el("p", { text: "No hay imágenes cargadas: metelas en la carpeta images/ y corré `node build-images.js`." }));
    }

    const roundsInput = el("input", { type: "number", min: "1", value: String(S.totalRounds) });
    card.appendChild(el("p", { text: "Cantidad de rondas:" }));
    card.appendChild(roundsInput);

    const canStart = S.players.length >= 3 && EXOTIC_IMAGES.length > 0;
    const startBtn = el("button", {
      class: "btn lime", text: "Empezar partida",
      onclick: () => {
        const rounds = parseInt(roundsInput.value, 10);
        if (canStart && rounds >= 1) startGame(rounds);
      },
    });
    if (!canStart) startBtn.setAttribute("disabled", "true");
    card.appendChild(startBtn);

    return card;
  },

  "pass-active"() {
    const name = S.players[S.activeIndex].name;
    return el("div", { class: "card pass-box" },
      el("span", { class: "tag", text: `Ronda ${S.round + 1} de ${S.totalRounds}` }),
      el("p", { text: "Pasale el dispositivo a" }),
      el("div", { class: "name", text: name }),
      el("button", { class: "btn pink", text: "Ya lo tengo, mostrame la imagen", onclick: confirmPassActive })
    );
  },

  "active-image"() {
    const img = el("img", { class: "active-img", src: S.currentImage.url, alt: S.currentImage.alt });
    return el("div", { class: "card" },
      el("h2", { text: "Solo vos ves esto 👀" }),
      img,
      el("p", { text: "Describí este objeto en voz alta para el resto. Podés decir la verdad o mentir. Cuando termines, marcá qué hiciste:" }),
      el("button", { class: "btn lime", text: "Dije la verdad", onclick: () => markTruth(true) }),
      el("button", { class: "btn red", text: "Mentí", onclick: () => markTruth(false) })
    );
  },

  "pass-vote"() {
    const voter = S.players[S.voters[S.voteCursor]].name;
    return el("div", { class: "card pass-box" },
      el("p", { text: "Pasale el dispositivo a" }),
      el("div", { class: "name", text: voter }),
      el("button", { class: "btn blue", text: "Ya lo tengo, quiero votar", onclick: confirmPassVote })
    );
  },

  vote() {
    const activeName = S.players[S.activeIndex].name;
    return el("div", { class: "card" },
      el("h2", { text: `¿${activeName} dijo la verdad o mintió?` }),
      el("button", { class: "btn lime", text: "Dijo la VERDAD", onclick: () => submitVote(true) }),
      el("button", { class: "btn red", text: "MINTIÓ", onclick: () => submitVote(false) })
    );
  },

  suspense() {
    return el("div", { class: "card pass-box" },
      el("p", { text: "Ya votaron todos." }),
      el("div", { class: "name", text: "¿Mintió o dijo la verdad?" }),
      el("button", { class: "btn pink", text: "🥁 Revelar respuesta", onclick: revealResult })
    );
  },

  reveal() {
    const active = S.players[S.activeIndex];
    const card = el("div", { class: "card" },
      el("h2", { text: `${active.name} ${S.activeTruth ? "dijo la verdad" : "mintió"}` }),
      el("img", { class: "reveal-img", src: S.currentImage.url, alt: S.currentImage.alt })
    );

    const list = el("ul", { class: "scoreboard" });
    for (const v of S.votes) {
      const p = S.players[v.index];
      const correct = v.guessTruth === S.activeTruth;
      list.appendChild(el("li", { class: `vote-result ${correct ? "correct" : "wrong"}` },
        el("span", { text: `${p.name}: dijo "${v.guessTruth ? "verdad" : "mentira"}"` }),
        el("span", { text: correct ? "✔ +1" : "✘" })
      ));
    }
    card.appendChild(list);

    if (S.lastBonus) {
      card.appendChild(el("p", { text: `${active.name} engañó a la mayoría: +1 punto bono.` }));
    }

    card.appendChild(el("h2", { text: "Puntajes" }));
    const scores = el("ul", { class: "scoreboard" });
    S.players.forEach((p) => scores.appendChild(el("li", {},
      el("span", { text: p.name }), el("span", { text: String(p.score) })
    )));
    card.appendChild(scores);

    const isLast = S.round + 1 >= S.totalRounds;
    card.appendChild(el("button", {
      class: "btn pink",
      text: isLast ? "Ver podio final" : "Siguiente ronda",
      onclick: nextRound,
    }));
    return card;
  },

  podium() {
    const ranked = [...S.players].sort((a, b) => b.score - a.score);
    const card = el("div", { class: "card" }, el("h1", { text: "🏆 Podio 🏆" }));
    ranked.forEach((p, i) => {
      card.appendChild(el("div", { class: `podium-item ${i === 0 ? "podium-1" : ""}` },
        el("span", { text: `${i + 1}. ${p.name}` }),
        el("span", { text: String(p.score) })
      ));
    });
    card.appendChild(el("button", { class: "btn lime", text: "Jugar de nuevo", onclick: resetGame }));
    return card;
  },
};

render();
