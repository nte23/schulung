// Ambient neural background — subtle pulsing network inside the dark view
class NNAmbient {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = [];
        this.frame = null;
        this.running = false;
    }

    start() {
        if (this.running) return;
        this.running = true;

        const c = this.canvas;
        const dpr = window.devicePixelRatio || 1;
        c.width = c.clientWidth * dpr;
        c.height = c.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.W = c.clientWidth;
        this.H = c.clientHeight;

        // Place nodes in edge/corner clusters — the "walls" of the NN we zoomed into
        this.nodes = [];
        const W = this.W, H = this.H;

        // 4 corner clusters + 4 edge strips
        const clusters = [
            { cx: 0,   cy: 0,   count: 18 },  // top-left
            { cx: W,   cy: 0,   count: 18 },  // top-right
            { cx: 0,   cy: H,   count: 18 },  // bottom-left
            { cx: W,   cy: H,   count: 18 },  // bottom-right
            { cx: W/2, cy: 0,   count: 10 },  // top-center
            { cx: W/2, cy: H,   count: 10 },  // bottom-center
            { cx: 0,   cy: H/2, count: 8 },   // left-center
            { cx: W,   cy: H/2, count: 8 },   // right-center
        ];

        clusters.forEach(cl => {
            for (let i = 0; i < cl.count; i++) {
                const spread = 180 + Math.random() * 120;
                this.nodes.push({
                    x: cl.cx + (Math.random() - 0.5) * spread,
                    y: cl.cy + (Math.random() - 0.5) * spread,
                    vx: (Math.random() - 0.5) * 0.08,
                    vy: (Math.random() - 0.5) * 0.08,
                    r: 1.5 + Math.random() * 1.5,
                    phase: Math.random() * Math.PI * 2
                });
            }
        });

        const self = this;
        function tick(ts) {
            if (!self.running) return;

            const ctx = self.ctx;
            ctx.clearRect(0, 0, W, H);
            const t = ts * 0.001;

            // Drift nodes slowly
            self.nodes.forEach(n => {
                n.x += n.vx;
                n.y += n.vy;
                // Soft bounce off edges (keep them near the walls)
                if (n.x < -60) n.vx = Math.abs(n.vx);
                if (n.x > W + 60) n.vx = -Math.abs(n.vx);
                if (n.y < -60) n.vy = Math.abs(n.vy);
                if (n.y > H + 60) n.vy = -Math.abs(n.vy);
            });

            // Draw connections — thicker, more like NN structure lines
            const maxDist = 120;
            for (let i = 0; i < self.nodes.length; i++) {
                for (let j = i + 1; j < self.nodes.length; j++) {
                    const a = self.nodes[i];
                    const b = self.nodes[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < maxDist) {
                        const base = (1 - dist / maxDist) * 0.09;
                        const pulse = Math.sin(t * 1.2 + a.phase + b.phase) * 0.5 + 0.5;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = `rgba(250, 187, 67, ${base + pulse * 0.04})`;
                        ctx.lineWidth = 0.6 + pulse * 0.4;
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            self.nodes.forEach(n => {
                const pulse = Math.sin(t * 1.5 + n.phase) * 0.5 + 0.5;
                const alpha = 0.1 + pulse * 0.15;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + pulse * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(250, 187, 67, ${alpha})`;
                ctx.fill();
            });

            self.frame = requestAnimationFrame(tick);
        }

        this.frame = requestAnimationFrame(tick);
    }

    stop() {
        this.running = false;
        if (this.frame) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.W || 0, this.H || 0);
        }
    }
}

// Neural Network Visualization — DOM+SVG, layered with single-shot activation

class NeuralNetViz {
    constructor(container) {
        this.container = container;
        this.nodes = [];
        this.edges = [];
        this.layerGroups = [];
        this.svg = null;
        this.built = false;

        this.LAYERS = 8;
        this.BASE_NODES = 14;
    }

    build() {
        if (this.built) return;
        this.built = true;

        const box = this.container;
        const W = box.clientWidth;
        const H = box.clientHeight;
        this.W = W;
        this.H = H;

        // SVG for edges
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
        this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        box.appendChild(this.svg);

        // Build nodes per layer — diamond shape
        for (let l = 0; l < this.LAYERS; l++) {
            const t = 1 - Math.abs(2 * l / (this.LAYERS - 1) - 1);
            const count = Math.round(5 + t * (this.BASE_NODES - 5));
            const x = W * 0.2 + (W * 0.6) * l / (this.LAYERS - 1);
            const group = [];

            for (let n = 0; n < count; n++) {
                const spacing = H * 0.62 / (count + 1);
                const y = H * 0.19 + (n + 1) * spacing;

                const dot = document.createElement('div');
                dot.className = 'nn-node';
                dot.style.left = x + 'px';
                dot.style.top = y + 'px';
                box.appendChild(dot);

                const idx = this.nodes.length;
                this.nodes.push({ el: dot, x, y, l, n, count });
                group.push(idx);
            }
            this.layerGroups.push(group);
        }

        // Build edges between adjacent layers
        for (let l = 0; l < this.LAYERS - 1; l++) {
            for (const i of this.layerGroups[l]) {
                for (const j of this.layerGroups[l + 1]) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', this.nodes[i].x);
                    line.setAttribute('y1', this.nodes[i].y);
                    line.setAttribute('x2', this.nodes[j].x);
                    line.setAttribute('y2', this.nodes[j].y);
                    line.setAttribute('stroke', 'rgba(0,0,0,0.10)');
                    line.setAttribute('stroke-width', '0.7');
                    this.svg.appendChild(line);
                    this.edges.push({ el: line, i, j });
                }
            }
        }
    }

    // Single-shot bolt: fires once through the network, no loop
    // Returns total duration in ms so caller can sync
    fireBolt() {
        const STEP_MS = 100;
        const FADE_MS = 400;
        const path = this._buildBoltPath();
        const totalDuration = (this.LAYERS * STEP_MS) + FADE_MS;

        // Light up layer by layer
        path.forEach((nodeIndices, layerIdx) => {
            const prevIndices = layerIdx > 0 ? path[layerIdx - 1] : [];
            const delay = layerIdx * STEP_MS;

            setTimeout(() => {
                nodeIndices.forEach(idx => {
                    const n = this.nodes[idx];
                    n.el.style.background = '#fabb43';
                    n.el.style.boxShadow = '0 0 10px rgba(250,187,67,0.5)';
                    n.el.style.transform = 'translate(-50%,-50%) scale(1.4)';

                    // Light edges from previous layer
                    prevIndices.forEach(prevIdx => {
                        this.edges.forEach(e => {
                            if ((e.i === prevIdx && e.j === idx) || (e.i === idx && e.j === prevIdx)) {
                                e.el.setAttribute('stroke', 'rgba(250,187,67,0.35)');
                                e.el.setAttribute('stroke-width', '1.8');
                            }
                        });
                    });
                });
            }, delay);

            // Fade this layer's nodes after a beat
            setTimeout(() => {
                nodeIndices.forEach(idx => {
                    const n = this.nodes[idx];
                    n.el.style.background = '';
                    n.el.style.boxShadow = '';
                    n.el.style.transform = '';
                });
                prevIndices.forEach(prevIdx => {
                    nodeIndices.forEach(idx => {
                        this.edges.forEach(e => {
                            if ((e.i === prevIdx && e.j === idx) || (e.i === idx && e.j === prevIdx)) {
                                e.el.setAttribute('stroke', 'rgba(0,0,0,0.10)');
                                e.el.setAttribute('stroke-width', '0.7');
                            }
                        });
                    });
                });
            }, delay + FADE_MS);
        });

        return totalDuration;
    }

    _buildBoltPath() {
        const path = [];
        const H = this.H;
        let lastY = H * 0.3 + Math.random() * H * 0.4;

        for (let l = 0; l < this.LAYERS; l++) {
            const layer = this.layerGroups[l];
            const count = 1 + Math.floor(Math.random() * 2.5);
            const sorted = [...layer].sort((a, b) =>
                Math.abs(this.nodes[a].y - lastY) - Math.abs(this.nodes[b].y - lastY)
            );
            const picked = sorted.slice(0, count);
            lastY = this.nodes[layer[Math.floor(Math.random() * layer.length)]].y;
            path.push(picked);
        }
        return path;
    }

    // Get x position of first layer (for syncing token fly-in)
    getInputX() {
        if (!this.layerGroups.length) return this.W * 0.1;
        const firstNode = this.nodes[this.layerGroups[0][0]];
        return firstNode.x;
    }

    // === CONTINUOUS STREAM ===
    // Endless loop: input tokens fly in from left, bolt fires, output words appear on right
    startStream(inputContainer, outputContainer, outputWords, startIndex) {
        this.stopStream();
        this._streamInputContainer = inputContainer;
        this._streamOutputContainer = outputContainer;
        this._streamWords = outputWords;
        this._streamWordIndex = startIndex || 0;
        this._streamInterval = null;

        outputContainer.innerHTML = '';

        const cycle = () => this._streamCycle();
        cycle();
        this._streamInterval = setInterval(cycle, 1400);
    }

    _streamCycle() {
        const inputContainer = this._streamInputContainer;
        const outputContainer = this._streamOutputContainer;

        // 1. Input: random token ID flies in from the left
        const tokenId = Math.floor(Math.random() * 60000) + 1000;
        const inEl = document.createElement('div');
        inEl.className = 'nn-stream-token';
        inEl.textContent = tokenId;
        inputContainer.appendChild(inEl);

        gsap.set(inEl, { opacity: 0, x: -10 });
        gsap.to(inEl, { opacity: 1, x: 0, duration: 0.2, ease: 'power2.out' });
        gsap.to(inEl, {
            x: '30vw', scale: 0.4, opacity: 0,
            duration: 0.8, delay: 0.25,
            ease: 'power2.in',
            onComplete: () => inEl.remove()
        });
        gsap.to(inEl, { color: '#fabb43', duration: 0.05, delay: 0.25 + 0.8 * 0.45 });

        // 2. Fire bolt synced with token arrival
        setTimeout(() => this.fireBolt(), 250 + 800 * 0.5);

        // 3. Output: word flies out to the right (mirrors input)
        const boltDone = 250 + 800 * 0.5 + this.LAYERS * 100;
        setTimeout(() => {
            const word = this._streamWords[this._streamWordIndex % this._streamWords.length];
            this._streamWordIndex++;

            const outEl = document.createElement('div');
            outEl.className = 'nn-stream-token';
            outEl.textContent = word;
            outputContainer.appendChild(outEl);

            // Start inside NN: yellow + faded
            gsap.set(outEl, { opacity: 0.3, color: '#fabb43', x: 0 });

            // Quickly fly out to the midpoint: full black + full opacity
            gsap.to(outEl, {
                x: '10vw', opacity: 1, color: '#1a1a1a',
                duration: 0.35, ease: 'power2.out'
            });

            // Continue flying out to the right: fade away
            gsap.to(outEl, {
                x: '22vw', opacity: 0,
                duration: 0.8, delay: 0.35,
                ease: 'power1.in',
                onComplete: () => outEl.remove()
            });
        }, boltDone);
    }

    stopStream() {
        if (this._streamInterval) {
            clearInterval(this._streamInterval);
            this._streamInterval = null;
        }
    }

    destroy() {
        this.stopStream();
        this.nodes.forEach(n => n.el.remove());
        if (this.svg) this.svg.remove();
        this.nodes = [];
        this.edges = [];
        this.layerGroups = [];
        this.svg = null;
        this.built = false;
    }
}
