// Self-check para la lógica de juego (rotación de turnos, mazo de imágenes,
// puntaje). Sin frameworks: node test.js
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// Stub mínimo de DOM para poder cargar game.js fuera del navegador.
function makeNode() {
  return {
    attrs: {}, listeners: {}, children: [], text: "",
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(evt, fn) { this.listeners[evt] = fn; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    get firstChild() { return this.children[0]; },
    set textContent(v) { this.text = v; },
  };
}

const sandbox = {
  document: {
    getElementById: () => makeNode(),
    createElement: () => makeNode(),
    createTextNode: (t) => ({ text: t }),
  },
  EXOTIC_IMAGES: Array.from({ length: 5 }, (_, i) => ({ url: "img" + i, alt: "alt" + i })),
  FAKE_CONTEXTS: ["ctx0", "ctx1", "ctx2"],
  Math,
  console,
};
vm.createContext(sandbox);
// game.js declara con const/function a nivel de módulo: en un vm context esas
// ligaduras top-level no quedan como propiedades del sandbox por sí solas, así
// que las exponemos explícitamente al final del mismo script.
const src = fs.readFileSync(__dirname + "/game.js", "utf8") + `
this.S = S; this.addPlayer = addPlayer; this.removePlayer = removePlayer;
this.startGame = startGame; this.confirmPassActive = confirmPassActive;
this.markTruth = markTruth; this.confirmPassVote = confirmPassVote;
this.submitVote = submitVote; this.revealResult = revealResult; this.nextRound = nextRound;
this.resetGame = resetGame; this.drawImage = drawImage; this.computeGroupScores = computeGroupScores;
this.rerollImage = rerollImage;
this.suggestContext = suggestContext;
`;
vm.runInContext(src, sandbox);

const S = sandbox.S;

// --- setup: 3 jugadores, 4 rondas ---
sandbox.addPlayer("Ana");
sandbox.addPlayer("Beto");
sandbox.addPlayer("Cami");
sandbox.startGame(4);

// Ronda 0: activo debería ser jugadores[0 % 3] = Ana
assert.strictEqual(S.activeIndex, 0, "ronda 0 -> activo Ana");
sandbox.confirmPassActive();
sandbox.markTruth(true); // Ana dice la verdad

// Votantes: Beto(1) y Cami(2). Empate: uno acierta, uno falla -> sin bono.
sandbox.confirmPassVote();
sandbox.submitVote(true); // Beto acierta
sandbox.confirmPassVote();
sandbox.submitVote(false); // Cami falla
assert.strictEqual(S.screen, "suspense", "tras el último voto se espera el botón de revelar");
sandbox.revealResult();
assert.strictEqual(S.lastBonus, false, "empate 1-1 no da bono al activo");
assert.strictEqual(S.players[0].score, 0, "Ana no gana bono en empate");
assert.strictEqual(S.players[1].score, 1, "Beto acierta +1");
assert.strictEqual(S.players[2].score, 0, "Cami falla, 0");

sandbox.nextRound();
// Ronda 1: activo = 1 % 3 = Beto
assert.strictEqual(S.activeIndex, 1, "ronda 1 -> activo Beto");
sandbox.confirmPassActive();
sandbox.markTruth(false); // Beto miente

// Votantes: Ana(0) y Cami(2). Mayoría se equivoca (ambos dicen "verdad") -> bono a Beto.
sandbox.confirmPassVote();
sandbox.submitVote(true); // Ana falla (cree que dijo la verdad)
sandbox.confirmPassVote();
sandbox.submitVote(true); // Cami falla también
sandbox.revealResult();
assert.strictEqual(S.lastBonus, true, "mayoría equivocada da bono al activo");
assert.strictEqual(S.players[1].score, 2, "Beto: 1 de ronda 0 (acertó) + 1 de bono en ronda 1");

sandbox.nextRound();
// Ronda 2: activo = 2 % 3 = Cami. Modo grupal.
assert.strictEqual(S.activeIndex, 2, "ronda 2 -> activo Cami");
S.voteMode = "group";
sandbox.confirmPassActive();
sandbox.markTruth(true); // Cami dice la verdad
assert.strictEqual(S.screen, "group-vote", "modo grupal salta directo a group-vote, sin pasar el dispositivo");

// Votantes: Ana(0) y Beto(1). Ambos aciertan (dicen "verdad") -> mayoría acierta -> cada votante +1.
S.pendingGroupTruthCount = 2;
S.screen = "suspense";
sandbox.revealResult();
assert.strictEqual(S.lastBonus, false, "mayoría acierta en modo grupal no da bono al activo");
assert.strictEqual(S.players[2].score, 0, "Cami (activa) no gana nada: la mayoría acertó, no la engañó");
assert.strictEqual(S.players[0].score, 1, "Ana suma +1 por acierto grupal (0 + 1)");
assert.strictEqual(S.players[1].score, 3, "Beto suma +1 por acierto grupal (2 + 1)");

// --- reroll de imagen: máximo 3 por ronda, se reinicia cada ronda ---
sandbox.resetGame();
sandbox.startGame(2);
sandbox.confirmPassActive();
assert.strictEqual(S.rerollsLeft, 3, "cada ronda arranca con 3 rerolls");
sandbox.rerollImage();
sandbox.rerollImage();
sandbox.rerollImage();
assert.strictEqual(S.rerollsLeft, 0, "3 rerolls consumidos -> 0 restantes");
sandbox.rerollImage(); // no debería bajar de 0 ni volver a dibujar
assert.strictEqual(S.rerollsLeft, 0, "no se puede rerollear más allá del límite");

// --- suggest context: aleatorio de FAKE_CONTEXTS, se reinicia por ronda ---
assert.strictEqual(S.suggestedContext, null, "sin sugerencia al empezar la ronda");
sandbox.suggestContext();
assert.ok(sandbox.FAKE_CONTEXTS.includes(S.suggestedContext), "suggestContext elige uno de FAKE_CONTEXTS");

sandbox.markTruth(true);
S.pendingGroupTruthCount = S.voters.length; // voteMode sigue en "group" desde el bloque anterior
S.screen = "suspense";
sandbox.revealResult();
sandbox.nextRound();
assert.strictEqual(S.rerollsLeft, 3, "el contador de rerolls se reinicia en la siguiente ronda");
assert.strictEqual(S.suggestedContext, null, "la sugerencia se reinicia en la siguiente ronda");

// --- mazo de imágenes: no debería repetir dentro de una vuelta completa ---
S.imagePool = []; // fuerza a arrancar una vuelta fresca en el próximo draw
const seen = new Set();
for (let i = 0; i < 5; i++) seen.add(sandbox.drawImage().url);
assert.strictEqual(seen.size, 5, "las 5 imágenes salen sin repetirse en una vuelta");

console.log("OK: todos los checks pasaron");
