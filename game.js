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
  voteMode: "individual", // "individual" | "group"
  pendingGroupTruthCount: 0,
  groupVoteCounts: null, // {truthCount, lieCount, correct}
  rerollsLeft: 0, // se reinicia cada ronda en startRound()
  suggestedContext: null, // sugerencia privada actual; null = ninguna elegida aún
  showHelp: false,
};

const MAX_REROLLS = 3;

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

function toggleHelp() { S.showHelp = !S.showHelp; render(); }

function helpOverlay() {
  return el("div", { class: "help-overlay" },
    el("div", { class: "card help-card" },
      el("h2", { text: "How to play" }),
      el("p", { text: "Add at least 3 players, pick how many rounds and a voting mode, then start." }),
      el("p", { text: "Each round, the active player secretly sees an image, then describes it out loud to everyone else — truthfully or as a lie. They can reroll the image (up to 3 times) or use \"Suggest a context\" for a fake backstory to help lie convincingly." }),
      el("p", { text: "Everyone else then guesses whether the active player told the truth or lied, either one by one (pass the device) or all at once by a show of hands (group mode)." }),
      el("p", { text: "Guess right and you score a point. If the active player fools the majority, they get a bonus point instead." }),
      el("button", { class: "btn pink", text: "Got it", onclick: toggleHelp })
    )
  );
}

function render() {
  clear(app);
  app.appendChild(SCREENS[S.screen]());
  app.appendChild(el("button", { class: "help-btn", text: "❗", onclick: toggleHelp }));
  if (S.showHelp) app.appendChild(helpOverlay());
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
  S.rerollsLeft = MAX_REROLLS;
  S.suggestedContext = null;
  S.screen = "pass-active";
  render();
}

function confirmPassActive() { S.screen = "active-image"; render(); }

function rerollImage() {
  if (S.rerollsLeft <= 0) return;
  S.rerollsLeft--;
  S.currentImage = drawImage();
  render();
}

function suggestContext() {
  S.suggestedContext = FAKE_CONTEXTS[Math.floor(Math.random() * FAKE_CONTEXTS.length)];
  render();
}

function markTruth(saidTruth) {
  S.activeTruth = saidTruth;
  if (S.voters.length === 0) { computeScores(); S.screen = "reveal"; }
  else S.screen = S.voteMode === "group" ? "group-vote" : "pass-vote";
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
  if (S.voteMode === "group") computeGroupScores(S.pendingGroupTruthCount);
  else computeScores();
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

// Modo grupal: no se sabe quién votó qué, solo cuántos por cada opción.
// Mayoría acierta -> todos los votantes suman 1. Mayoría engañada -> bono al activo (igual que en modo individual).
function computeGroupScores(truthCount) {
  const total = S.voters.length;
  const lieCount = total - truthCount;
  const wrong = S.activeTruth ? lieCount : truthCount;
  S.lastBonus = total > 0 && wrong > total / 2;
  if (S.lastBonus) S.players[S.activeIndex].score += 1;
  else for (const idx of S.voters) S.players[idx].score += 1;
  S.groupVoteCounts = { truthCount, lieCount, correct: total - wrong };
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

    const nameInput = el("input", { type: "text", placeholder: "Player name" });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { addPlayer(nameInput.value); nameInput.value = ""; }
    });
    const addBtn = el("button", {
      class: "btn blue", text: "Add player",
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
      card.appendChild(el("p", { text: "You need at least 3 players to start." }));
    }

    if (EXOTIC_IMAGES.length === 0) {
      card.appendChild(el("p", { text: "No images loaded: drop some into the images/ folder and run `node build-images.js`." }));
    }

    const roundsInput = el("input", { type: "number", min: "1", value: String(S.totalRounds) });
    card.appendChild(el("p", { text: "Number of rounds:" }));
    card.appendChild(roundsInput);

    const modeSelect = el("select", {
      onchange: (e) => { S.voteMode = e.target.value; },
    },
      el("option", { value: "individual", text: "One by one (pass the device)" }),
      el("option", { value: "group", text: "Group (show of hands)" })
    );
    modeSelect.value = S.voteMode;
    card.appendChild(el("p", { text: "Voting mode:" }));
    card.appendChild(modeSelect);

    const canStart = S.players.length >= 3 && EXOTIC_IMAGES.length > 0;
    const startBtn = el("button", {
      class: "btn lime", text: "Start game",
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
      el("span", { class: "tag", text: `Round ${S.round + 1} of ${S.totalRounds}` }),
      el("p", { text: "Pass the device to" }),
      el("div", { class: "name", text: name }),
      el("button", { class: "btn pink", text: "Got it, show me the image", onclick: confirmPassActive })
    );
  },

  "active-image"() {
    const img = el("img", { class: "active-img", src: S.currentImage.url, alt: S.currentImage.alt });
    const rerollBtn = el("button", { class: "btn blue", text: "Reroll image", onclick: rerollImage });
    if (S.rerollsLeft <= 0) rerollBtn.setAttribute("disabled", "true");

    const contextBox = el("div", {
      class: "context-box",
      text: S.suggestedContext || "Hit reroll for a random fake description to help you lie.",
    });
    const contextBtn = el("button", { class: "btn blue", text: "Reroll context", onclick: suggestContext });

    return el("div", { class: "card" },
      el("h2", { text: "Only you see this 👀" }),
      img,
      el("span", { class: "tag", text: `Rerolls left: ${S.rerollsLeft}/${MAX_REROLLS}` }),
      rerollBtn,
      el("p", { text: "Need a lie? This is a fake description to help you make one up. Only you see this." }),
      contextBox,
      contextBtn,
      el("p", { text: "Describe this object out loud for everyone else. You can tell the truth or lie. When you're done, mark what you did:" }),
      el("button", { class: "btn lime", text: "I told the truth", onclick: () => markTruth(true) }),
      el("button", { class: "btn red", text: "I lied", onclick: () => markTruth(false) })
    );
  },

  "pass-vote"() {
    const voter = S.players[S.voters[S.voteCursor]].name;
    return el("div", { class: "card pass-box" },
      el("p", { text: "Pass the device to" }),
      el("div", { class: "name", text: voter }),
      el("button", { class: "btn blue", text: "Got it, I want to vote", onclick: confirmPassVote })
    );
  },

  "group-vote"() {
    const total = S.voters.length;
    const card = el("div", { class: "card" },
      el("h2", { text: "Group vote (show of hands)" }),
      el("p", { text: `${total} people are voting. Count how many hands went up for each answer.` }),
      el("p", { text: "How many said they told the TRUTH?" })
    );

    const truthInput = el("input", { type: "number", min: "0", max: String(total), value: "0" });
    const lieDisplay = el("p", { text: `Said LIE: ${total}` });
    const clamp = (v) => Math.min(total, Math.max(0, isNaN(v) ? 0 : v));
    truthInput.addEventListener("input", () => {
      const v = clamp(parseInt(truthInput.value, 10));
      lieDisplay.textContent = `Said LIE: ${total - v}`;
    });
    card.appendChild(truthInput);
    card.appendChild(lieDisplay);

    card.appendChild(el("button", {
      class: "btn pink", text: "Confirm votes",
      onclick: () => {
        S.pendingGroupTruthCount = clamp(parseInt(truthInput.value, 10));
        S.screen = "suspense";
        render();
      },
    }));
    return card;
  },

  vote() {
    const activeName = S.players[S.activeIndex].name;
    return el("div", { class: "card" },
      el("h2", { text: `Did ${activeName} tell the truth or lie?` }),
      el("button", { class: "btn lime", text: "Told the TRUTH", onclick: () => submitVote(true) }),
      el("button", { class: "btn red", text: "LIED", onclick: () => submitVote(false) })
    );
  },

  suspense() {
    return el("div", { class: "card pass-box" },
      el("p", { text: "Everyone has voted." }),
      el("div", { class: "name", text: "Did they lie or tell the truth?" }),
      el("button", { class: "btn pink", text: "🥁 Reveal answer", onclick: revealResult })
    );
  },

  reveal() {
    const active = S.players[S.activeIndex];
    const card = el("div", { class: "card" },
      el("h2", { text: `${active.name} ${S.activeTruth ? "told the truth" : "lied"}` }),
      el("img", { class: "reveal-img", src: S.currentImage.url, alt: S.currentImage.alt })
    );

    if (S.voteMode === "group" && S.groupVoteCounts) {
      const c = S.groupVoteCounts;
      card.appendChild(el("p", {
        text: `Group vote: ${c.truthCount} said "truth", ${c.lieCount} said "lie" — ${c.correct} of ${S.voters.length} guessed correctly.`,
      }));
    } else {
      const list = el("ul", { class: "scoreboard" });
      for (const v of S.votes) {
        const p = S.players[v.index];
        const correct = v.guessTruth === S.activeTruth;
        list.appendChild(el("li", { class: `vote-result ${correct ? "correct" : "wrong"}` },
          el("span", { text: `${p.name}: said "${v.guessTruth ? "truth" : "lie"}"` }),
          el("span", { text: correct ? "✔ +1" : "✘" })
        ));
      }
      card.appendChild(list);
    }

    if (S.lastBonus) {
      card.appendChild(el("p", { text: `${active.name} fooled the majority: +1 bonus point.` }));
    }

    card.appendChild(el("h2", { text: "Scores" }));
    const scores = el("ul", { class: "scoreboard" });
    S.players.forEach((p) => scores.appendChild(el("li", {},
      el("span", { text: p.name }), el("span", { text: String(p.score) })
    )));
    card.appendChild(scores);

    const isLast = S.round + 1 >= S.totalRounds;
    card.appendChild(el("button", {
      class: "btn pink",
      text: isLast ? "See final podium" : "Next round",
      onclick: nextRound,
    }));
    return card;
  },

  podium() {
    const ranked = [...S.players].sort((a, b) => b.score - a.score);
    const card = el("div", { class: "card" }, el("h1", { text: "🏆 Podium 🏆" }));
    ranked.forEach((p, i) => {
      card.appendChild(el("div", { class: `podium-item ${i === 0 ? "podium-1" : ""}` },
        el("span", { text: `${i + 1}. ${p.name}` }),
        el("span", { text: String(p.score) })
      ));
    });
    card.appendChild(el("button", { class: "btn lime", text: "Play again", onclick: resetGame }));
    return card;
  },
};

render();
