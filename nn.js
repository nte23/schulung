// Neural Network Visualization — DOM+SVG, layered with single-shot activation

class NeuralNetViz {
    constructor(container) {
        this.container = container;
        this.nodes = [];
        this.edges = [];
        this.layerGroups = [];
        this.svg = null;
        this.built = false;

        this.LAYERS = 10;
        this.BASE_NODES = 16;
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
            const x = W * 0.1 + (W * 0.8) * l / (this.LAYERS - 1);
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

    destroy() {
        this.nodes.forEach(n => n.el.remove());
        if (this.svg) this.svg.remove();
        this.nodes = [];
        this.edges = [];
        this.layerGroups = [];
        this.svg = null;
        this.built = false;
    }
}
