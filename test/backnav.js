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
    // Two rAFs first: engine.busy is set in GSAP's onStart, which fires on the
    // next ticker tick — checking immediately would pass before the step begins.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForFunction(() => window.engine && !window.engine.busy, null, { timeout: 60000 });
    await page.waitForTimeout(2000); // detached tweens / delayedCalls / rAF chains
}

(async () => {
    const args = process.argv.slice(2);
    const getNum = (name, dflt) => {
        const i = args.indexOf(name);
        if (i < 0) return dflt;
        const n = parseInt(args[i + 1], 10);
        if (Number.isNaN(n)) {
            console.error(`${name} requires a numeric value`);
            process.exit(1);
        }
        return n;
    };
    const spam = args.includes('--spam');

    const server = spawn('python3', ['-m', 'http.server', String(PORT)],
        { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 800));

    // WSL without sudo: chromium's missing system libs live in a local extract
    const libDir = path.join(process.env.HOME || '', '.local/chromium-libs/usr/lib/x86_64-linux-gnu');
    const env = { ...process.env };
    if (require('fs').existsSync(libDir)) {
        env.LD_LIBRARY_PATH = `${libDir}:${path.join(libDir, 'nss')}:${env.LD_LIBRARY_PATH || ''}`;
    }
    const browser = await chromium.launch({ env });
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
