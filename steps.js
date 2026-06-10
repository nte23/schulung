// ============================================================
// INTRO — Teleprompter (Ziel page)
// ============================================================

const ZIEL_STACK = ['#zielHeading', '#zielAnswer', '#item1', '#item2', '#item3'];
const DEPTH_SCALE =   [1,    0.7,  0.6,  0.55, 0.5];
const DEPTH_OPACITY = [1,    0.55, 0.4,  0.35, 0.3];

function buildZielStep(revealIndex) {
    return {
        timeline: (tl) => {
            for (let i = 0; i < revealIndex; i++) {
                const el = document.querySelector(ZIEL_STACK[i]);
                const depth = revealIndex - i;
                const s = DEPTH_SCALE[Math.min(depth, DEPTH_SCALE.length - 1)];
                const o = DEPTH_OPACITY[Math.min(depth, DEPTH_OPACITY.length - 1)];
                tl.to(el, { scale: s, opacity: o, duration: 0.5, ease: 'power2.inOut' }, 0);
            }
            const newEl = document.querySelector(ZIEL_STACK[revealIndex]);
            tl.set(newEl, { opacity: 0, y: 30, scale: 1 }, 0);
            tl.to(newEl, { opacity: 1, y: 0, duration: FADE_IN_DURATION, ease: FADE_IN_EASE }, 0.15);
        },
        replay: () => {
            for (let i = 0; i <= revealIndex; i++) {
                const el = document.querySelector(ZIEL_STACK[i]);
                const depth = revealIndex - i;
                const s = DEPTH_SCALE[Math.min(depth, DEPTH_SCALE.length - 1)];
                const o = DEPTH_OPACITY[Math.min(depth, DEPTH_OPACITY.length - 1)];
                gsap.set(el, { scale: s, opacity: o, y: 0 });
            }
        }
    };
}

// ============================================================
// TEIL 1 — Morph Flow helpers
// ============================================================

const MORPH_WORDS = ['mw0', 'mw1', 'mw2', 'mw3', 'mw4', 'mw5'];
const WORD_TEXTS = ['Der', 'Patent', 'anspruch', 'betrifft', 'eine', 'Vorrichtung'];
// No space before mw2 — it continues mw1 as one compound word (Patentanspruch)
const COMPOUND_PAIRS = new Set([2]);
const CHAR_SPEED = 0.045; // seconds per character

// Step 8: Typewriter — type directly into the word-text spans (same elements that become tokens)
function buildTypewriter() {
    return {
        timeline: (tl) => {
            const question = document.getElementById('morphQuestion');
            const overline = document.getElementById('morphOverline');
            const wordEls = MORPH_WORDS.map(id => document.getElementById(id));
            const textEls = wordEls.map(el => el.querySelector('.word-text'));

            // 1. Fade out question + overline, then collapse so they don't push content down
            tl.to([question, overline], {
                opacity: 0, y: -20, duration: 0.4, ease: FADE_OUT_EASE
            });
            tl.set([question, overline], { display: 'none' });

            // 2. Clear word texts, hide token-ids, remove flex gap (use text spaces instead)
            const typeStart = 0.6;
            tl.call(() => {
                textEls.forEach(t => { t.textContent = ''; });
                document.querySelectorAll('#morphWords .token-id').forEach(el => {
                    el.style.display = 'none';
                });
                // Hide compound bracket so it doesn't take vertical space
                const cb = document.getElementById('morphBracketCompound');
                if (cb) cb.style.display = 'none';
                wordEls.forEach(el => gsap.set(el, { opacity: 1 }));
                document.getElementById('morphWords').classList.add('typing-mode');
            }, null, typeStart);

            // 3. Build the full character sequence with spaces as part of word spans
            //    Space before each word (except first and compound continuations)
            const charSequence = []; // { char, textEl, wordEl }
            WORD_TEXTS.forEach((word, wi) => {
                // Add leading space (typed into this word's span)
                if (wi > 0 && !COMPOUND_PAIRS.has(wi)) {
                    charSequence.push({ char: ' ', textEl: textEls[wi], wordEl: wordEls[wi], isSpace: true });
                }
                word.split('').forEach(char => {
                    charSequence.push({ char, textEl: textEls[wi], wordEl: wordEls[wi] });
                });
            });

            // 4. Type the full sequence — move .typing cursor on each new word element
            let t = typeStart + 0.15;
            let lastWordEl = null;
            charSequence.forEach((item, i) => {
                tl.call(() => {
                    if (item.wordEl !== lastWordEl) {
                        wordEls.forEach(el => el.classList.remove('typing'));
                        item.wordEl.classList.add('typing');
                        lastWordEl = item.wordEl;
                    }
                    item.textEl.textContent += item.char;
                }, null, t + i * CHAR_SPEED);
            });
            t += charSequence.length * CHAR_SPEED;

            // Keep cursor blinking on last word after typing finishes
        },
        replay: () => {
            gsap.set(document.getElementById('morphQuestion'), { opacity: 0, display: 'none' });
            gsap.set(document.getElementById('morphOverline'), { opacity: 0, display: 'none' });
            const wordsContainer = document.getElementById('morphWords');
            wordsContainer.classList.add('typing-mode');
            document.querySelectorAll('#morphWords .token-id').forEach(el => {
                el.style.display = 'none';
            });
            const cb = document.getElementById('morphBracketCompound');
            if (cb) cb.style.display = 'none';
            MORPH_WORDS.forEach((id, i) => {
                const el = document.getElementById(id);
                const prefix = (i > 0 && !COMPOUND_PAIRS.has(i)) ? ' ' : '';
                el.querySelector('.word-text').textContent = prefix + WORD_TEXTS[i];
                // Forward path leaves the word elements at FADE_IN_Y: they are
                // [data-anim] children of pg-morph (set to y:25 by the page
                // transition at step 7) but are never animated to y:0 by the
                // typewriter timeline. Match that authored state here.
                gsap.set(el, { opacity: 1, y: FADE_IN_Y });
            });
            // Show cursor on last word
            document.getElementById(MORPH_WORDS[MORPH_WORDS.length - 1]).classList.add('typing');
        }
    };
}

// Step 9: Tokenize — cursor gone, label appears, words split + colorize + IDs + bracket
function buildTokenize() {
    return {
        timeline: (tl) => {
            const wordsContainer = document.getElementById('morphWords');
            const label = document.getElementById('morphLabel');
            const sublabel = document.getElementById('morphSublabel');
            const bracket = document.getElementById('morphBracketCompound');
            const wordEls = MORPH_WORDS.map(id => document.getElementById(id));

            // 1. Remove typing cursor + strip baked-in spaces (keep gap:0 via typing-mode for now)
            tl.call(() => {
                wordEls.forEach(el => el.classList.remove('typing'));
                MORPH_WORDS.forEach((id, i) => {
                    document.getElementById(id).querySelector('.word-text').textContent = WORD_TEXTS[i];
                });
            });

            // 2. Label appears
            const labelStart = 0.3;
            tl.set(label, { opacity: 0, y: 15 });
            tl.to(label, { opacity: 1, y: 0, duration: 0.5, ease: FADE_IN_EASE }, labelStart);
            tl.set(sublabel, { opacity: 0, y: 15 });
            tl.to(sublabel, { opacity: 1, y: 0, duration: 0.5, ease: FADE_IN_EASE }, labelStart + 0.15);

            // 3. Split into tokens — swap from typing-mode (gap:0) straight to split (gap:1.2rem)
            //    The CSS transition on gap handles the smooth animation
            const splitTime = labelStart + 0.6;
            tl.call(() => {
                wordsContainer.classList.remove('sentence', 'typing-mode');
                wordsContainer.classList.add('split');
            }, null, splitTime);

            // 4. Token backgrounds
            wordEls.forEach((el, i) => {
                tl.call(() => { el.classList.add('tokenized'); }, null, splitTime + 0.5 + i * 0.08);
            });

            // 5. Restore token-id display, then fade them in
            const tokenIds = document.querySelectorAll('#morphWords .token-id');
            tl.call(() => {
                tokenIds.forEach(el => { el.style.display = ''; });
            }, null, splitTime + 1.0);
            tl.to(tokenIds, {
                opacity: 1, duration: 0.4, stagger: 0.06, ease: FADE_IN_EASE
            }, splitTime + 1.0);

            // 6. Bracket under compound word — restore display, then fade in
            tl.call(() => { bracket.style.display = ''; }, null, splitTime + 1.4);
            tl.set(bracket, { opacity: 0, y: 10 }, splitTime + 1.4);
            tl.to(bracket, {
                opacity: 1, y: 0, duration: 0.5, ease: FADE_IN_EASE
            }, splitTime + 1.4);
        },
        replay: () => {
            // Hide opener, remove typing cursor
            document.querySelectorAll('.morph-word.typing').forEach(el => el.classList.remove('typing'));
            gsap.set(document.getElementById('morphQuestion'), { opacity: 0, display: 'none' });
            gsap.set(document.getElementById('morphOverline'), { opacity: 0, display: 'none' });

            // Show label
            gsap.set(document.getElementById('morphLabel'), { opacity: 1, y: 0 });
            gsap.set(document.getElementById('morphSublabel'), { opacity: 1, y: 0 });

            // Show split/tokenized state with IDs
            const wordsContainer = document.getElementById('morphWords');
            wordsContainer.classList.remove('sentence', 'typing-mode');
            wordsContainer.classList.add('split');

            MORPH_WORDS.forEach((id, i) => {
                const el = document.getElementById(id);
                el.querySelector('.word-text').textContent = WORD_TEXTS[i];
                // y:25 inherited from the page transition (see buildTypewriter
                // replay) — tokenize never animates it back to 0.
                gsap.set(el, { opacity: 1, y: FADE_IN_Y });
                el.classList.add('tokenized');
            });

            document.querySelectorAll('#morphWords .token-id').forEach(el => {
                el.style.display = '';
                gsap.set(el, { opacity: 1 });
            });

            // buildTypewriter hid the bracket via display:none; tokenize's
            // forward path restores display:'' before fading it in.
            const bracket = document.getElementById('morphBracketCompound');
            bracket.style.display = '';
            gsap.set(bracket, { opacity: 1, y: 0 });
        }
    };
}

// ============================================================
// TEIL 1 — Neural Net helpers
// ============================================================

let nnViz = null;
let nnAmbientViz = null;

function ensureAmbient() {
    if (!nnAmbientViz) {
        nnAmbientViz = new NNAmbient(document.getElementById('nnAmbient'));
    }
    return nnAmbientViz;
}

function ensureNN() {
    if (!nnViz) {
        const box = document.getElementById('nnBox');
        nnViz = new NeuralNetViz(box);
    }
    return nnViz;
}

// Output sentence for the NN stream (patent-related German)
const NN_OUTPUT_WORDS = [
    'Die', 'Vorrichtung', 'umfasst', 'einen', 'Sensor,', 'der',
    'Signale', 'erfasst', 'und', 'über', 'eine', 'Steuereinheit',
    'verarbeitet,', 'wobei', 'die', 'Auswertung', 'in', 'Echtzeit',
    'erfolgt', 'und', 'das', 'Ergebnis', 'an', 'eine', 'nachgeschaltete',
    'Einheit', 'übermittelt', 'wird.'
];

// Step 10: Tokens morph to IDs on left → NN appears → tokens fly in → endless stream
function buildTokensToNN() {
    return {
        timeline: (tl) => {
            const wordsContainer = document.getElementById('morphWords');
            const label = document.getElementById('morphLabel');
            const sublabel = document.getElementById('morphSublabel');
            const bracket = document.getElementById('morphBracketCompound');
            const labelNN = document.getElementById('morphLabelNN');
            const sublabelNN = document.getElementById('morphSublabelNN');
            const tokenIds = document.querySelectorAll('#morphWords .token-id');
            const wordTexts = document.querySelectorAll('#morphWords .word-text');
            const nnBox = document.getElementById('nnBox');

            const flyEls = [
                document.getElementById('mw0'),
                document.getElementById('compound-patent'),
                document.getElementById('mw3'),
                document.getElementById('mw4'),
                document.getElementById('mw5'),
            ];

            // 1. Fade out labels, bracket, word text — keep token IDs visible
            tl.to([label, sublabel], { opacity: 0, y: -10, duration: 0.3, ease: FADE_OUT_EASE }, 0);
            tl.to(bracket, { opacity: 0, duration: 0.3 }, 0);
            tl.to(wordTexts, { opacity: 0, duration: 0.3, ease: FADE_OUT_EASE }, 0);

            // 2. Strip backgrounds, FLIP token IDs to left column
            tl.call(() => {
                MORPH_WORDS.forEach(id => {
                    document.getElementById(id).classList.remove('tokenized');
                });

                const oldRects = flyEls.map(el => el.getBoundingClientRect());

                wordsContainer.classList.remove('split', 'sentence', 'typing-mode');
                wordsContainer.classList.add('nn-input');
                wordTexts.forEach(el => { el.style.display = ''; });
                tokenIds.forEach(el => { el.style.display = ''; });

                const newRects = flyEls.map(el => el.getBoundingClientRect());

                flyEls.forEach((el, i) => {
                    gsap.set(el, {
                        x: oldRects[i].left - newRects[i].left,
                        y: oldRects[i].top - newRects[i].top
                    });
                });
            }, null, 0.35);

            // 3. Numbers move to left column
            tl.to(flyEls, {
                x: 0, y: 0,
                duration: 0.8, stagger: 0.05,
                ease: 'power2.inOut'
            }, 0.4);

            // 4. Build NN (hidden), fade it in after tokens settle
            tl.call(() => {
                const viz = ensureNN();
                viz.build();
            }, null, 1.2);
            tl.to(nnBox, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.25);

            // 5. Labels
            tl.set(labelNN, { opacity: 0, y: 15 });
            tl.to(labelNN, { opacity: 1, y: 0, duration: 0.5, ease: FADE_IN_EASE }, 1.4);
            tl.set(sublabelNN, { opacity: 0, y: 15 });
            tl.to(sublabelNN, { opacity: 1, y: 0, duration: 0.5, ease: FADE_IN_EASE }, 1.55);

            // 6. Initial tokens fly in one at a time — same rhythm as the stream loop
            const flyInStart = 2.0;
            const CYCLE_INTERVAL = 1.4; // matches stream interval
            const flyDuration = 0.8;
            const outputContainer = document.getElementById('nnStreamOutput');
            const firstWords = NN_OUTPUT_WORDS.slice(0, flyEls.length);
            const boltDelay = flyDuration * 0.5;
            const boltPropTime = ensureNN().LAYERS * 0.1;

            flyEls.forEach((el, i) => {
                const cycleStart = flyInStart + i * CYCLE_INTERVAL;

                // Token flies rightward, turns yellow halfway, fades out
                tl.to(el.querySelector('.token-id') || el, {
                    color: '#fabb43', duration: 0.05
                }, cycleStart + flyDuration * 0.45);

                tl.to(el, {
                    x: '+=30vw', scale: 0.4, opacity: 0,
                    duration: flyDuration, ease: 'power2.in'
                }, cycleStart);

                // Bolt fires synced with token arriving at NN
                tl.call(() => {
                    ensureNN().fireBolt();
                }, null, cycleStart + boltDelay);

                // Output word flies out after bolt propagates
                tl.call(() => {
                    const outEl = document.createElement('div');
                    outEl.className = 'nn-stream-token';
                    outEl.textContent = firstWords[i];
                    outputContainer.appendChild(outEl);

                    gsap.set(outEl, { opacity: 0.3, color: '#fabb43', x: 0 });
                    gsap.to(outEl, {
                        x: '10vw', opacity: 1, color: '#1a1a1a',
                        duration: 0.35, ease: 'power2.out'
                    });
                    gsap.to(outEl, {
                        x: '22vw', opacity: 0,
                        duration: 0.8, delay: 0.35,
                        ease: 'power1.in',
                        onComplete: () => outEl.remove()
                    });
                }, null, cycleStart + boltDelay + boltPropTime);
            });

            // 7. Start endless stream seamlessly after last initial token
            const streamStart = flyInStart + flyEls.length * CYCLE_INTERVAL;
            tl.call(() => {
                const viz = ensureNN();
                const inputEl = document.getElementById('nnStreamInput');
                const outputEl = document.getElementById('nnStreamOutput');
                viz.startStream(inputEl, outputEl, NN_OUTPUT_WORDS, flyEls.length);
            }, null, streamStart);
        },
        replay: () => {
            gsap.set(document.getElementById('morphLabel'), { opacity: 0 });
            gsap.set(document.getElementById('morphSublabel'), { opacity: 0 });
            gsap.set(document.getElementById('morphBracketCompound'), { opacity: 0 });
            gsap.set(document.getElementById('morphQuestion'), { opacity: 0, display: 'none' });
            gsap.set(document.getElementById('morphOverline'), { opacity: 0, display: 'none' });

            const wordsContainer = document.getElementById('morphWords');
            wordsContainer.classList.remove('split', 'sentence', 'typing-mode');
            wordsContainer.classList.add('nn-input');

            // Tokens already flew in — hide them; forward strips .tokenized too
            MORPH_WORDS.forEach(id => {
                const el = document.getElementById(id);
                el.classList.remove('tokenized');
                gsap.set(el, { opacity: 0, scale: 0.4 });
            });
            gsap.set(document.getElementById('compound-patent'), { opacity: 0, scale: 0.4 });
            document.querySelectorAll('#morphWords .token-id').forEach(el => { el.style.display = ''; });
            document.querySelectorAll('#morphWords .word-text').forEach(el => { el.style.display = ''; });

            const nnBox = document.getElementById('nnBox');
            gsap.set(nnBox, { opacity: 1 });
            const viz = ensureNN();
            viz.build();

            // Start stream immediately on replay
            const inputEl = document.getElementById('nnStreamInput');
            const outputEl = document.getElementById('nnStreamOutput');
            viz.startStream(inputEl, outputEl, NN_OUTPUT_WORDS);

            gsap.set(document.getElementById('morphLabelNN'), { opacity: 1, y: 0 });
            gsap.set(document.getElementById('morphSublabelNN'), { opacity: 1, y: 0 });
        }
    };
}

// ============================================================
// TEIL 1 — Zoom into NN (Positional Encoding → Embeddings → Attention)
// ============================================================

// Helper: set common hidden state for zoom replay functions
function _zoomReplayBase() {
    document.body.classList.add('nn-dark');
    ensureAmbient().start();
    gsap.set(document.getElementById('nnBox'), { opacity: 0, scale: 3.5, filter: 'blur(12px)' });
    ['morphLabel', 'morphSublabel', 'morphLabelNN', 'morphSublabelNN',
     'nnStreamInput', 'nnStreamOutput', 'morphBracketCompound'].forEach(id => {
        gsap.set(document.getElementById(id), { opacity: 0 });
    });
    gsap.set(document.getElementById('morphQuestion'), { opacity: 0, display: 'none' });
    gsap.set(document.getElementById('morphOverline'), { opacity: 0, display: 'none' });
    MORPH_WORDS.forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('tokenized');
        gsap.set(el, { opacity: 0 });
    });
    gsap.set(document.getElementById('compound-patent'), { opacity: 0 });
    const wc = document.getElementById('morphWords');
    wc.classList.remove('split', 'sentence', 'typing-mode');
    wc.classList.add('nn-input');
}

// Step 11: NN rushes past → PosEnc arrives (left), Embed dimmed behind (right)
function buildZoomToPosEnc() {
    return {
        timeline: (tl) => {
            const nnBox = document.getElementById('nnBox');
            const labelNN = document.getElementById('morphLabelNN');
            const sublabelNN = document.getElementById('morphSublabelNN');
            const streamIn = document.getElementById('nnStreamInput');
            const streamOut = document.getElementById('nnStreamOutput');
            const posEnc = document.getElementById('zoomPosEnc');
            const embed = document.getElementById('zoomEmbed');

            // 1. Stop stream, fade out stream + labels
            tl.call(() => { if (nnViz) nnViz.stopStream(); }, null, 0);
            tl.to([streamIn, streamOut, labelNN, sublabelNN], {
                opacity: 0, duration: 0.2
            }, 0);

            // 2. Body goes dark + start ambient
            tl.call(() => {
                document.body.classList.add('nn-dark');
                ensureAmbient().start();
            }, null, 0.1);

            // 3. Existing NN zooms toward camera
            tl.to(nnBox, {
                scale: 3.5, opacity: 0, filter: 'blur(12px)',
                duration: 1.5, ease: 'power2.in'
            }, 0.05);

            // 4. PosEnc arrives left, Embed barely visible far behind (right)
            gsap.set(posEnc, { scale: 0.5, opacity: 0 });
            gsap.set(embed, { scale: 0.4, opacity: 0, filter: 'blur(3px)' });

            tl.to(posEnc, {
                scale: 1, opacity: 0.85,
                duration: 1.0, ease: 'power2.out'
            }, 0.6);

            tl.to(embed, {
                scale: 0.55, opacity: 0.08,
                duration: 1.2, ease: 'power2.out'
            }, 0.9);
        },
        replay: () => {
            _zoomReplayBase();
            gsap.set(document.getElementById('zoomPosEnc'), { scale: 1, opacity: 0.85 });
            gsap.set(document.getElementById('zoomEmbed'), { scale: 0.55, opacity: 0.08, filter: 'blur(3px)' });
            gsap.set(document.getElementById('zoomAttention'), { opacity: 0 });
        }
    };
}

// Step 12: PosEnc rushes past → Embed arrives (right), Attention dimmed behind
function buildZoomToEmbed() {
    return {
        timeline: (tl) => {
            const posEnc = document.getElementById('zoomPosEnc');
            const embed = document.getElementById('zoomEmbed');
            const att = document.getElementById('zoomAttention');

            // 1. PosEnc rushes toward camera
            tl.to(posEnc, {
                scale: 3, opacity: 0, filter: 'blur(10px)',
                duration: 0.7, ease: 'power2.in'
            }, 0);

            // 2. Embed sharpens + grows from its small blurred state to full
            tl.to(embed, {
                scale: 1, opacity: 0.85, filter: 'blur(0px)',
                duration: 1.0, ease: 'power2.out'
            }, 0.15);

            // 3. Attention: tiny, blurred, barely visible far behind
            gsap.set(att, { scale: 0.35, opacity: 0, filter: 'blur(4px)' });
            tl.to(att, {
                scale: 0.5, opacity: 0.06, filter: 'blur(3px)',
                duration: 1.0, ease: 'power2.out'
            }, 0.5);
        },
        replay: () => {
            _zoomReplayBase();
            gsap.set(document.getElementById('zoomPosEnc'), { opacity: 0 });
            gsap.set(document.getElementById('zoomEmbed'), { scale: 1, opacity: 0.85, filter: 'blur(0px)' });
            gsap.set(document.getElementById('zoomAttention'), { scale: 0.5, opacity: 0.06, filter: 'blur(3px)' });
        }
    };
}

// Step 13: Embed rushes past → Attention lands
function buildZoomToAttention() {
    return {
        timeline: (tl) => {
            const embed = document.getElementById('zoomEmbed');
            const att = document.getElementById('zoomAttention');
            const tokens = document.querySelectorAll('.att-token');

            // 1. Embed rushes toward camera
            tl.to(embed, {
                scale: 3, opacity: 0, filter: 'blur(10px)',
                duration: 0.7, ease: 'power2.in'
            }, 0);

            // 2. Attention sharpens from ghost state to full
            tl.to(att, {
                scale: 1, opacity: 1, filter: 'blur(0px)',
                duration: 1.2, ease: 'power2.out'
            }, 0.15);

            // 3. Tokens stagger in
            tokens.forEach((tok, i) => {
                tl.to(tok, { opacity: 1, duration: 0.3 }, 1.0 + i * 0.06);
            });
        },
        replay: () => {
            _zoomReplayBase();
            gsap.set(document.getElementById('zoomPosEnc'), { opacity: 0 });
            gsap.set(document.getElementById('zoomEmbed'), { opacity: 0 });
            gsap.set(document.getElementById('zoomAttention'), { scale: 1, opacity: 1 });
            document.querySelectorAll('.att-token').forEach(tok => gsap.set(tok, { opacity: 1 }));
        }
    };
}

// Measure actual token positions and draw arcs connecting to them.
// The SVG viewBox is set to match pixel dimensions so no scaling is needed.
function _drawArcsInSvg(svg, tokenRow, arcDefs) {
    const tokens = tokenRow.querySelectorAll('.att-token');
    const svgRect = svg.getBoundingClientRect();

    // Get center-x and top-y of each token, relative to the SVG element
    const pts = [];
    tokens.forEach(tok => {
        const r = tok.getBoundingClientRect();
        pts.push({
            x: r.left + r.width / 2 - svgRect.left,
            y: r.top - svgRect.top  // top edge of the token pill
        });
    });

    // Set viewBox to match actual pixel size — no coordinate conversion needed
    const w = svgRect.width;
    const h = svgRect.height;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';

    arcDefs.forEach(([a, b, color, sw]) => {
        const x1 = pts[a].x, x2 = pts[b].x;
        const baseY = pts[a].y; // top of the token pills
        const mx = (x1 + x2) / 2;
        const dist = Math.abs(x2 - x1);
        const peakY = baseY - (20 + dist * 0.18);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1},${baseY} Q ${mx},${peakY} ${x2},${baseY}`);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', sw);
        path.setAttribute('fill', 'none');
        path.classList.add('att-arc');
        svg.appendChild(path);
    });
}

// Main attention arc definitions: [fromIdx, toIdx, color, strokeWidth]
const MAIN_ARCS = [
    [1, 2, '#e8853d', 3.5],  // Patent → anspruch (strongest)
    [0, 1, '#fabb43', 2],    // Der → Patent
    [3, 5, '#fabb43', 3],    // betrifft → Vorrichtung
    [4, 5, '#fabb43', 1.5],  // eine → Vorrichtung
    [2, 3, '#fabb43', 1.2],  // anspruch → betrifft
];

function buildShowArcs() {
    return {
        timeline: (tl) => {
            const svg = document.getElementById('attArcSvg');
            const tokenRow = document.querySelector('#attArea .att-tokens');

            // Draw arcs at actual measured positions
            tl.call(() => {
                _drawArcsInSvg(svg, tokenRow, MAIN_ARCS);
            });

            // Animate them in with stroke-dash reveal
            tl.call(() => {
                const arcs = svg.querySelectorAll('.att-arc');
                arcs.forEach((arc, i) => {
                    const len = arc.getTotalLength();
                    arc.style.strokeDasharray = len;
                    arc.style.strokeDashoffset = len;
                    gsap.set(arc, { opacity: 0 });
                    gsap.to(arc, {
                        opacity: 0.8, strokeDashoffset: 0,
                        duration: 0.8, ease: 'power2.out',
                        delay: i * 0.18
                    });
                });
            }, null, 0.05);
        },
        replay: () => {
            _zoomReplayBase();
            gsap.set(document.getElementById('zoomPosEnc'), { opacity: 0 });
            gsap.set(document.getElementById('zoomEmbed'), { opacity: 0 });
            gsap.set(document.getElementById('zoomAttention'), { scale: 1, opacity: 1 });
            document.querySelectorAll('#attArea .att-token').forEach(tok => gsap.set(tok, { opacity: 1 }));

            const svg = document.getElementById('attArcSvg');
            const tokenRow = document.querySelector('#attArea .att-tokens');
            _drawArcsInSvg(svg, tokenRow, MAIN_ARCS);
            svg.querySelectorAll('.att-arc').forEach(arc => {
                const len = arc.getTotalLength();
                arc.style.strokeDasharray = len;
                arc.style.strokeDashoffset = '0';
                gsap.set(arc, { opacity: 0.8 });
            });
        }
    };
}

// ============================================================
// TEIL 1 — Layer stacking + Parameter grid
// ============================================================


// Create a stack card with token row + empty SVG (arcs drawn later via _drawArcsInSvg)
function _createStackCard() {
    const card = document.createElement('div');
    card.className = 'stack-card';
    card.innerHTML =
        '<div class="att-tokens">' +
        '<span class="att-token at-blue" style="opacity:1">Der</span>' +
        '<span class="att-token at-purple" style="opacity:1">Patent</span>' +
        '<span class="att-token at-orange" style="opacity:1">anspruch</span>' +
        '<span class="att-token at-teal" style="opacity:1">betrifft</span>' +
        '<span class="att-token at-pink" style="opacity:1">eine</span>' +
        '<span class="att-token at-blue" style="opacity:1">Vorrichtung</span>' +
        '</div>' +
        '<svg viewBox="0 0 1000 150" fill="none" class="att-svg"></svg>';
    return card;
}

// Different arc defs per layer: [fromIdx, toIdx, color, strokeWidth]
const LAYER_ARC_DEFS = [
    [[0,2,'#e8853d',2.5], [3,5,'#fabb43',2.2], [1,3,'#fabb43',1]],
    [[1,3,'#fabb43',2.5], [0,1,'#e8853d',1.5], [2,5,'#fabb43',1.2]],
    [[0,5,'#fabb43',1.8], [1,2,'#e8853d',2], [3,4,'#fabb43',1.5]],
    [[2,5,'#e8853d',2.2], [0,3,'#fabb43',1.5], [4,5,'#fabb43',1]],
];

function _buildAndDrawStack(attLayer, numLayers) {
    attLayer.querySelectorAll('.stack-card, .stack-dots').forEach(el => el.remove());

    const cards = [];
    for (let i = 0; i < numLayers; i++) {
        const card = _createStackCard();
        attLayer.appendChild(card);
        cards.push(card);
    }

    const dots = document.createElement('div');
    dots.className = 'stack-dots';
    dots.textContent = '· · ·';
    attLayer.appendChild(dots);

    // Draw arcs after DOM layout (needs measured positions)
    FX.raf(() => {
        cards.forEach((card, i) => {
            const svg = card.querySelector('.att-svg');
            const tokenRow = card.querySelector('.att-tokens');
            _drawArcsInSvg(svg, tokenRow, LAYER_ARC_DEFS[i]);
            // Make arcs instantly visible (no dash animation for stacked)
            svg.querySelectorAll('.att-arc').forEach(arc => gsap.set(arc, { opacity: 0.8 }));
        });
    });

    return { cards, dots };
}

function _buildStack(attLayer, numLayers) {
    attLayer.querySelectorAll('.stack-card, .stack-dots').forEach(el => el.remove());
    const cards = [];
    for (let i = 0; i < numLayers; i++) {
        const card = _createStackCard();
        attLayer.appendChild(card);
        cards.push(card);
    }
    const dots = document.createElement('div');
    dots.className = 'stack-dots';
    dots.textContent = '· · ·';
    attLayer.appendChild(dots);
    return { cards, dots };
}

function _drawAllStackArcs(cards) {
    cards.forEach((card, i) => {
        const svg = card.querySelector('.att-svg');
        const tokenRow = card.querySelector('.att-tokens');
        _drawArcsInSvg(svg, tokenRow, LAYER_ARC_DEFS[i]);
        svg.querySelectorAll('.att-arc').forEach(a => gsap.set(a, { opacity: 0.8 }));
    });
}

function buildStackLayers() {
    const numLayers = 4;

    return {
        timeline: (tl) => {
            const attLayer = document.getElementById('zoomAttention');
            const heading = document.getElementById('attHeadingZoom');
            const label = document.getElementById('attLabel');
            const sub = document.getElementById('attSubZoom');
            const attArea = document.getElementById('attArea');

            // Manual FLIP: capture positions, change layout, animate from old to new
            tl.call(() => {
                // Capture old positions
                const els = [label, heading, sub, attArea];
                const oldRects = els.map(el => el.getBoundingClientRect());

                // Apply layout changes instantly
                attLayer.style.justifyContent = 'flex-start';
                attLayer.style.paddingTop = '5vh';
                heading.style.fontSize = '1.1rem';
                heading.style.marginBottom = '0.1rem';
                sub.textContent = '×96 Schichten — jede lernt andere Zusammenhänge';

                // Capture new positions
                const newRects = els.map(el => el.getBoundingClientRect());

                // Set elements at their OLD positions via transform offset
                els.forEach((el, i) => {
                    const dx = oldRects[i].left - newRects[i].left;
                    const dy = oldRects[i].top - newRects[i].top;
                    gsap.set(el, { x: dx, y: dy });
                });
                // Also scale heading from old font size
                const scaleX = oldRects[1].width / newRects[1].width;
                gsap.set(heading, { scaleX, scaleY: scaleX, transformOrigin: 'left top' });

                // Animate to final positions (x:0, y:0)
                gsap.to(els, {
                    x: 0, y: 0, duration: 0.6, ease: 'power2.inOut', stagger: 0
                });
                gsap.to(heading, {
                    scaleX: 1, scaleY: 1, duration: 0.6, ease: 'power2.inOut'
                });

                // After FLIP animation: dim att-area, build stacked cards
                gsap.delayedCall(0.65, () => {
                    gsap.to(attArea, { opacity: 0.5, duration: 0.3 });

                    // Redraw main arcs at new layout
                    const mainSvg = document.getElementById('attArcSvg');
                    const mainTokens = document.querySelector('#attArea .att-tokens');
                    _drawArcsInSvg(mainSvg, mainTokens, MAIN_ARCS);
                    mainSvg.querySelectorAll('.att-arc').forEach(a => gsap.set(a, { opacity: 0.8 }));

                    // Build stacked cards
                    const { cards, dots } = _buildStack(attLayer, numLayers);
                    cards.forEach(c => gsap.set(c, { opacity: 0, y: 10 }));
                    gsap.set(dots, { opacity: 0 });

                    FX.raf(() => { FX.raf(() => {
                        _drawAllStackArcs(cards);
                        cards.forEach((card, i) => {
                            gsap.to(card, {
                                opacity: Math.max(0.12, 0.4 - i * 0.07), y: 0,
                                duration: 0.3, ease: 'power2.out',
                                delay: i * 0.12
                            });
                        });
                        gsap.to(dots, { opacity: 1, duration: 0.3, delay: numLayers * 0.12 });
                    }); });
                });
            }, null, 0);
        },
        replay: () => {
            _zoomReplayBase();
            gsap.set(document.getElementById('zoomPosEnc'), { opacity: 0 });
            gsap.set(document.getElementById('zoomEmbed'), { opacity: 0 });
            gsap.set(document.getElementById('zoomParams'), { opacity: 0 });

            const attLayer = document.getElementById('zoomAttention');
            const label = document.getElementById('attLabel');
            const heading = document.getElementById('attHeadingZoom');
            const sub = document.getElementById('attSubZoom');
            const attArea = document.getElementById('attArea');

            attLayer.style.justifyContent = 'flex-start';
            attLayer.style.paddingTop = '5vh';
            heading.style.fontSize = '1.1rem';
            heading.style.marginBottom = '0.1rem';
            gsap.set(attLayer, { scale: 1, opacity: 1 });
            sub.textContent = '×96 Schichten — jede lernt andere Zusammenhänge';
            gsap.set(sub, { opacity: 1 });
            gsap.set(attArea, { opacity: 0.5 });
            // Forward path FLIP-tweens x/y to 0, leaving an explicit identity
            // matrix (matrix(1,0,0,1,0,0)). Reproduce it so the snapshot matches.
            gsap.set([label, heading, sub, attArea], { x: 0, y: 0, scaleX: 1, scaleY: 1 });
            document.querySelectorAll('#attArea .att-token').forEach(tok => gsap.set(tok, { opacity: 1 }));

            const { cards, dots } = _buildStack(attLayer, numLayers);
            cards.forEach((card, i) => gsap.set(card, { opacity: Math.max(0.12, 0.4 - i * 0.07), x: 0, y: 0 }));

            FX.raf(() => { FX.raf(() => {
                const mainSvg = document.getElementById('attArcSvg');
                const mainTokens = document.querySelector('#attArea .att-tokens');
                _drawArcsInSvg(mainSvg, mainTokens, MAIN_ARCS);
                mainSvg.querySelectorAll('.att-arc').forEach(a => gsap.set(a, { opacity: 0.8 }));
                _drawAllStackArcs(cards);
            }); });
        }
    };
}

// Alternative arc defs per layer after parameter change
const SHIFTED_ARCS = [
    [0, 5, '#e8853d', 3],    // Der → Vorrichtung (long-range)
    [1, 3, '#fabb43', 2.5],  // Patent → betrifft
    [2, 4, '#fabb43', 1.5],  // anspruch → eine
    [3, 5, '#fabb43', 2],    // betrifft → Vorrichtung
];

const SHIFTED_LAYER_ARC_DEFS = [
    [[0, 3, '#e8853d', 2], [1, 5, '#fabb43', 2], [2, 4, '#fabb43', 1.2]],
    [[0, 4, '#fabb43', 2.5], [2, 3, '#e8853d', 1.5], [1, 5, '#fabb43', 1]],
    [[1, 4, '#fabb43', 1.8], [0, 2, '#e8853d', 2], [3, 5, '#fabb43', 1.5]],
    [[0, 1, '#e8853d', 2.2], [2, 5, '#fabb43', 1.5], [3, 4, '#fabb43', 1.2]],
];

function _buildParamGrid(grid, cols) {
    grid.innerHTML = '';
    const total = cols * cols;
    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'param-cell';
        const line = document.createElement('div');
        line.className = 'dial-line';
        line.style.transform = `rotate(${Math.random() * 360}deg)`;
        cell.appendChild(line);
        grid.appendChild(cell);
    }
}

function _redrawAllArcsAfterLayout(mainArcDefs, layerArcDefs) {
    FX.raf(() => { FX.raf(() => {
        const mainSvg = document.getElementById('attArcSvg');
        const mainTokens = document.querySelector('#attArea .att-tokens');
        _drawArcsInSvg(mainSvg, mainTokens, mainArcDefs);
        mainSvg.querySelectorAll('.att-arc').forEach(a => gsap.set(a, { opacity: 0.8 }));

        const stackCards = document.querySelectorAll('#zoomAttention .stack-card');
        stackCards.forEach((card, i) => {
            const svg = card.querySelector('.att-svg');
            const tokenRow = card.querySelector('.att-tokens');
            _drawArcsInSvg(svg, tokenRow, layerArcDefs[i] || layerArcDefs[0]);
            svg.querySelectorAll('.att-arc').forEach(a => gsap.set(a, { opacity: 0.8 }));
        });
    }); });
}

function buildShowParamPanel() {
    return {
        timeline: (tl) => {
            const panel = document.getElementById('paramPanel');
            const grid = document.getElementById('paramGrid');
            const attLayer = document.getElementById('zoomAttention');

            // Build 12×12 grid
            _buildParamGrid(grid, 12);
            const cells = grid.querySelectorAll('.param-cell');

            // 1. Compress attention layer to the left + slide panel in simultaneously
            tl.to(attLayer, {
                paddingRight: '32vw',
                duration: 0.5, ease: 'power2.inOut'
            }, 0);
            tl.to(panel, {
                x: 0, duration: 0.5, ease: 'power2.out'
            }, 0);

            // 2. Redraw arcs after compression settles
            tl.call(() => {
                _redrawAllArcsAfterLayout(MAIN_ARCS, LAYER_ARC_DEFS);
            }, null, 0.55);

            // 3. Stagger cells in — diagonal wave
            cells.forEach((cell, i) => {
                const row = Math.floor(i / 12);
                const col = i % 12;
                const delay = 0.3 + (row + col) * 0.015;
                tl.to(cell, { opacity: 1, duration: 0.15 }, delay);
            });
        },
        replay: () => {
            _zoomReplayBase();
            _replayStackState();

            const attLayer = document.getElementById('zoomAttention');
            gsap.set(attLayer, { paddingRight: '32vw' });

            const panel = document.getElementById('paramPanel');
            const grid = document.getElementById('paramGrid');
            gsap.set(panel, { x: 0 });
            _buildParamGrid(grid, 12);
            grid.querySelectorAll('.param-cell').forEach(c => { c.style.opacity = '1'; });

            _redrawAllArcsAfterLayout(MAIN_ARCS, LAYER_ARC_DEFS);
        }
    };
}

// All arc set variations to cycle through
const ALL_ARC_SETS = [
    { main: MAIN_ARCS, layers: LAYER_ARC_DEFS },
    { main: SHIFTED_ARCS, layers: SHIFTED_LAYER_ARC_DEFS },
];

let _paramLoopInterval = null;
let _paramArcIndex = 0;

function _stopParamLoop() {
    if (_paramLoopInterval) {
        FX.clearInterval(_paramLoopInterval);
        _paramLoopInterval = null;
    }
}

function _runParamCycle() {
    _paramArcIndex = (_paramArcIndex + 1) % ALL_ARC_SETS.length;
    const arcSet = ALL_ARC_SETS[_paramArcIndex];
    const mainSvg = document.getElementById('attArcSvg');
    const mainTokens = document.querySelector('#attArea .att-tokens');

    // Spin dials
    const lines = document.querySelectorAll('#paramGrid .dial-line');
    const cells = document.querySelectorAll('#paramGrid .param-cell');
    lines.forEach((line, i) => {
        const row = Math.floor(i / 12);
        const col = i % 12;
        gsap.to(line, {
            rotation: '+=' + (90 + Math.random() * 270),
            duration: 0.5, ease: 'power2.inOut',
            delay: (row + col) * 0.006
        });
    });
    cells.forEach((cell, i) => {
        const row = Math.floor(i / 12);
        const col = i % 12;
        const d = (row + col) * 0.006;
        gsap.to(cell, { background: 'rgba(250,187,67,0.4)', duration: 0.15, delay: d + 0.1 });
        gsap.to(cell, { background: 'rgba(250,187,67,0.15)', duration: 0.4, delay: d + 0.25 });
    });

    // Fade out old arcs
    gsap.to(document.querySelectorAll('#zoomAttention .att-arc'), {
        opacity: 0, duration: 0.3, delay: 0.2
    });

    // Draw new arcs after fade
    gsap.delayedCall(0.5, () => {
        _drawArcsInSvg(mainSvg, mainTokens, arcSet.main);

        const stackCards = document.querySelectorAll('#zoomAttention .stack-card');
        stackCards.forEach((card, i) => {
            const svg = card.querySelector('.att-svg');
            const tokenRow = card.querySelector('.att-tokens');
            const defs = arcSet.layers[i] || arcSet.layers[0];
            _drawArcsInSvg(svg, tokenRow, defs);
        });

        const allNewArcs = document.querySelectorAll('#zoomAttention .att-arc');
        allNewArcs.forEach((arc, i) => {
            const len = arc.getTotalLength();
            arc.style.strokeDasharray = len;
            arc.style.strokeDashoffset = len;
            gsap.set(arc, { opacity: 0 });
            gsap.to(arc, {
                opacity: 0.8, strokeDashoffset: 0,
                duration: 0.5, ease: 'power2.out',
                delay: i * 0.03
            });
        });
    });
}

function buildSpinAndShiftArcs() {
    return {
        timeline: (tl) => {
            // First cycle immediately
            tl.call(() => {
                _runParamCycle();

                // Start endless loop
                _paramLoopInterval = FX.setInterval(_runParamCycle, 3000);
            }, null, 0);
        },
        replay: () => {
            _zoomReplayBase();
            _replayStackState();

            const panel = document.getElementById('paramPanel');
            const grid = document.getElementById('paramGrid');
            gsap.set(panel, { x: 0 });
            _buildParamGrid(grid, 12);
            grid.querySelectorAll('.param-cell').forEach(c => { c.style.opacity = '1'; });

            // Start loop
            _paramArcIndex = 0;
            FX.raf(() => { FX.raf(() => {
                _runParamCycle();
                _paramLoopInterval = FX.setInterval(_runParamCycle, 3000);
            }); });
        }
    };
}

// Shared replay helper for the stacked state (heading shrunk, layers visible)
function _replayStackState() {
    const attLayer = document.getElementById('zoomAttention');
    const label = document.getElementById('attLabel');
    const heading = document.getElementById('attHeadingZoom');
    const sub = document.getElementById('attSubZoom');
    const attArea = document.getElementById('attArea');

    attLayer.style.justifyContent = 'flex-start';
    attLayer.style.paddingTop = '5vh';
    heading.style.fontSize = '1.1rem';
    heading.style.marginBottom = '0.1rem';
    gsap.set(attLayer, { scale: 1, opacity: 1 });
    sub.textContent = '×96 Schichten — jede lernt andere Zusammenhänge';
    gsap.set(sub, { opacity: 1 });
    gsap.set(attArea, { opacity: 0.5 });
    // Forward FLIP leaves an explicit identity matrix on these — match it.
    gsap.set([label, heading, sub, attArea], { x: 0, y: 0, scaleX: 1, scaleY: 1 });
    document.querySelectorAll('#attArea .att-token').forEach(tok => gsap.set(tok, { opacity: 1 }));

    const { cards } = _buildStack(attLayer, 4);
    cards.forEach((card, i) => gsap.set(card, { opacity: Math.max(0.12, 0.4 - i * 0.07), x: 0, y: 0 }));

    FX.raf(() => { FX.raf(() => {
        const mainSvg = document.getElementById('attArcSvg');
        const mainTokens = document.querySelector('#attArea .att-tokens');
        _drawArcsInSvg(mainSvg, mainTokens, MAIN_ARCS);
        mainSvg.querySelectorAll('.att-arc').forEach(a => gsap.set(a, { opacity: 0.8 }));
        _drawAllStackArcs(cards);
    }); });
}

// ============================================================
// TEIL 1 — NTP: Zoom out + Probability bars
// ============================================================

const NTP_DATA = [
    { fill: 'ntp-f0', pct: 'ntp-p0', width: 68, label: '34%' },
    { fill: 'ntp-f1', pct: 'ntp-p1', width: 44, label: '22%' },
    { fill: 'ntp-f2', pct: 'ntp-p2', width: 36, label: '18%' },
    { fill: 'ntp-f3', pct: 'ntp-p3', width: 22, label: '11%' },
    { fill: 'ntp-f4', pct: 'ntp-p4', width: 14, label: '7%' },
];

function _ntpReplayBase() {
    _stopParamLoop();
    _stopLoopForever();
    if (nnAmbientViz) nnAmbientViz.stop();
    document.body.classList.remove('nn-dark');

    // The NN is dissolved node-by-node (children fade), but the nnBox container
    // itself stays at opacity 1 on the forward path and is never touched again
    // through the NTP / temperature steps. Match that visible-but-empty state.
    gsap.set(document.getElementById('nnBox'), { opacity: 1 });
    gsap.set(document.getElementById('zoomAttention'), { opacity: 0 });
    gsap.set(document.getElementById('zoomPosEnc'), { opacity: 0 });
    gsap.set(document.getElementById('zoomEmbed'), { opacity: 0 });
    gsap.set(document.getElementById('paramPanel'), { x: '100%' });
    gsap.set(document.getElementById('nnStreamInput'), { opacity: 0 });
    gsap.set(document.getElementById('nnStreamOutput'), { opacity: 0 });
    gsap.set(document.getElementById('loopPage'), { opacity: 0 });
    gsap.set(document.getElementById('loopGenSlot'), { opacity: 0 });
    gsap.set(document.getElementById('loopArrow'), { opacity: 0 });
    document.querySelectorAll('.loop-flyer').forEach(g => g.remove());
    document.getElementById('nnBox').classList.remove('loop-dim');
    gsap.set(document.getElementById('morphLabel'), { opacity: 0 });
    gsap.set(document.getElementById('morphSublabel'), { opacity: 0 });
    gsap.set(document.getElementById('morphLabelNN'), { opacity: 0 });
    gsap.set(document.getElementById('morphSublabelNN'), { opacity: 0 });
    gsap.set(document.getElementById('morphQuestion'), { opacity: 0, display: 'none' });
    gsap.set(document.getElementById('morphOverline'), { opacity: 0, display: 'none' });
    document.querySelectorAll('.zoom-layer').forEach(zl => gsap.set(zl, { opacity: 0 }));
    MORPH_WORDS.forEach(id => gsap.set(document.getElementById(id), { opacity: 0 }));
    gsap.set(document.getElementById('compound-patent'), { opacity: 0 });
}

// Full zoom-out: one click, reverse of the 3-step zoom-in
// Attention → Embed flies past → PosEnc flies past → NN dezooms → streaming
function buildZoomOutToNN() {
    return {
        timeline: (tl) => {
            const att = document.getElementById('zoomAttention');
            const embed = document.getElementById('zoomEmbed');
            const posEnc = document.getElementById('zoomPosEnc');
            const nnBox = document.getElementById('nnBox');
            const labelNN = document.getElementById('morphLabelNN');
            const sublabelNN = document.getElementById('morphSublabelNN');

            // t=0: Stop loop, slide panel out
            tl.call(() => { _stopParamLoop(); }, null, 0);
            tl.to(document.getElementById('paramPanel'), { x: '100%', duration: 0.3, ease: 'power2.in' }, 0);

            // Build NN immediately (hidden) so there's no construction delay later
            tl.call(() => {
                if (nnViz) { nnViz.destroy(); nnViz = null; }
                ensureNN().build();
                gsap.set(nnBox, { opacity: 0, scale: 3.5, filter: 'blur(12px)' });
            }, null, 0);

            // Everything overlaps heavily — each layer starts shrinking
            // BEFORE the previous one has fully appeared

            // Attention shrinks
            tl.to(att, {
                scale: 0.4, opacity: 0, filter: 'blur(6px)',
                duration: 0.5, ease: 'power2.in'
            }, 0);

            // Embed: appears from behind, never stops — linear in, accelerate out
            gsap.set(embed, { scale: 3, opacity: 0, filter: 'blur(10px)' });
            tl.to(embed, {
                keyframes: [
                    { scale: 1.5, opacity: 0.4, filter: 'blur(1px)', duration: 0.25, ease: 'none' },
                    { scale: 0.3, opacity: 0, filter: 'blur(6px)', duration: 0.25, ease: 'power2.in' }
                ]
            }, 0.1);

            // PosEnc: same — starts before embed is gone
            gsap.set(posEnc, { scale: 3, opacity: 0, filter: 'blur(10px)' });
            tl.to(posEnc, {
                keyframes: [
                    { scale: 1.5, opacity: 0.35, filter: 'blur(1px)', duration: 0.22, ease: 'none' },
                    { scale: 0.3, opacity: 0, filter: 'blur(6px)', duration: 0.22, ease: 'power2.in' }
                ]
            }, 0.35);

            // NN dezooms — starts while PosEnc is still mid-flight
            tl.to(nnBox, {
                scale: 1, opacity: 1, filter: 'blur(0px)',
                duration: 1.0, ease: 'power2.out'
            }, 0.4);

            // Body → white + stop ambient
            tl.call(() => {
                document.body.classList.remove('nn-dark');
                if (nnAmbientViz) nnAmbientViz.stop();
            }, null, 0.7);

            // Labels fade in
            tl.set(labelNN, { opacity: 0, y: 10 });
            tl.to(labelNN, { opacity: 1, y: 0, duration: 0.4, ease: FADE_IN_EASE }, 1.2);
            tl.set(sublabelNN, { opacity: 0, y: 10 });
            tl.to(sublabelNN, { opacity: 1, y: 0, duration: 0.4, ease: FADE_IN_EASE }, 1.3);

            // Restart streaming
            tl.call(() => {
                const viz = ensureNN();
                const inputEl = document.getElementById('nnStreamInput');
                const outputEl = document.getElementById('nnStreamOutput');
                gsap.set(inputEl, { opacity: 1 });
                gsap.set(outputEl, { opacity: 1 });
                viz.startStream(inputEl, outputEl, NN_OUTPUT_WORDS);
            }, null, 1.4);
        },
        replay: () => {
            _stopParamLoop();
            if (nnAmbientViz) nnAmbientViz.stop();
            document.body.classList.remove('nn-dark');

            document.querySelectorAll('.zoom-layer').forEach(zl => gsap.set(zl, { opacity: 0 }));
            gsap.set(document.getElementById('paramPanel'), { x: '100%' });
            gsap.set(document.getElementById('morphQuestion'), { opacity: 0, display: 'none' });
            gsap.set(document.getElementById('morphOverline'), { opacity: 0, display: 'none' });
            gsap.set(document.getElementById('morphLabel'), { opacity: 0 });
            gsap.set(document.getElementById('morphSublabel'), { opacity: 0 });
            MORPH_WORDS.forEach(id => gsap.set(document.getElementById(id), { opacity: 0 }));
            gsap.set(document.getElementById('compound-patent'), { opacity: 0 });

            const nnBox = document.getElementById('nnBox');
            if (nnViz) { nnViz.destroy(); nnViz = null; }
            const viz = ensureNN();
            viz.build();
            gsap.set(nnBox, { opacity: 1, scale: 1, filter: 'none' });
            gsap.set(document.getElementById('morphLabelNN'), { opacity: 1, y: 0 });
            gsap.set(document.getElementById('morphSublabelNN'), { opacity: 1, y: 0 });

            const inputEl = document.getElementById('nnStreamInput');
            const outputEl = document.getElementById('nnStreamOutput');
            gsap.set(inputEl, { opacity: 1 });
            gsap.set(outputEl, { opacity: 1 });
            viz.startStream(inputEl, outputEl, NN_OUTPUT_WORDS);
        }
    };
}

// ============================================================
// TEIL 1 — Autoregressive loop (between zoom-out and NTP)
// ============================================================
const LOOP_PROMPT = 'Schreibe einen Patentanspruch für eine Kaffeemaschine.';
const LOOP_SENTENCES = [
    // Structured cycles (slow, dramatic)
    'Vorrichtung zur Zubereitung von Heißgetränken.',
    'Die Vorrichtung umfasst eine Brüheinheit und einen Wassertank.',
    'Wobei die Brüheinheit über eine Steuereinheit beheizbar ist.',
    // Forever-loop rotation (faster)
    'Die Steuereinheit ist mit einem Display und Eingabetasten ausgestattet.',
    'Ein Sensor erfasst die Wassertemperatur und übermittelt sie an die Steuerung.',
    'Mit einem austauschbaren Filterelement zur Reinigung des Brühwassers.',
    'Wobei der Wassertank über eine Markierung zur Füllstandsanzeige verfügt.'
];
const LOOP_STRUCTURED = 3;       // first N sentences run as structured GSAP timeline
// Per-cycle type durations (ms) for the structured run — accelerating
const LOOP_TYPE_MS = [2200, 1400, 1100];
const LOOP_OUT_FLY_MS = [1000, 750, 650];
const LOOP_IN_FLY_MS = [700, 550, 500];

// Forever-loop pacing (used after the structured cycles complete)
const FOREVER_IN_MS = 450;
const FOREVER_TYPE_MS = 900;
const FOREVER_OUT_MS = 550;
const FOREVER_GAP_MS = 150;

function _loopTypeInto(tl, el, text, startAt, totalMs) {
    const perChar = totalMs / Math.max(text.length, 1);
    tl.call(() => { el.textContent = ''; }, null, startAt);
    text.split('').forEach((ch, i) => {
        tl.call(() => { el.textContent += ch; }, null, startAt + 0.001 + (i * perChar) / 1000);
    });
}

// Auto-scroll the page so the latest appended sentence is visible
// (when content exceeds the page's max-height, oldest text clips off the top).
function _scrollLoopPage() {
    const page = document.getElementById('loopPage');
    const content = document.getElementById('loopPageContent');
    if (!page || !content) return;
    const styles = getComputedStyle(page);
    const padTop = parseFloat(styles.paddingTop) || 0;
    const padBot = parseFloat(styles.paddingBottom) || 0;
    const available = page.clientHeight - padTop - padBot;
    const overflow = content.scrollHeight - available;
    content.style.transform = overflow > 0 ? `translateY(-${overflow}px)` : '';
    content.style.transition = 'transform 0.4s ease';
}

// === Loop cycle ====================================================
// Per cycle: the actual left page element flies into the NN (not a copy),
// the bolt fires, the right slot reveals the full text + new sentence in amber,
// then the page returns to its position with the new sentence appended.
// Cycles through LOOP_SENTENCES forever; resets page to prompt-only at the
// start of each new pass.
let _foreverState = null;

// Phase durations (ms)
const CYCLE_FLY_IN_MS   = 520;   // page → NN
const CYCLE_BOLT_LEAD   = 220;   // bolt fires this far into the in-flight
const CYCLE_EMERGE_MS   = 580;   // gen-slot emerges from NN — slow enough that the bolt finishes first
const CYCLE_TYPE_MS     = 750;   // typewriter for the new amber sentence
const CYCLE_HOLD_MS     = 280;   // hold full output visible before flying back
const CYCLE_FLY_BACK_MS = 750;   // gen-slot follows the arrow back to the page
const CYCLE_GAP_MS      = 300;   // breath between cycles (page has absorbed new content)

function _stopLoopForever() {
    if (!_foreverState) return;
    _foreverState.active = false;
    _foreverState.timeouts.forEach(t => clearTimeout(t));
    _foreverState = null;
    // Reset both boxes' transforms in case we interrupted mid-flight
    const page = document.getElementById('loopPage');
    const genSlot = document.getElementById('loopGenSlot');
    if (page) {
        gsap.killTweensOf(page);
        gsap.set(page, { x: 0, y: 0, scale: 1, opacity: 1, clearProps: 'transform' });
    }
    if (genSlot) {
        gsap.killTweensOf(genSlot);
        gsap.set(genSlot, {
            x: 0, y: 0, scale: 1, opacity: 1,
            clearProps: 'transform,backgroundColor,borderColor,boxShadow'
        });
        const lbl = genSlot.querySelector('.loop-gen-label');
        if (lbl) {
            gsap.killTweensOf(lbl);
            gsap.set(lbl, { clearProps: 'color' });
        }
    }
}

function _startLoopForever(startIdx) {
    _stopLoopForever();
    _foreverState = { idx: startIdx || 0, active: true, timeouts: [] };
    _runForeverCycle();
}

function _runForeverCycle() {
    if (!_foreverState || !_foreverState.active) return;
    const state = _foreverState;

    const passLen = LOOP_SENTENCES.length;
    const sentenceIdx = state.idx % passLen;
    const sentence = LOOP_SENTENCES[sentenceIdx];

    const page = document.getElementById('loopPage');
    const pageContent = document.getElementById('loopPageContent');
    const genSlot = document.getElementById('loopGenSlot');
    const genTextEl = document.getElementById('loopGenText');
    const nnBox = document.getElementById('nnBox');
    if (!page || !pageContent || !genSlot || !genTextEl || !nnBox) return;

    // Start of a fresh pass: wipe page back to prompt-only
    if (sentenceIdx === 0 && state.idx > 0) {
        pageContent.innerHTML = '<span class="loop-prompt">' + LOOP_PROMPT + '</span>';
        pageContent.style.transform = '';
    }
    state.idx++;

    // Capture page content (becomes prefix on the right output)
    const prefixHTML = pageContent.innerHTML;

    // Measure positions
    const pageRect = page.getBoundingClientRect();
    const slotRect = genSlot.getBoundingClientRect();
    const nnRect = nnBox.getBoundingClientRect();
    const nnCx = nnRect.left + nnRect.width / 2;
    const nnCy = nnRect.top + nnRect.height / 2;
    const pageCx = pageRect.left + pageRect.width / 2;
    const pageCy = pageRect.top + pageRect.height / 2;
    const slotCx = slotRect.left + slotRect.width / 2;
    const slotCy = slotRect.top + slotRect.height / 2;

    // ── Phase A: page flies into NN ──────────────────────────────
    gsap.killTweensOf(page);
    gsap.to(page, {
        x: nnCx - pageCx, y: nnCy - pageCy, scale: 0.2, opacity: 0,
        duration: CYCLE_FLY_IN_MS / 1000, ease: 'power2.in'
    });

    // ── Phase B: bolt fires partway through ──────────────────────
    state.timeouts.push(FX.setTimeout(() => {
        if (!state.active) return;
        if (nnViz) nnViz.fireBolt();
    }, CYCLE_BOLT_LEAD));

    // ── Phase C: gen-slot emerges from NN to its natural position ─
    const emergeStart = CYCLE_FLY_IN_MS;
    state.timeouts.push(FX.setTimeout(() => {
        if (!state.active) return;
        // Pre-populate full content (prefix + empty amber span)
        genTextEl.innerHTML = prefixHTML + '<span class="loop-new" id="loopNewSpan"> </span>';
        gsap.set(genTextEl, { opacity: 1 });
        // Position gen-slot at NN center, scaled down + invisible
        gsap.killTweensOf(genSlot);
        gsap.set(genSlot, { x: nnCx - slotCx, y: nnCy - slotCy, scale: 0.25, opacity: 0 });
        // Animate to natural (right-side) position
        gsap.to(genSlot, {
            x: 0, y: 0, scale: 1, opacity: 1,
            duration: CYCLE_EMERGE_MS / 1000, ease: 'power2.out'
        });
    }, emergeStart));

    // ── Phase D: typewriter into the amber span ──────────────────
    const typeStart = emergeStart + CYCLE_EMERGE_MS;
    state.timeouts.push(FX.setTimeout(() => {
        if (!state.active) return;
        const newSpan = document.getElementById('loopNewSpan');
        if (!newSpan) return;
        const perChar = CYCLE_TYPE_MS / Math.max(sentence.length, 1);
        let i = 0;
        const tick = () => {
            if (!_foreverState || !_foreverState.active) return;
            if (i < sentence.length) {
                newSpan.textContent += sentence[i++];
                state.timeouts.push(FX.setTimeout(tick, perChar));
            }
        };
        tick();
    }, typeStart));

    // ── Phase E: gen-slot follows the arrow back to the page ─────
    const flyBackStart = typeStart + CYCLE_TYPE_MS + CYCLE_HOLD_MS;
    state.timeouts.push(FX.setTimeout(() => {
        if (!state.active) return;
        const path = document.getElementById('loopArrowPath');
        if (!path) return;
        const totalLen = path.getTotalLength();
        if (totalLen <= 0) return;

        // Color morph: amber (output) → white (page/input), eased to peak at the dip.
        // Box + label + the amber highlight inside all transition together so when
        // the gen-slot lands on the page position, it visually IS the page.
        const morphDur = CYCLE_FLY_BACK_MS / 1000;
        gsap.to(genSlot, {
            backgroundColor: '#ffffff',
            borderColor: 'rgba(0, 0, 0, 0.1)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08)',
            duration: morphDur, ease: 'power1.inOut'
        });
        const genLabel = genSlot.querySelector('.loop-gen-label');
        if (genLabel) {
            gsap.to(genLabel, {
                color: '#888888',
                duration: morphDur, ease: 'power1.inOut'
            });
        }
        const newSpan = document.getElementById('loopNewSpan');
        if (newSpan) {
            gsap.to(newSpan, {
                color: '#888888',
                backgroundColor: 'rgba(250, 187, 67, 0)',
                duration: morphDur, ease: 'power1.inOut'
            });
        }

        const follow = { p: 0 };
        gsap.killTweensOf(follow);
        gsap.to(follow, {
            p: 1,
            duration: CYCLE_FLY_BACK_MS / 1000,
            ease: 'power1.inOut',
            onUpdate: () => {
                if (!_foreverState || !_foreverState.active) return;
                const pt = _vbToPx(path.getPointAtLength(follow.p * totalLen));
                gsap.set(genSlot, { x: pt.x - slotCx, y: pt.y - slotCy });
            },
            onComplete: () => {
                if (!_foreverState || !_foreverState.active) return;
                // The gen-slot is now at the page's screen position and visually
                // IDENTICAL to the page (white bg, gray label, muted new text, no
                // pill offset). Swap instantly — no crossfade, no jump.
                pageContent.innerHTML = prefixHTML + '<span class="loop-added"> ' + sentence + '</span>';
                _scrollLoopPage();
                gsap.set(page, { x: 0, y: 0, scale: 1, opacity: 1 });
                gsap.set(genSlot, { opacity: 0 });
                // Reset gen-slot off-screen for next cycle
                genTextEl.innerHTML = '';
                gsap.set(genTextEl, { opacity: 1 });
                gsap.set(genSlot, {
                    x: 0, y: 0, scale: 1, opacity: 0,
                    clearProps: 'backgroundColor,borderColor,boxShadow'
                });
                const lbl = genSlot.querySelector('.loop-gen-label');
                if (lbl) gsap.set(lbl, { clearProps: 'color' });
            }
        });
    }, flyBackStart));

    // ── Phase F: schedule next cycle ─────────────────────────────
    const cycleTotal = flyBackStart + CYCLE_FLY_BACK_MS + CYCLE_GAP_MS;
    state.timeouts.push(FX.setTimeout(() => _runForeverCycle(), cycleTotal));
}

// Rebuild the curved arrow path so it docks to the actual box edges
// (avoids overlap with the NN). Returns the path element for sampling.
function _buildLoopArrowPath() {
    const genSlot = document.getElementById('loopGenSlot');
    const page = document.getElementById('loopPage');
    const path = document.getElementById('loopArrowPath');
    if (!genSlot || !page || !path) return null;

    const sRect = genSlot.getBoundingClientRect();
    const pRect = page.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    // viewBox is 1600x900 with preserveAspectRatio=none (stretched to viewport)
    const toVbX = (px) => (px / vw) * 1600;
    const toVbY = (py) => (py / vh) * 900;

    // Path runs box-center to box-center; box backgrounds (z:6) cover the
    // inner portions, so the visible part of the curve is the dip below.
    const sx = toVbX(sRect.left + sRect.width / 2);
    const sy = toVbY(sRect.top + sRect.height / 2);
    const ex = toVbX(pRect.left + pRect.width / 2);
    const ey = toVbY(pRect.top + pRect.height / 2);

    // Dip well below the NN's bottom edge (NN spans ~19-81% of viewBox height).
    // For a cubic bezier with equal control-point y values, the visual midpoint
    // sits at (P0 + 3*CP + P3) / 4 — so to land below the NN we push CPs far down.
    const dipY = Math.min(880, Math.max(sy, ey) + 420);
    const cp1x = sx + (ex - sx) * 0.22;
    const cp2x = sx + (ex - sx) * 0.78;

    path.setAttribute('d', `M ${sx} ${sy} C ${cp1x} ${dipY}, ${cp2x} ${dipY}, ${ex} ${ey}`);
    return path;
}

// Convert a viewBox point (1600x900, non-uniform stretch) → viewport pixels
function _vbToPx(pt) {
    const svg = document.getElementById('loopArrow');
    const r = svg.getBoundingClientRect();
    return {
        x: (pt.x / 1600) * r.width + r.left,
        y: (pt.y / 900) * r.height + r.top
    };
}

// Smooth flyer: samples the SVG arrow path via getPointAtLength so the ghost
// actually follows the curve (not just keyframe waypoints).
function _spawnLoopFlyer(text, durSec, onLand) {
    const path = _buildLoopArrowPath();
    if (!path) return;
    const totalLen = path.getTotalLength();

    const ghost = document.createElement('div');
    ghost.className = 'loop-flyer';
    ghost.textContent = text;
    document.body.appendChild(ghost);

    const p0 = _vbToPx(path.getPointAtLength(0));
    gsap.set(ghost, {
        left: p0.x, top: p0.y,
        xPercent: -50, yPercent: -50,
        scale: 1, opacity: 1
    });

    const state = { p: 0 };
    gsap.to(state, {
        p: 1, duration: durSec, ease: 'power1.inOut',
        onUpdate: () => {
            const pt = _vbToPx(path.getPointAtLength(state.p * totalLen));
            const sc = 1 - state.p * 0.55;
            // Fade in last 15%
            const op = state.p < 0.85 ? 1 : 1 - (state.p - 0.85) / 0.15;
            gsap.set(ghost, { left: pt.x, top: pt.y, scale: sc, opacity: op });
        },
        onComplete: () => {
            ghost.remove();
            if (onLand) onLand();
        }
    });
}

// Input flyer: a "card" of the current page content flies into the NN center.
// Conveys "the whole prompt + previous output is fed back in." Triggers onArrival
// when the ghost reaches the NN — that's when the bolt should fire.
function _spawnInputFlyer(durSec, onArrival, onLand) {
    const page = document.getElementById('loopPage');
    const pageContent = document.getElementById('loopPageContent');
    const nnBox = document.getElementById('nnBox');
    if (!page || !pageContent || !nnBox) return;

    const pRect = page.getBoundingClientRect();
    const nRect = nnBox.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = 'loop-flyer loop-flyer-input';
    // Snapshot current page content (preserves prompt + appended sentences styling)
    ghost.innerHTML = pageContent.innerHTML;
    document.body.appendChild(ghost);

    const startX = pRect.right - 12;
    const startY = pRect.top + pRect.height / 2;
    const endX = nRect.left + nRect.width / 2;
    const endY = nRect.top + nRect.height / 2;

    gsap.set(ghost, {
        left: startX, top: startY,
        xPercent: -50, yPercent: -50,
        scale: 0.85, opacity: 1,
        width: pRect.width * 0.85
    });

    const state = { p: 0 };
    let arrivalFired = false;
    gsap.to(state, {
        p: 1, duration: durSec, ease: 'power2.in',
        onUpdate: () => {
            const x = startX + (endX - startX) * state.p;
            const y = startY + (endY - startY) * state.p;
            const sc = 0.85 - state.p * 0.7;          // shrink toward NN
            const op = state.p < 0.7 ? 1 : 1 - (state.p - 0.7) / 0.3;
            gsap.set(ghost, { left: x, top: y, scale: sc, opacity: op });
            if (!arrivalFired && state.p > 0.6) {
                arrivalFired = true;
                if (onArrival) onArrival();
            }
        },
        onComplete: () => {
            ghost.remove();
            if (onLand) onLand();
        }
    });
}

function buildAutoregressiveLoop() {
    return {
        timeline: (tl) => {
            const page = document.getElementById('loopPage');
            const pageContent = document.getElementById('loopPageContent');
            const genSlot = document.getElementById('loopGenSlot');
            const genText = document.getElementById('loopGenText');
            const arrow = document.getElementById('loopArrow');
            const nnBox = document.getElementById('nnBox');
            const streamIn = document.getElementById('nnStreamInput');
            const streamOut = document.getElementById('nnStreamOutput');
            const labelNN = document.getElementById('morphLabelNN');
            const sublabelNN = document.getElementById('morphSublabelNN');

            // Stop the idle stream + clear its content
            tl.call(() => {
                if (nnViz) nnViz.stopStream();
                streamIn.innerHTML = '';
                streamOut.innerHTML = '';
                nnBox.classList.add('loop-dim');
            }, null, 0);

            tl.to([streamIn, streamOut], { opacity: 0, duration: 0.35 }, 0);

            // Swap NN labels for this beat
            tl.to([labelNN, sublabelNN], { opacity: 0, duration: 0.25 }, 0);
            tl.call(() => {
                labelNN.innerHTML = 'Schritt 3: <span class="hl">Autoregression</span>';
                sublabelNN.textContent = 'Output wird Teil des nächsten Inputs';
            }, null, 0.3);
            tl.to([labelNN, sublabelNN], { opacity: 1, duration: 0.4 }, 0.4);

            // Seed page with prompt, clear gen slot
            tl.call(() => {
                pageContent.innerHTML = '<span class="loop-prompt">' + LOOP_PROMPT + '</span>';
                genText.textContent = '';
                gsap.set(genText, { opacity: 1 });
            }, null, 0.3);

            // Fade in loop UI; gen-slot stays invisible (phase C of cycle 1 reveals it as it emerges from the NN)
            tl.to(page, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.45);
            tl.set(genSlot, { opacity: 0 }, 0.6);
            tl.call(() => { _buildLoopArrowPath(); }, null, 0.95);
            tl.to(arrow, { opacity: 0.7, duration: 0.5, ease: 'power2.out' }, 0.75);

            // Once UI is in, start the forever loop from sentence 0.
            tl.call(() => _startLoopForever(0), null, 1.3);
        },
        replay: () => {
            _stopLoopForever();
            if (nnViz) nnViz.stopStream();
            const page = document.getElementById('loopPage');
            const pageContent = document.getElementById('loopPageContent');
            const genSlot = document.getElementById('loopGenSlot');
            const genText = document.getElementById('loopGenText');
            const arrow = document.getElementById('loopArrow');
            const nnBox = document.getElementById('nnBox');
            const streamIn = document.getElementById('nnStreamInput');
            const streamOut = document.getElementById('nnStreamOutput');
            const labelNN = document.getElementById('morphLabelNN');
            const sublabelNN = document.getElementById('morphSublabelNN');

            document.querySelectorAll('.loop-flyer').forEach(g => g.remove());

            nnBox.classList.add('loop-dim');
            gsap.set([streamIn, streamOut], { opacity: 0 });
            streamIn.innerHTML = '';
            streamOut.innerHTML = '';

            labelNN.innerHTML = 'Schritt 3: <span class="hl">Autoregression</span>';
            sublabelNN.textContent = 'Output wird Teil des nächsten Inputs';
            gsap.set([labelNN, sublabelNN], { opacity: 1, y: 0 });

            // Page: prompt only; loop will fill it back up
            pageContent.innerHTML = '<span class="loop-prompt">' + LOOP_PROMPT + '</span>';
            pageContent.style.transform = '';
            genText.innerHTML = '';
            gsap.set(genText, { opacity: 1 });

            gsap.set(page, { opacity: 1, scale: 1, x: 0, y: 0, clearProps: 'transform' });
            gsap.set(genSlot, { opacity: 0, x: 0, y: 0, scale: 1 });
            gsap.set(arrow, { opacity: 0.7 });

            // Build arrow + restart forever loop on next frame (boxes need layout first)
            FX.raf(() => {
                _buildLoopArrowPath();
                _startLoopForever(0);
            });
        }
    };
}

function buildShowNTPFromNN() {
    return {
        timeline: (tl) => {
            const nnBox = document.getElementById('nnBox');
            const labelNN = document.getElementById('morphLabelNN');
            const sublabelNN = document.getElementById('morphSublabelNN');
            const streamIn = document.getElementById('nnStreamInput');
            const streamOut = document.getElementById('nnStreamOutput');
            const ntpContainer = document.getElementById('ntpContainer');

            // Stop stream + forever loop, clean up any flyers, un-dim NN
            tl.call(() => {
                _stopLoopForever();
                if (nnViz) nnViz.stopStream();
                document.querySelectorAll('.loop-flyer').forEach(g => g.remove());
                nnBox.classList.remove('loop-dim');
            }, null, 0);

            // Fade labels + streams + autoregressive loop UI
            const loopPage = document.getElementById('loopPage');
            const loopGenSlot = document.getElementById('loopGenSlot');
            const loopArrow = document.getElementById('loopArrow');
            tl.to([streamIn, streamOut, labelNN, sublabelNN, loopPage, loopGenSlot, loopArrow],
                { opacity: 0, duration: 0.3 }, 0);

            // Dissolve NN: edges first, then dots — radiating outward from center
            tl.call(() => {
                if (!nnViz || !nnViz.built) return;

                const cx = nnViz.W / 2, cy = nnViz.H / 2;

                // Sort edges by distance from center (closest first → dissolve outward)
                const sortedEdges = [...nnViz.edges].sort((a, b) => {
                    const amx = (nnViz.nodes[a.i].x + nnViz.nodes[a.j].x) / 2;
                    const amy = (nnViz.nodes[a.i].y + nnViz.nodes[a.j].y) / 2;
                    const bmx = (nnViz.nodes[b.i].x + nnViz.nodes[b.j].x) / 2;
                    const bmy = (nnViz.nodes[b.i].y + nnViz.nodes[b.j].y) / 2;
                    const da = Math.sqrt((amx - cx) ** 2 + (amy - cy) ** 2);
                    const db = Math.sqrt((bmx - cx) ** 2 + (bmy - cy) ** 2);
                    return da - db;
                });

                sortedEdges.forEach((edge, i) => {
                    gsap.to(edge.el, {
                        opacity: 0, duration: 0.25,
                        delay: i * 0.0006
                    });
                });

                // Sort nodes by distance from center (closest first)
                const sortedNodes = [...nnViz.nodes].sort((a, b) => {
                    const da = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2);
                    const db = Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2);
                    return da - db;
                });

                sortedNodes.forEach((node, i) => {
                    gsap.to(node.el, {
                        opacity: 0, scale: 0,
                        duration: 0.3, ease: 'power2.in',
                        delay: 0.1 + i * 0.004
                    });
                });
            }, null, 0.1);

            // Hide sentence, bars, insight — only heading visible for now
            const ntpSentence = document.querySelector('.ntp-sentence');
            const ntpBars = document.querySelector('.ntp-bars');
            const ntpInsight = document.getElementById('ntpInsight');
            const ntpLabel = document.getElementById('ntpLabel');
            const ntpHeading = document.getElementById('ntpHeading');
            gsap.set([ntpSentence, ntpBars], { opacity: 0 });
            gsap.set(ntpInsight, { opacity: 0 });

            // NTP container visible but heading starts centered
            // Move label + heading to center via offset from their natural top-left position
            gsap.set(ntpContainer, { opacity: 0 });
            tl.call(() => {
                gsap.set(ntpContainer, { opacity: 1, scale: 1 });
                // Measure natural (top-left) positions
                const labelRect = ntpLabel.getBoundingClientRect();
                const headRect = ntpHeading.getBoundingClientRect();
                // Target: center of viewport
                const vcx = window.innerWidth / 2;
                const vcy = window.innerHeight / 2;
                // Offset to center
                const labelDx = vcx - (labelRect.left + labelRect.width / 2);
                const labelDy = vcy - labelRect.top - labelRect.height - 30;
                const headDx = vcx - (headRect.left + headRect.width / 2);
                const headDy = vcy - (headRect.top + headRect.height / 2);
                gsap.set(ntpLabel, { x: labelDx, y: labelDy, opacity: 0 });
                gsap.set(ntpHeading, { x: headDx, y: headDy, opacity: 0, scale: 1.3 });
            }, null, 0.5);

            // Fade in heading at center
            tl.to(ntpLabel, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.6);
            tl.to(ntpHeading, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.65);
        },
        replay: () => {
            _ntpReplayBase();
            gsap.set(document.getElementById('ntpContainer'), { opacity: 1, scale: 1 });
            NTP_DATA.forEach(d => {
                document.getElementById(d.fill).style.width = '0%';
                document.getElementById(d.pct).textContent = '';
            });
            gsap.set(document.getElementById('ntpInsight'), { opacity: 0 });

            // Heading + label are still centered at this step (they move to
            // top-left only in buildNTPRevealBars). Reproduce the centering
            // offset measured by the forward timeline; sentence + bars hidden.
            const ntpLabel = document.getElementById('ntpLabel');
            const ntpHeading = document.getElementById('ntpHeading');
            gsap.set([ntpLabel, ntpHeading], { x: 0, y: 0, scale: 1 });
            const labelRect = ntpLabel.getBoundingClientRect();
            const headRect = ntpHeading.getBoundingClientRect();
            const vcx = window.innerWidth / 2;
            const vcy = window.innerHeight / 2;
            const labelDx = vcx - (labelRect.left + labelRect.width / 2);
            const labelDy = vcy - labelRect.top - labelRect.height - 30;
            const headDx = vcx - (headRect.left + headRect.width / 2);
            const headDy = vcy - (headRect.top + headRect.height / 2);
            gsap.set(ntpLabel, { x: labelDx, y: labelDy, opacity: 1 });
            gsap.set(ntpHeading, { x: headDx, y: headDy, opacity: 1, scale: 1.3 });
            gsap.set(document.querySelector('.ntp-sentence'), { opacity: 0 });
            gsap.set(document.querySelector('.ntp-bars'), { opacity: 0 });
        }
    };
}

// Temperature presets — same bars, different distributions
const TEMP_PRESETS = [
    { t: '0', desc: 'Deterministisch — immer #1', pcts: [100, 0, 0, 0, 0] },
    { t: '0.7', desc: 'Standard — balanciert', pcts: [34, 22, 18, 11, 7] },
    { t: '1.5', desc: 'Kreativ — riskanter', pcts: [22, 18, 17, 15, 12] },
    { t: '2.0', desc: 'Chaos — fast zufällig', pcts: [18, 16, 15, 14, 13] },
];

function _applyTempPreset(idx) {
    const p = TEMP_PRESETS[idx];
    document.getElementById('tempValue').textContent = p.t;
    document.getElementById('tempDesc').textContent = p.desc;
    p.pcts.forEach((pct, i) => {
        gsap.to(document.getElementById(NTP_DATA[i].fill), {
            width: (pct * NTP_DATA[0].width / TEMP_PRESETS[1].pcts[0]) + '%',
            duration: 0.6, ease: 'power2.out'
        });
        document.getElementById(NTP_DATA[i].pct).textContent = pct + '%';
    });
}

function _tempReplayBase(presetIdx) {
    _ntpReplayBase();
    gsap.set(document.getElementById('ntpContainer'), { opacity: 1, scale: 1 });
    gsap.set(document.getElementById('ntpInsight'), { opacity: 1 });
    gsap.set(document.getElementById('tempPanel'), { x: 0 });

    const p = TEMP_PRESETS[presetIdx];
    document.getElementById('tempValue').textContent = p.t;
    document.getElementById('tempDesc').textContent = p.desc;
    p.pcts.forEach((pct, i) => {
        document.getElementById(NTP_DATA[i].fill).style.width =
            (pct * NTP_DATA[0].width / TEMP_PRESETS[1].pcts[0]) + '%';
        document.getElementById(NTP_DATA[i].pct).textContent = pct + '%';
    });
}

// Map preset index to slider value: 0→0, 1→1, 2→2, 3→3
function _setSliderTo(idx) {
    const slider = document.getElementById('tempSlider');
    // GSAP can't tween a range input's value directly — use a proxy
    const obj = { v: parseFloat(slider.value) };
    gsap.to(obj, { v: idx, duration: 0.4, ease: 'power2.inOut',
        onUpdate: () => { slider.value = Math.round(obj.v); }
    });
}

// Step: Panel slides in, shows default T=0.7, slider at position 1
function buildShowTempPanel() {
    return {
        timeline: (tl) => {
            const panel = document.getElementById('tempPanel');
            tl.call(() => {
                document.getElementById('tempSlider').value = 1;
                document.getElementById('tempValue').textContent = '0.7';
                document.getElementById('tempDesc').textContent = 'Standard — balanciert';
            }, null, 0);
            tl.to(panel, { x: 0, duration: 0.5, ease: 'power2.out' }, 0);
        },
        replay: () => {
            _tempReplayBase(1);
            document.getElementById('tempSlider').value = 1;
        }
    };
}

// Step: T=0.7 → T=0 (deterministic)
function buildTempZero() {
    return {
        timeline: (tl) => {
            tl.call(() => {
                _applyTempPreset(0);
                _setSliderTo(0);
            }, null, 0);
        },
        replay: () => {
            _tempReplayBase(0);
            document.getElementById('tempSlider').value = 0;
        }
    };
}

// Step: Back to T=0.7 (default)
function buildTempDefault() {
    return {
        timeline: (tl) => {
            tl.call(() => {
                _applyTempPreset(1);
                _setSliderTo(1);
            }, null, 0);
        },
        replay: () => {
            _tempReplayBase(1);
            document.getElementById('tempSlider').value = 1;
        }
    };
}

// Step: T=0 → T=2.0 (chaos)
function buildTempChaos() {
    return {
        timeline: (tl) => {
            tl.call(() => {
                _applyTempPreset(3);
                _setSliderTo(3);
            }, null, 0);
        },
        replay: () => {
            _tempReplayBase(3);
            document.getElementById('tempSlider').value = 3;
        }
    };
}

function buildNTPRevealBars() {
    return {
        timeline: (tl) => {
            const ntpLabel = document.getElementById('ntpLabel');
            const ntpHeading = document.getElementById('ntpHeading');
            const ntpSentence = document.querySelector('.ntp-sentence');
            const ntpBars = document.querySelector('.ntp-bars');

            // Move heading back to natural top-left position (x:0, y:0) + shrink slightly
            tl.to(ntpLabel, { x: 0, y: 0, duration: 0.6, ease: 'power2.inOut' }, 0);
            tl.to(ntpHeading, { x: 0, y: 0, scale: 1, duration: 0.6, ease: 'power2.inOut' }, 0);

            // Sentence + bars fade in after heading settles
            tl.to(ntpSentence, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.4);
            tl.to(ntpBars, { opacity: 1, duration: 0.3 }, 0.5);

            // Bars grow
            NTP_DATA.forEach((d, i) => {
                tl.to(document.getElementById(d.fill), {
                    width: d.width + '%',
                    duration: 0.8, ease: 'power2.out'
                }, 0.6 + i * 0.1);
                tl.call(() => {
                    document.getElementById(d.pct).textContent = d.label;
                }, null, 0.9 + i * 0.1);
            });
        },
        replay: () => {
            _ntpReplayBase();
            gsap.set(document.getElementById('ntpContainer'), { opacity: 1, scale: 1 });
            gsap.set(document.getElementById('ntpLabel'), { x: 0, y: 0, opacity: 1 });
            gsap.set(document.getElementById('ntpHeading'), { x: 0, y: 0, opacity: 1, scale: 1 });
            gsap.set(document.querySelector('.ntp-sentence'), { opacity: 1 });
            gsap.set(document.querySelector('.ntp-bars'), { opacity: 1 });
            NTP_DATA.forEach(d => {
                document.getElementById(d.fill).style.width = d.width + '%';
                document.getElementById(d.pct).textContent = d.label;
            });
        }
    };
}

function buildShowNTPInsight() {
    return {
        timeline: (tl) => {
            tl.to(document.getElementById('ntpInsight'), {
                opacity: 1, duration: 0.6, ease: 'power2.out'
            }, 0);
        },
        replay: () => {
            buildNTPRevealBars().replay();
            gsap.set(document.getElementById('ntpInsight'), { opacity: 1 });
        }
    };
}

// ============================================================
// TEIL 2 — Hallucination Mechanism
// ============================================================

// Each step: token types in, bars show candidates for the NEXT token
const HALLUC_STEPS = [
    { prefix: '', token: 'Gemäß', bars: [
        { w: 'der', p: 67 }, { w: 'einer', p: 18 }, { w: 'dem', p: 10 }, { w: 'des', p: 5 }
    ]},
    { prefix: 'Gemäß ', token: 'der', bars: [
        { w: 'BGH-Entscheidung', p: 38 }, { w: 'Rechtsprechung', p: 22 }, { w: 'Bundesgerichtshof', p: 18 }, { w: 'Entscheidung', p: 12 }
    ]},
    { prefix: 'Gemäß der ', token: 'BGH-Entscheidung', bars: [
        { w: 'X', p: 41, hl: true }, { w: 'I', p: 26 }, { w: 'V', p: 15 }, { w: 'II', p: 10 }
    ]},
    { prefix: 'Gemäß der BGH-Entscheidung ', token: 'X', red: true, bars: [
        { w: 'ZR', p: 48, hl: true }, { w: 'ZB', p: 30 }, { w: 'ZA', p: 12 }, { w: 'R', p: 6 }
    ]},
    { prefix: 'Gemäß der BGH-Entscheidung <span class="tok-red">X</span> ', token: 'ZR', red: true, bars: [
        { w: '47/19', p: 4, hl: true }, { w: '23/18', p: 4 }, { w: '12/21', p: 3 }, { w: '118/17', p: 3 }
    ]},
    { prefix: 'Gemäß der BGH-Entscheidung <span class="tok-red">X ZR</span> ', token: '47/19', red: true, bars: [
        { w: 'vom', p: 52 }, { w: 'wurde', p: 21 }, { w: ',', p: 14 }, { w: 'hat', p: 8 }
    ]},
];

let _hallucStepIndex = -1;
let _hallucTypeInterval = null;

function _typeHallucToken(step) {
    const sentence = document.getElementById('hallucSentence');

    // Type new token char by char — red tokens get red class
    const tokenClass = step.red ? 'tok-red' : 'tok-new';
    sentence.innerHTML = step.prefix + '<span id="_hTyping" class="' + tokenClass + '"></span><span class="halluc-cursor"></span>';
    const tokEl = document.getElementById('_hTyping');
    let i = 0;
    if (_hallucTypeInterval) FX.clearInterval(_hallucTypeInterval);
    _hallucTypeInterval = FX.setInterval(() => {
        if (i < step.token.length) {
            tokEl.textContent = step.token.substring(0, ++i);
        } else {
            FX.clearInterval(_hallucTypeInterval);
            _hallucTypeInterval = null;
        }
    }, 40);

    // Update bars
    step.bars.forEach((bar, idx) => {
        document.getElementById('hbw' + idx).textContent = bar.w;
        document.getElementById('hbp' + idx).textContent = bar.p + '%';
        const fill = document.getElementById('hbf' + idx);
        fill.style.width = '0%';
        fill.className = 'halluc-bar-fill' + (bar.hl ? ' hl-fill' : '');
        gsap.to(fill, { width: (bar.p * 1.5) + '%', duration: 0.6, delay: 0.3 + idx * 0.08, ease: 'power2.out' });
    });

    // Clear unused bar rows
    for (let j = step.bars.length; j < 4; j++) {
        document.getElementById('hbw' + j).textContent = '';
        document.getElementById('hbp' + j).textContent = '';
        document.getElementById('hbf' + j).style.width = '0%';
    }
}

function _replayHallucTo(targetStep) {
    const sentence = document.getElementById('hallucSentence');

    if (targetStep < 0) {
        sentence.innerHTML = '<span class="halluc-cursor"></span>';
        for (let j = 0; j < 4; j++) {
            document.getElementById('hbw' + j).textContent = '';
            document.getElementById('hbp' + j).textContent = '';
            document.getElementById('hbf' + j).style.width = '0%';
        }
        return;
    }

    const step = HALLUC_STEPS[targetStep];
    const tokenClass = step.red ? 'tok-red' : 'tok-new';
    // Match the exact final DOM produced by _typeHallucToken (forward): the
    // freshly-typed token keeps id="_hTyping" until the next step replaces it.
    sentence.innerHTML = step.prefix + '<span id="_hTyping" class="' + tokenClass + '">' + step.token + '</span><span class="halluc-cursor"></span>';

    step.bars.forEach((bar, idx) => {
        document.getElementById('hbw' + idx).textContent = bar.w;
        document.getElementById('hbp' + idx).textContent = bar.p + '%';
        const fill = document.getElementById('hbf' + idx);
        fill.className = 'halluc-bar-fill' + (bar.hl ? ' hl-fill' : '');
        fill.style.width = (bar.p * 1.5) + '%';
    });
    for (let j = step.bars.length; j < 4; j++) {
        document.getElementById('hbw' + j).textContent = '';
        document.getElementById('hbp' + j).textContent = '';
        document.getElementById('hbf' + j).style.width = '0%';
    }
}

function buildHallucStep(stepIdx) {
    return {
        timeline: (tl) => {
            tl.call(() => {
                _hallucStepIndex = stepIdx;
                _typeHallucToken(HALLUC_STEPS[stepIdx]);
            }, null, 0);
        },
        replay: () => {
            _hallucStepIndex = stepIdx;
            _replayHallucTo(stepIdx);
        }
    };
}

// ============================================================
// STEP DEFINITIONS
// ============================================================

const STEPS = [
    // --- INTRO ---
    // 0: Title
    {
        page: 'pg-intro-title',
        enter: ['#pg-intro-title .overline', '#pg-intro-title .hero', '#pg-intro-title .subtitle'],
        stagger: 0.14
    },
    // 1: Title → Ziel heading
    {
        exit: ['#pg-intro-title .overline', '#pg-intro-title .hero', '#pg-intro-title .subtitle'],
        page: 'pg-ziel',
        enter: ['#zielHeading']
    },
    // 2–5: Teleprompter
    buildZielStep(1),
    buildZielStep(2),
    buildZielStep(3),
    buildZielStep(4),
    // 6: Ziel → Fahrplan
    {
        page: 'pg-fahrplan',
        timeline: (tl, engine) => {
            const visible = ZIEL_STACK.map(s => document.querySelector(s));
            tl.to(visible, {
                scale: 0.3, opacity: 0, duration: 0.4, stagger: 0.06, ease: 'power2.in'
            });
            tl.call(() => {
                document.getElementById('pg-ziel').classList.remove('active');
                const fp = document.getElementById('pg-fahrplan');
                fp.querySelectorAll('[data-anim]').forEach(el => {
                    gsap.set(el, { opacity: 0, y: FADE_IN_Y });
                });
                fp.classList.add('active');
                engine.currentPage = 'pg-fahrplan';
            });
            const enterEls = ['#pg-fahrplan .overline', '#pg-fahrplan .hero', '#pg-fahrplan .rm']
                .map(s => document.querySelector(s)).filter(Boolean);
            tl.set(enterEls, { opacity: 0, y: FADE_IN_Y });
            tl.to(enterEls, {
                opacity: 1, y: 0, duration: FADE_IN_DURATION, stagger: 0.12, ease: FADE_IN_EASE
            });
        },
        replay: () => {
            ['#pg-fahrplan .overline', '#pg-fahrplan .hero', '#pg-fahrplan .rm'].forEach(sel => {
                const el = document.querySelector(sel);
                if (el) gsap.set(el, { opacity: 1, y: 0 });
            });
        }
    },
    // 7: Fahrplan → Teil 1 (question appears on morph page)
    {
        exit: ['#pg-fahrplan .overline', '#pg-fahrplan .hero', '#pg-fahrplan .rm'],
        page: 'pg-morph',
        enter: ['#morphOverline', '#morphQuestion'],
        stagger: 0.15
    },

    // --- TEIL 1: MORPH FLOW ---
    // 8: Question → Typewriter
    buildTypewriter(),
    // 9: Typewriter → Tokenization (morph)
    buildTokenize(),

    // --- TEIL 1: NEURAL NET ---
    // 10: Tokens become IDs + slide left + neural net appears + stream
    buildTokensToNN(),

    // --- TEIL 1: ZOOM INTO NN ---
    // 11: NN rushes past → PosEnc (left) + Embed dimmed behind (right)
    buildZoomToPosEnc(),
    // 12: PosEnc rushes past → Embed (right) + Attention dimmed behind
    buildZoomToEmbed(),
    // 13: Embed rushes past → Attention lands
    buildZoomToAttention(),
    // 14: Arcs draw
    buildShowArcs(),
    // 15: Morph attention → stacked layers (same element)
    buildStackLayers(),
    // 16: Parameter panel slides in from right (attention stays visible)
    buildShowParamPanel(),
    // 17: Spin dials → arcs shift to new pattern
    buildSpinAndShiftArcs(),

    // --- TEIL 1: ZOOM OUT (one continuous animation, reverse of zoom in) ---
    // 18: Attention → Embed flies past → PosEnc flies past → NN dezooms + streaming
    buildZoomOutToNN(),

    // --- TEIL 1: AUTOREGRESSIVE LOOP ---
    // 19: Output wird Teil des Inputs — Buchanalogie ("für jedes neue Wort: ganzes Kapitel lesen")
    buildAutoregressiveLoop(),

    // --- TEIL 1: NTP ---
    // 20: NN dissolves → "Gib mir das wahrscheinlichste nächste Wort" appears centered
    buildShowNTPFromNN(),
    // 21: Heading morphs to top-left, sentence + bars appear
    buildNTPRevealBars(),
    // 22: Insight box — "Das Modell WEISS die Antwort nicht"
    buildShowNTPInsight(),
    // 23: Temperature panel slides in (T=0.7, default)
    buildShowTempPanel(),
    // 24: T=0 — deterministic, all on #1
    buildTempZero(),
    // 25: T=2.0 — chaos, nearly uniform
    buildTempChaos(),
    // 26: Back to T=0.7 — default
    buildTempDefault(),

    // --- TEIL 1: ZWISCHENFAZIT ---
    // 27: Transition to Fazit page — overline + heading
    {
        page: 'pg-fazit1',
        timeline: (tl, engine) => {
            // Fade out NTP + temp panel
            const ntpC = document.getElementById('ntpContainer');
            const tempP = document.getElementById('tempPanel');
            tl.to([ntpC, tempP], { opacity: 0, duration: 0.3 }, 0);

            // Switch page
            tl.call(() => {
                document.getElementById('pg-morph').classList.remove('active');
                const fp = document.getElementById('pg-fazit1');
                fp.querySelectorAll('[data-anim]').forEach(el => {
                    gsap.set(el, { opacity: 0, y: FADE_IN_Y });
                });
                fp.classList.add('active');
                engine.currentPage = 'pg-fazit1';
            }, null, 0.3);

            // Fade in overline + heading
            const enterEls = ['#pg-fazit1 .overline', '#pg-fazit1 .hero']
                .map(s => document.querySelector(s)).filter(Boolean);
            tl.set(enterEls, { opacity: 0, y: FADE_IN_Y });
            tl.to(enterEls, {
                opacity: 1, y: 0, duration: FADE_IN_DURATION, stagger: 0.12, ease: FADE_IN_EASE
            }, 0.4);
        },
        replay: () => {
            ['#pg-fazit1 .overline', '#pg-fazit1 .hero'].forEach(sel => {
                const el = document.querySelector(sel);
                if (el) gsap.set(el, { opacity: 1, y: 0 });
            });
        }
    },
    // 28: Checkmarks stagger in
    {
        timeline: (tl) => {
            const items = document.querySelectorAll('#pg-fazit1 .fazit-item');
            items.forEach((item, i) => {
                tl.to(item, {
                    opacity: 1, y: 0,
                    duration: FADE_IN_DURATION, ease: FADE_IN_EASE
                }, i * 0.2);
            });
        },
        replay: () => {
            document.querySelectorAll('#pg-fazit1 .fazit-item').forEach(el => {
                gsap.set(el, { opacity: 1, y: 0 });
            });
        }
    },

    // --- TEIL 2: GRENZEN & HALLUZINATIONEN ---
    // 29: Opener — "Was KI nicht kann"
    {
        exit: ['#pg-fazit1 .overline', '#pg-fazit1 .hero', '#pg-fazit1 .fazit-list'],
        page: 'pg-teil2-opener',
        enter: ['#pg-teil2-opener .hero', '#pg-teil2-opener .subtitle'],
        stagger: 0.15
    },
    // 30: Opener → Hallucination mechanism page
    {
        exit: ['#pg-teil2-opener .hero', '#pg-teil2-opener .subtitle'],
        page: 'pg-halluc',
        timeline: (tl, engine) => {
            // Exit opener
            const openerEls = ['#pg-teil2-opener .hero', '#pg-teil2-opener .subtitle']
                .map(s => document.querySelector(s)).filter(Boolean);
            tl.to(openerEls, { opacity: 0, y: FADE_OUT_Y, duration: FADE_OUT_DURATION, stagger: EXIT_STAGGER, ease: FADE_OUT_EASE });

            // Page switch
            tl.call(() => {
                document.getElementById('pg-teil2-opener').classList.remove('active');
                const pg = document.getElementById('pg-halluc');
                pg.querySelectorAll('[data-anim]').forEach(el => gsap.set(el, { opacity: 0, y: FADE_IN_Y }));
                pg.classList.add('active');
                engine.currentPage = 'pg-halluc';
            });

            // Enter elements
            const enterEls = ['#hallucLabel', '#hallucSublabel', '#hallucArea']
                .map(s => document.querySelector(s)).filter(Boolean);
            tl.set(enterEls, { opacity: 0, y: FADE_IN_Y });
            tl.to(enterEls, { opacity: 1, y: 0, duration: FADE_IN_DURATION, stagger: 0.12, ease: FADE_IN_EASE });

            // Bars fill in automatically after enter
            const initBars = [
                { w: 'Gemäß', p: 31 }, { w: 'Der', p: 24 }, { w: 'In', p: 18 }, { w: 'Es', p: 12 }
            ];
            tl.call(() => {
                initBars.forEach((bar, i) => {
                    document.getElementById('hbw' + i).textContent = bar.w;
                    document.getElementById('hbp' + i).textContent = bar.p + '%';
                    const fill = document.getElementById('hbf' + i);
                    fill.className = 'halluc-bar-fill';
                    gsap.to(fill, { width: (bar.p * 1.5) + '%', duration: 0.6, delay: i * 0.08, ease: 'power2.out' });
                });
            });
        },
        replay: () => {
            // Forward fades these in; replayInstant left them at opacity:0.
            ['#hallucLabel', '#hallucSublabel', '#hallucArea'].forEach(sel => {
                const el = document.querySelector(sel);
                if (el) gsap.set(el, { opacity: 1, y: 0 });
            });
            const initBars = [
                { w: 'Gemäß', p: 31 }, { w: 'Der', p: 24 }, { w: 'In', p: 18 }, { w: 'Es', p: 12 }
            ];
            initBars.forEach((bar, i) => {
                document.getElementById('hbw' + i).textContent = bar.w;
                document.getElementById('hbp' + i).textContent = bar.p + '%';
                const fill = document.getElementById('hbf' + i);
                fill.className = 'halluc-bar-fill';
                fill.style.width = (bar.p * 1.5) + '%';
            });
        }
    },
    // 31-36: Hallucination mechanism — click-stepped token generation
    buildHallucStep(0),
    buildHallucStep(1),
    buildHallucStep(2),
    buildHallucStep(3),
    buildHallucStep(4),
    buildHallucStep(5),

    // --- TEIL 2: SUMMARY ---
    // 37: Transition to summary — "Kein Wissen — nur Muster"
    {
        page: 'pg-teil2-summary',
        enter: ['#pg-teil2-summary .overline', '#pg-teil2-summary .hero'],
        stagger: 0.15
    },
    // 38: Three warning points stagger in
    {
        timeline: (tl) => {
            const items = document.querySelectorAll('#pg-teil2-summary .fazit-item');
            items.forEach((item, i) => {
                tl.to(item, {
                    opacity: 1, y: 0,
                    duration: FADE_IN_DURATION, ease: FADE_IN_EASE
                }, i * 0.25);
            });
        },
        replay: () => {
            document.querySelectorAll('#pg-teil2-summary .fazit-item').forEach(el => {
                gsap.set(el, { opacity: 1, y: 0 });
            });
        }
    },
    // 39: Rule #1
    {
        timeline: (tl) => {
            const rule = document.querySelector('#pg-teil2-summary .halluc-rule');
            tl.to(rule, { opacity: 1, y: 0, duration: FADE_IN_DURATION, ease: FADE_IN_EASE }, 0);
        },
        replay: () => {
            gsap.set(document.querySelector('#pg-teil2-summary .halluc-rule'), { opacity: 1, y: 0 });
        }
    },
];

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.engine = new Engine(STEPS);
    engine.onReset(() => {
        _stopParamLoop();
        _stopLoopForever();
        if (nnViz) { nnViz.destroy(); nnViz = null; }
        if (nnAmbientViz) { nnAmbientViz.stop(); nnAmbientViz = null; }
    });
});
