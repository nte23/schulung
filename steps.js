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
                wordsContainer.classList.add('typing-mode');
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
                gsap.set(el, { opacity: 1, y: 0 });
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
            wordsContainer.classList.remove('sentence');
            wordsContainer.classList.add('split');

            MORPH_WORDS.forEach((id, i) => {
                const el = document.getElementById(id);
                el.querySelector('.word-text').textContent = WORD_TEXTS[i];
                gsap.set(el, { opacity: 1, y: 0 });
                el.classList.add('tokenized');
            });

            document.querySelectorAll('#morphWords .token-id').forEach(el => {
                el.style.display = '';
                gsap.set(el, { opacity: 1 });
            });

            gsap.set(document.getElementById('morphBracketCompound'), { opacity: 1, y: 0 });
        }
    };
}

// ============================================================
// TEIL 1 — Neural Net helpers
// ============================================================

let nnViz = null;

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

            // Tokens already flew in — hide them
            MORPH_WORDS.forEach(id => {
                gsap.set(document.getElementById(id), { opacity: 0, scale: 0.4 });
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
    // 10: Tokens become IDs + slide left + neural net appears
    buildTokensToNN(),
];

// Boot
document.addEventListener('DOMContentLoaded', () => {
    new Engine(STEPS);
});
