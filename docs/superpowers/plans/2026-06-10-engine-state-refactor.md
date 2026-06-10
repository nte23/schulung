# Engine State Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make forward/backward navigation deterministic and presenter-smooth: identical DOM state whether a step is reached by clicking forward, jumping via URL hash, or going back — verified by an automated Playwright invariant test.

**Architecture:** Keep the existing `Engine` + `STEPS` + GSAP design. Replace the hand-enumerated reset in `goTo()` with pristine per-page innerHTML snapshots captured at boot. Route all timers/rAFs through a central `FX` registry killed on every navigation. Steps register cleanup via `engine.onReset(fn)` instead of engine.js hardcoding knowledge of steps.js globals. A Playwright script asserts the invariant `state(advance 0→k) === state(goTo k)` for every step; it is built FIRST so every later task is measured against it.

**Tech Stack:** Vanilla JS, GSAP (CDN), Playwright (dev-only, via npm), python3 http.server for serving during tests.

**Out of scope:** New slides (Teil 2 glitch reveal, Teil 3, Teil 4), visual redesign, converting hand-written `replay()` functions to derived replays (they stay, but are now test-verified).

---

## File Structure

| File | Role |
|---|---|
| `package.json` (create) | Dev deps (playwright), `test:backnav` script |
| `.gitignore` (create) | `node_modules/` |
| `test/backnav.js` (create) | The invariant test harness (plain node script, no test runner) |
| `engine.js` (modify) | FX registry, pristine snapshots, reset hooks, fast-forward input |
| `steps.js` (modify) | Expose `window.engine`, register reset hooks, FX-routed timers, bug fixes |
| `nn.js` (modify) | Tracked timeouts in `NeuralNetViz` (stream + bolt) |
| `CLAUDE.md` (modify) | Document new conventions |

Known concrete bugs fixed along the way:
1. `steps.js:71` — `wordsContainer` is referenced in `buildTypewriter`'s timeline but never declared in that closure → ReferenceError on every forward pass of step 8; `typing-mode` class never gets applied forward.
2. `nn.js` `_streamCycle` schedules raw `setTimeout`s that `stopStream()` does not clear → output words keep spawning after the stream is stopped (ghost elements during zoom-in).
3. `nn.js` `fireBolt` schedules raw `setTimeout`s → a bolt interrupted by navigation leaves nodes amber/scaled.
4. `steps.js:1846-1856` `_setSliderTo` — two competing tweens drive the same slider (first one is dead code per its own comment).
5. `steps.js:2266-2267` — duplicate `page: 'pg-halluc'` key in step 29's object literal.
6. `engine.js` `goTo()` reset enumeration has no entries for the Teil 2 hallucination page (`#hallucSentence` innerHTML, bar widths persist).

---

### Task 1: Playwright invariant harness (the test everything else is measured by)

**Files:**
- Create: `package.json`, `.gitignore`, `test/backnav.js`
- Modify: `steps.js:2360-2362` (boot — expose `window.engine`)

The invariant: for every step `k`, the DOM state after `advance()` k+1 times from a fresh load must equal the DOM state after a fresh load with `#k` in the URL (which routes through `goTo()`, the same path used by backward navigation). If these match for all k, then going back works for all k, by construction.

- [ ] **Step 1: npm setup**

```bash
cd /mnt/c/users/nerselius/python/schulung
npm init -y
npm install --save-dev playwright
npx playwright install chromium
```

Expected: `node_modules/` appears, chromium downloads. If `chromium.launch()` later fails with missing system libraries (common on fresh WSL), ask the user to run: `! sudo npx playwright install-deps chromium` — do not attempt sudo yourself.

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
```

- [ ] **Step 3: Add npm script to `package.json`**

In the generated `package.json`, set:

```json
"scripts": {
    "test:backnav": "node test/backnav.js"
}
```

- [ ] **Step 4: Expose the engine instance** — in `steps.js`, change the boot block:

```js
// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.engine = new Engine(STEPS);
});
```

- [ ] **Step 5: Write `test/backnav.js`**

```js
// Back-nav invariant: for every step k, DOM state reached by advancing 0→k
// must equal DOM state after a cold load of index.html#k (the goTo path,
// which is also what goBack() uses). Run: npm run test:backnav
// Flags: --from N --to M (step range), --spam (rapid-click forward pass,
// only meaningful after the fast-forward input task).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8123;
const URL = `http://localhost:${PORT}/index.html`;

// Subtrees that animate forever (streams, particles, flying ghosts) can never
// be frame-identical between two runs — they are skipped entirely (skipSubtree)
// or their container line is kept but children skipped (skipChildren).
const SNAP_OPTS = {
    skipSubtree: ['#nnAmbient', '.loop-flyer', '.halluc-cursor', '#loopPage', '#loopGenSlot'],
    skipChildren: ['#nnBox', '#nnStreamInput', '#nnStreamOutput', '#paramGrid',
                   '#attArcSvg', '.att-svg', '#loopArrow'],
};

// Serialized into the page. Returns a line-per-element textual state dump:
// effective visibility, normalized transform, leaf text.
function snapshotInPage(opts) {
    const lines = [];
    lines.push('BODY:' + document.body.className);
    lines.push('FLYERS:' + document.querySelectorAll('.loop-flyer').length);
    const active = document.querySelector('.page.active');
    if (!active) return lines.join('\n');
    lines.push('PAGE:' + active.id);

    const matches = (el, sels) => sels.some(s => el.matches(s));
    const fmtTransform = (t) => {
        if (!t || t === 'none') return 'none';
        const nums = t.match(/-?\d+\.?\d*(e-?\d+)?/g) || [];
        return nums.map(n => Math.round(parseFloat(n) * 10) / 10).join(',');
    };

    const walk = (el, pathKey, parentShown, parentOp) => {
        if (matches(el, opts.skipSubtree)) return;
        const cs = getComputedStyle(el);
        const op = parseFloat(cs.opacity) * parentOp;
        const shown = parentShown && cs.display !== 'none' && cs.visibility !== 'hidden';
        const vis = shown && op > 0.05;
        const cls = (typeof el.className === 'string' && el.className)
            ? '.' + el.className.trim().split(/\s+/).sort().join('.') : '';
        const key = pathKey + '>' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls;
        let line = key + '|v:' + (vis ? 1 : 0);
        if (vis) {
            line += '|tf:' + fmtTransform(cs.transform);
            if (el.children.length === 0) {
                line += '|t:' + (el.textContent || '').trim().slice(0, 60);
            }
        }
        lines.push(line);
        if (!matches(el, opts.skipChildren)) {
            for (const c of el.children) walk(c, key, shown, op);
        }
    };
    walk(active, '', true, 1);
    return lines.join('\n');
}

async function settle(page) {
    await page.waitForFunction(() => window.engine && !window.engine.busy, null, { timeout: 60000 });
    await page.waitForTimeout(2000); // detached tweens / delayedCalls / rAF chains
}

(async () => {
    const args = process.argv.slice(2);
    const getNum = (name, dflt) => {
        const i = args.indexOf(name);
        return i >= 0 ? parseInt(args[i + 1], 10) : dflt;
    };
    const spam = args.includes('--spam');

    const server = spawn('python3', ['-m', 'http.server', String(PORT)],
        { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 800));

    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

    try {
        // ── Pass 1: forward walk ──────────────────────────────────
        const fwd = await ctx.newPage();
        await fwd.goto(URL);
        await fwd.waitForFunction(() => window.engine);
        const total = await fwd.evaluate(() => window.engine.steps.length);
        const from = getNum('--from', 0);
        const to = Math.min(getNum('--to', total - 1), total - 1);

        const forwardSnaps = {};
        for (let k = 0; k <= to; k++) {
            if (spam) {
                // rapid clicks: first click fast-forwards, next advances
                while ((await fwd.evaluate(() => window.engine.currentStep)) < k) {
                    await fwd.evaluate(() => window.engine.advance());
                    await fwd.waitForTimeout(200);
                }
            } else {
                await fwd.evaluate(() => window.engine.advance());
            }
            await settle(fwd);
            if (k >= from) forwardSnaps[k] = await fwd.evaluate(snapshotInPage, SNAP_OPTS);
            process.stdout.write(`\rforward ${k}/${to} `);
        }
        await fwd.close();
        console.log();

        // ── Pass 2: cold goTo via hash, diff against forward ──────
        let failures = 0;
        for (let k = from; k <= to; k++) {
            const p = await ctx.newPage();
            await p.goto(`${URL}#${k}`);
            await p.waitForFunction(() => window.engine);
            await settle(p);
            const snap = await p.evaluate(snapshotInPage, SNAP_OPTS);
            await p.close();

            const a = forwardSnaps[k].split('\n');
            const b = snap.split('\n');
            const diffs = [];
            for (let i = 0; i < Math.max(a.length, b.length) && diffs.length < 6; i++) {
                if (a[i] !== b[i]) diffs.push(`    fwd: ${a[i] || '(missing)'}\n    jmp: ${b[i] || '(missing)'}`);
            }
            if (diffs.length) {
                failures++;
                console.log(`STEP ${k}: FAIL\n${diffs.join('\n')}`);
            } else {
                console.log(`STEP ${k}: PASS`);
            }
        }
        console.log(failures ? `\n${failures} step(s) FAILED` : '\nAll steps PASS');
        process.exitCode = failures ? 1 : 0;
    } finally {
        await browser.close();
        server.kill();
    }
})();
```

- [ ] **Step 6: Run the harness, capture the failing baseline**

```bash
npm run test:backnav 2>&1 | tee test/baseline.txt
```

Expected: many `STEP k: FAIL` lines and exit code 1. **This is the red state — that is correct.** The full run takes several minutes (each step waits for its animation in real time). If chromium fails to launch with a missing-libraries error, see Task 1 Step 1 fallback.

Sanity-check the harness itself: steps 0–6 (intro pages, simple declarative steps) should mostly PASS. If literally everything fails including step 0, the harness has a bug (likely the settle wait or snapshot serialization) — fix that before proceeding.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore test/backnav.js test/baseline.txt steps.js
git commit -m "test: back-nav invariant harness with failing baseline"
```

---

### Task 2: FX timer registry + pristine DOM restore in goTo()

**Files:**
- Modify: `engine.js` (add FX after constants at top; rewrite `goTo()` lines 71–209; add `onReset`; capture snapshots in constructor)
- Modify: `steps.js` boot block (register reset hooks)

- [ ] **Step 1: Add the FX registry to `engine.js`** directly below the animation constants (after line 8):

```js
// Central registry for timers/rAFs started by steps and visualizations.
// Everything registered here is killed on every goTo() — in-flight typewriters,
// loops, and scheduled callbacks can never leak into another step.
const FX = {
    _timeouts: new Set(),
    _intervals: new Set(),
    _rafs: new Set(),
    setTimeout(fn, ms) {
        const id = window.setTimeout(() => { FX._timeouts.delete(id); fn(); }, ms);
        FX._timeouts.add(id);
        return id;
    },
    clearTimeout(id) { window.clearTimeout(id); FX._timeouts.delete(id); },
    setInterval(fn, ms) {
        const id = window.setInterval(fn, ms);
        FX._intervals.add(id);
        return id;
    },
    clearInterval(id) { window.clearInterval(id); FX._intervals.delete(id); },
    raf(fn) {
        const id = window.requestAnimationFrame((ts) => { FX._rafs.delete(id); fn(ts); });
        FX._rafs.add(id);
        return id;
    },
    killAll() {
        FX._timeouts.forEach(id => window.clearTimeout(id));
        FX._intervals.forEach(id => window.clearInterval(id));
        FX._rafs.forEach(id => window.cancelAnimationFrame(id));
        FX._timeouts.clear(); FX._intervals.clear(); FX._rafs.clear();
    }
};
```

- [ ] **Step 2: Capture pristine snapshots + hook list in the constructor.** Replace the `pageDefaults` block (engine.js:19-22) with:

```js
        this.pageDefaults = {};
        this.pageHTML = {};
        document.querySelectorAll('.page').forEach(p => {
            this.pageDefaults[p.id] = p.className;
            this.pageHTML[p.id] = p.innerHTML;
        });
        this.resetHooks = [];
```

- [ ] **Step 3: Add the `onReset` method** (anywhere in the class, e.g. after `goBack`):

```js
    // Steps register cleanup here (stop loops, null viz instances).
    // Hooks run on every goTo() before the DOM is restored.
    onReset(fn) {
        this.resetHooks.push(fn);
    }
```

- [ ] **Step 4: Replace the entire `goTo()` body** (engine.js:71-209) with:

```js
    goTo(target) {
        if (target === this.currentStep && !this.busy) return;
        if (target < -1 || target >= this.steps.length) return;

        if (this.activeTl) {
            this.activeTl.kill();
            this.activeTl = null;
        }
        this.busy = false;

        // Kill every running tween, delayedCall, and registered timer/rAF
        gsap.globalTimeline.clear();
        FX.killAll();

        // Step-registered cleanup (stop loops, destroy viz instances)
        this.resetHooks.forEach(fn => fn());

        // Restore every page to its pristine boot-time DOM. This cannot
        // miss anything — no per-feature reset enumeration needed.
        document.querySelectorAll('.page').forEach(p => {
            p.className = this.pageDefaults[p.id];
            p.innerHTML = this.pageHTML[p.id];
        });
        document.body.classList.remove('nn-dark');
        document.querySelectorAll('.loop-flyer').forEach(g => g.remove());

        this.currentPage = null;
        for (let i = 0; i <= target; i++) {
            this.replayInstant(i);
        }
        this.currentStep = target;
        this.updateUI();
    }
```

Note what was deleted: the 110-line enumeration AND the `typeof nnAmbientViz` / `_stopParamLoop` / `_stopLoopForever` checks — those move to reset hooks in steps.js (next step). `replayInstant`, `executeStep`, `buildTimeline`, `addPageTransition` stay untouched.

- [ ] **Step 5: Register reset hooks in `steps.js` boot block:**

```js
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
```

Nulling both viz instances is mandatory: pristine restore replaces `#nnBox` and the `#nnAmbient` canvas with fresh nodes, so the old instances hold detached-element references. `ensureNN()` / `ensureAmbient()` lazily rebuild against the fresh DOM during replay.

- [ ] **Step 6: Smoke-test by hand before the full run.** Serve and click through in a real browser:

```bash
python3 -m http.server 8124
```

Open `http://localhost:8124/index.html`, then: jump to `#10` (NN should build + stream), press ArrowLeft twice (tokenization state, no NN remnants), jump to `#33` (halluc page mid-generation), ArrowLeft (previous halluc token state, sentence text correct), `#17` (param dials spinning), ArrowLeft (panel visible, dials static). Check the console for errors on every jump.

- [ ] **Step 7: Run the harness, compare to baseline**

```bash
npm run test:backnav 2>&1 | tee test/after-task2.txt
```

Expected: failure count drops substantially vs `test/baseline.txt` (ghost/persistence failures die). Remaining failures are replay-drift and timer-bleed — Tasks 3 and 4. If a step that PASSED in baseline now FAILS, that is a regression introduced by the restore — investigate before continuing (likely a replay that depended on leftover state from the old enumerated reset).

- [ ] **Step 8: Commit**

```bash
git add engine.js steps.js test/after-task2.txt
git commit -m "refactor: pristine DOM restore + reset hooks + FX registry in engine"
```

---

### Task 3: Route all timers through FX / tracked handles

**Files:**
- Modify: `nn.js` (NeuralNetViz: tracked timeouts in `fireBolt`, `_streamCycle`, `stopStream`)
- Modify: `steps.js` (param loop, forever loop, halluc typewriter, rAF chains)

- [ ] **Step 1: `nn.js` — add a tracked-timeout helper to `NeuralNetViz`.** In the constructor add `this._timeouts = new Set();`, then add the method:

```js
    _setTimeout(fn, ms) {
        const id = setTimeout(() => { this._timeouts.delete(id); fn(); }, ms);
        this._timeouts.add(id);
        return id;
    }
```

- [ ] **Step 2: `nn.js` — use it everywhere.** In `fireBolt` replace both `setTimeout(...)` calls with `this._setTimeout(...)`. In `_streamCycle` replace both `setTimeout(...)` calls with `this._setTimeout(...)`.

- [ ] **Step 3: `nn.js` — make `stopStream` actually stop everything and clean bolt residue:**

```js
    stopStream() {
        if (this._streamInterval) {
            clearInterval(this._streamInterval);
            this._streamInterval = null;
        }
        this._timeouts.forEach(id => clearTimeout(id));
        this._timeouts.clear();
        // A bolt interrupted mid-flight leaves nodes highlighted — clear it
        this.nodes.forEach(n => {
            n.el.style.background = '';
            n.el.style.boxShadow = '';
            n.el.style.transform = '';
        });
    }
```

(`destroy()` already calls `stopStream()`, so it inherits the cleanup.)

- [ ] **Step 4: `steps.js` — param loop via FX.** In `buildSpinAndShiftArcs` (both the timeline at ~line 1016 and the replay at ~line 1033) replace `setInterval(_runParamCycle, 3000)` with `FX.setInterval(_runParamCycle, 3000)`. In `_stopParamLoop` replace `clearInterval(_paramLoopInterval)` with `FX.clearInterval(_paramLoopInterval)`.

- [ ] **Step 5: `steps.js` — forever loop via FX.** In `_runForeverCycle` and `_startLoopForever`, every `setTimeout(...)` that gets pushed into `state.timeouts` becomes `FX.setTimeout(...)` (the `state.timeouts.push(FX.setTimeout(...))` double-tracking is fine — `_stopLoopForever`'s targeted `clearTimeout` still works, and `FX.killAll()` catches anything left). The inner typewriter `tick`'s `setTimeout(tick, perChar)` also becomes `FX.setTimeout(tick, perChar)`.

- [ ] **Step 6: `steps.js` — halluc typewriter interval.** In `_typeHallucToken` (~line 2017), track and pre-clear the interval:

```js
let _hallucTypeInterval = null;

function _typeHallucToken(step) {
    if (_hallucTypeInterval) FX.clearInterval(_hallucTypeInterval);
    const sentence = document.getElementById('hallucSentence');
    const tokenClass = step.red ? 'tok-red' : 'tok-new';
    sentence.innerHTML = step.prefix + '<span id="_hTyping" class="' + tokenClass + '"></span><span class="halluc-cursor"></span>';
    const tokEl = document.getElementById('_hTyping');
    let i = 0;
    _hallucTypeInterval = FX.setInterval(() => {
        if (i < step.token.length) {
            tokEl.textContent = step.token.substring(0, ++i);
        } else {
            FX.clearInterval(_hallucTypeInterval);
            _hallucTypeInterval = null;
        }
    }, 40);
    // ... bar update code unchanged ...
}
```

- [ ] **Step 7: `steps.js` — rAF chains via FX.** Replace every `requestAnimationFrame(` with `FX.raf(` at these sites: `_buildAndDrawStack` (~691), `buildStackLayers` timeline (~788, nested pair) and replay (~826, nested pair), `_redrawAllArcsAfterLayout` (~867, nested pair), `buildSpinAndShiftArcs` replay (~1031, nested pair), `_replayStackState` (~1059, nested pair), `buildAutoregressiveLoop` replay (~1690). This stops a stale rAF from a rapid double-`goTo` drawing arcs into freshly restored DOM.

```bash
grep -n 'requestAnimationFrame' steps.js
```

Expected after the edit: zero hits (all `FX.raf`).

- [ ] **Step 8: Run the harness**

```bash
npm run test:backnav 2>&1 | tee test/after-task3.txt
```

Expected: further failure reduction; specifically no more ghost stream-tokens or stuck-amber NN nodes in any diff.

- [ ] **Step 9: Commit**

```bash
git add nn.js steps.js test/after-task3.txt
git commit -m "refactor: all timers and rAFs tracked, killed on navigation"
```

---

### Task 4: Fix remaining drift — known bugs first, then harness-guided loop

**Files:**
- Modify: `steps.js` (bug fixes; individual `replay()` repairs as found)

- [ ] **Step 1: Fix the `wordsContainer` ReferenceError** in `buildTypewriter`'s timeline (steps.js:71). Replace:

```js
                wordsContainer.classList.add('typing-mode');
```

with:

```js
                document.getElementById('morphWords').classList.add('typing-mode');
```

- [ ] **Step 2: Fix `_setSliderTo` double tween** (steps.js:1846-1856). Delete the first `gsap.to(slider, ...)` call; keep only the proxy version:

```js
function _setSliderTo(idx) {
    const slider = document.getElementById('tempSlider');
    // GSAP can't tween a range input's value directly — use a proxy
    const obj = { v: parseFloat(slider.value) };
    gsap.to(obj, { v: idx, duration: 0.4, ease: 'power2.inOut',
        onUpdate: () => { slider.value = Math.round(obj.v); }
    });
}
```

- [ ] **Step 3: Remove the duplicate `page: 'pg-halluc'` key** in step 29's object (steps.js:2266-2267) — keep one.

- [ ] **Step 4: Renumber the step comments in the STEPS array.** The NTP section currently has two `// 20:` comments; everything after drifts by one. Walk the array top to bottom and make each comment match the real index (0-based, matching URL hashes). End state: last step (`halluc-rule`) is `// 38`.

- [ ] **Step 5: Harness-guided fix loop.** Run the full harness:

```bash
npm run test:backnav
```

For each remaining `STEP k: FAIL`, the diff names the exact element and property that differs between forward and jump state. Procedure per failure:

1. Decide which side is *correct* (usually forward — that's the authored animation).
2. If the jump side is wrong → fix that step's `replay()` (or an upstream step's `replay()` that the chain runs through).
3. If the forward side is wrong (leftover from previous step) → the previous step's timeline isn't cleaning up; fix the timeline.
4. Re-run just that step: `node test/backnav.js --from k --to k`
5. If a difference is genuinely benign (e.g. a continuously animating element not yet excluded), add the selector to `SNAP_OPTS` in `test/backnav.js` with a comment saying why — never to silence a real mismatch.

Repeat until:

```bash
npm run test:backnav
```

Expected: `All steps PASS`, exit code 0.

- [ ] **Step 6: Commit (batch commits during the loop are fine; final state):**

```bash
git add steps.js test/backnav.js
git commit -m "fix: replay drift across all steps - back-nav invariant green"
```

---

### Task 5: Presenter-grade input — click during animation fast-forwards

**Files:**
- Modify: `engine.js` (`advance()`, `goBack()`)
- Test: `test/backnav.js --spam` (already implemented in Task 1)

Current behavior: clicks during an animation are silently eaten (`busy` guard), so the presenter double-clicks and the deck later jumps two steps. New behavior: a click during an animation instantly completes it (jump timeline to end state, callbacks fired); the next click advances. ArrowLeft during an animation completes it, then goes back.

- [ ] **Step 1: Replace `advance()` and `goBack()`** (engine.js:60-69):

```js
    advance() {
        if (this.busy && this.activeTl) {
            // Click during an animation: complete it instantly.
            // progress(1, false) fires the remaining callbacks in order,
            // which also fires onComplete → busy=false.
            this.activeTl.progress(1, false);
            return;
        }
        if (this.currentStep >= this.steps.length - 1) return;
        this.currentStep++;
        this.executeStep(this.currentStep);
    }

    goBack() {
        if (this.currentStep <= 0) return;
        if (this.busy && this.activeTl) {
            this.activeTl.progress(1, false);
        }
        this.goTo(this.currentStep - 1);
    }
```

(`goTo` already tolerates being called while busy after Task 2 — it kills the active timeline and clears `busy` itself.)

- [ ] **Step 2: Verify zero-duration edge.** Several custom timelines contain only a `tl.call(...)` at t=0 (e.g. `buildSpinAndShiftArcs`) — they complete within a tick, so `busy` is already false when a human clicks. No special handling needed; just confirm no step's timeline contains an infinitely repeating child tween (which would make `progress(1)` meaningless):

```bash
grep -n 'repeat: *-1' steps.js engine.js
```

Expected: no hits inside any `timeline:` builder (loops are interval-driven, which fast-forward leaves running — correct, they're ambient).

- [ ] **Step 3: Run the spam-mode harness** (rapid 200ms clicks, fast-forward + advance interleaved):

```bash
node test/backnav.js --spam 2>&1 | tee test/after-task5-spam.txt
```

Expected: `All steps PASS`. Failures here mean a timeline's `tl.call` chain doesn't tolerate instant completion (e.g. a `gsap.delayedCall` scheduled from a callback that the snapshot catches mid-flight) — fix by moving that work onto the timeline or extending settle logic, NOT by reverting fast-forward.

- [ ] **Step 4: Manual rehearsal check.** Serve, click rapidly through the entire deck like an impatient presenter, including mid-typewriter and mid-zoom clicks. Every click must do something visible (complete or advance), never nothing.

- [ ] **Step 5: Run the normal harness once more** (`npm run test:backnav`) to confirm no regression, then commit:

```bash
git add engine.js test/after-task5-spam.txt
git commit -m "feat: click during animation fast-forwards to end state"
```

---

### Task 6: Documentation + push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`** — in the Architecture section, replace the `engine.js` bullet's reset description and add the new conventions. Add under Key Conventions:

```markdown
- **State reset**: `goTo()` restores every page from pristine boot-time innerHTML
  snapshots — never add manual reset code to the engine. Step-specific cleanup
  (stopping loops, nulling viz instances) registers via `engine.onReset(fn)` in
  the steps.js boot block.
- **Timers**: never call raw `setInterval`/`setTimeout`/`requestAnimationFrame`
  in steps.js — use `FX.setInterval`/`FX.setTimeout`/`FX.raf` (engine.js) so
  navigation kills them. Inside `NeuralNetViz`, use `this._setTimeout`.
- **Every custom step still needs `replay()`** — and `npm run test:backnav`
  verifies forward state === jump state for every step. Run it after adding
  or changing any step. `--from N --to M` scopes the run; `--spam` tests
  rapid clicking.
- **Input**: clicking during an animation fast-forwards it (progress(1));
  design timelines so their end state is valid at any moment.
```

- [ ] **Step 2: Final full verification**

```bash
npm run test:backnav && node test/backnav.js --spam
```

Expected: both runs print `All steps PASS`, exit code 0.

- [ ] **Step 3: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: state-management conventions after engine refactor"
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** pristine snapshots (Task 2), engine-owned timers (Tasks 2+3), back-nav test (Task 1), presenter input (Task 5), known bugs (Task 4 steps 1–4 + nn.js fixes in Task 3). "Derived replays" from the original sketch was deliberately descoped: hand-written replays + the invariant test achieve the same correctness guarantee with far less risk to 27 working-ish animations; revisit only if Teil 3/4 step-writing proves painful.
- **Order matters:** Task 1 must land first — every later task is measured by it. Task 2 before 3: FX is defined in Task 2's engine edit but first consumed in Task 3 (steps.js edits); the only Task-2 FX caller is `goTo` itself, which is safe with empty registries.
- **Risk register:** (a) Playwright system deps on WSL — fallback documented in Task 1. (b) `gsap.globalTimeline.clear()` also kills tweens started by the streaming/ambient loops mid-frame — intended. (c) innerHTML restore discards element listeners — the only one assigned dynamically was `tempSlider.oninput` cleanup in the OLD goTo, which is deleted in the same task; nothing else attaches listeners inside pages (verified by grep). (d) Full harness run is slow (~5 min) — use `--from/--to` during the Task 4 loop.
