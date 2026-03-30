// Animation constants (shared with steps.js)
const FADE_IN_DURATION = 0.65;
const FADE_OUT_DURATION = 0.3;
const DEFAULT_STAGGER = 0.1;
const FADE_IN_EASE = 'power2.out';
const FADE_OUT_EASE = 'power2.in';
const FADE_IN_Y = 25;
const FADE_OUT_Y = -20;
const EXIT_STAGGER = 0.04;

class Engine {
    constructor(steps) {
        this.steps = steps;
        this.currentStep = -1;
        this.currentPage = null;
        this.activeTl = null;
        this.busy = false;

        this.pageDefaults = {};
        document.querySelectorAll('.page').forEach(p => {
            this.pageDefaults[p.id] = p.className;
        });

        this.init();
    }

    init() {
        this.progressBar = document.getElementById('progressBar');
        this.stepInfo = document.getElementById('stepInfo');
        this.btnBack = document.getElementById('btnBack');
        this.btnNext = document.getElementById('btnNext');

        document.addEventListener('click', (e) => {
            if (e.target.closest('.dev-nav')) return;
            this.advance();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.advance();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.goBack();
            }
        });

        this.btnBack.addEventListener('click', () => this.goBack());
        this.btnNext.addEventListener('click', () => this.advance());

        // Jump to step via URL hash, e.g. index.html#8
        const hash = parseInt(location.hash.slice(1), 10);
        if (hash >= 0 && hash < this.steps.length) {
            this.goTo(hash);
        }

        this.updateUI();
    }

    advance() {
        if (this.busy || this.currentStep >= this.steps.length - 1) return;
        this.currentStep++;
        this.executeStep(this.currentStep);
    }

    goBack() {
        if (this.busy || this.currentStep <= 0) return;
        this.goTo(this.currentStep - 1);
    }

    goTo(target) {
        if (this.busy || target === this.currentStep) return;
        if (target < -1 || target >= this.steps.length) return;

        if (this.activeTl) {
            this.activeTl.kill();
            this.activeTl = null;
        }

        document.querySelectorAll('.page').forEach(p => {
            p.className = this.pageDefaults[p.id];
            gsap.killTweensOf(p.querySelectorAll('*'));
            p.querySelectorAll('[data-anim]').forEach(el => {
                el.style.cssText = '';
                el.classList.remove('tokenized');
                gsap.set(el, { clearProps: 'all' });
            });
            // Reset morph-words container
            const mw = p.querySelector('.morph-words');
            if (mw) {
                mw.classList.add('sentence'); mw.classList.remove('split', 'typing-mode', 'nn-input');
                mw.querySelectorAll('.token-id').forEach(el => { el.style.display = ''; el.style.color = ''; });
                mw.querySelectorAll('.word-text').forEach(el => { el.style.display = ''; });
                mw.querySelectorAll('.typing').forEach(el => el.classList.remove('typing'));
            }
            // Reset neural net
            const nnBox = p.querySelector('#nnBox');
            if (nnBox) {
                gsap.set(nnBox, { opacity: 0 });
                if (typeof nnViz !== 'undefined' && nnViz) {
                    nnViz.destroy();
                    nnViz = null;
                }
            }
            // Reset compound-word transforms
            const cw = p.querySelector('.compound-word');
            if (cw) gsap.set(cw, { clearProps: 'all' });
            // Reset NN label text to original
            const nnLabel = p.querySelector('#morphLabelNN');
            if (nnLabel) nnLabel.innerHTML = 'Schritt 2: <span class="hl">Neuronales Netz</span>';
            const nnSublabel = p.querySelector('#morphSublabelNN');
            if (nnSublabel) nnSublabel.textContent = 'Tokens fließen durch das Netz';
        });
        this.currentPage = null;

        for (let i = 0; i <= target; i++) {
            this.replayInstant(i);
        }
        this.currentStep = target;
        this.updateUI();
    }

    executeStep(index) {
        if (this.activeTl) {
            this.activeTl.kill();
            this.activeTl = null;
        }

        const desc = this.steps[index];
        const tl = gsap.timeline({
            onStart: () => { this.busy = true; },
            onComplete: () => { this.busy = false; this.activeTl = null; }
        });

        if (desc.timeline) {
            desc.timeline(tl, this);
        } else {
            this.buildTimeline(desc, tl);
        }

        this.activeTl = tl;
        this.updateUI();
    }

    buildTimeline(desc, tl) {
        const stagger = desc.stagger || DEFAULT_STAGGER;

        if (desc.exit) {
            const exitEls = this.queryAll(desc.exit);
            if (exitEls.length) {
                tl.to(exitEls, {
                    opacity: 0,
                    y: FADE_OUT_Y,
                    duration: FADE_OUT_DURATION,
                    stagger: EXIT_STAGGER,
                    ease: FADE_OUT_EASE
                });
            }
        }

        if (desc.page && desc.page !== this.currentPage) {
            this.addPageTransition(this.currentPage, desc.page, tl);
        }

        if (desc.enter) {
            const enterEls = this.queryAll(desc.enter);
            if (enterEls.length) {
                tl.set(enterEls, { opacity: 0, y: FADE_IN_Y });
                tl.to(enterEls, {
                    opacity: 1,
                    y: 0,
                    duration: FADE_IN_DURATION,
                    stagger: stagger,
                    ease: FADE_IN_EASE
                });
            }
        }
    }

    addPageTransition(fromId, toId, tl) {
        const self = this;
        tl.call(() => {
            if (fromId) {
                const fromEl = document.getElementById(fromId);
                if (fromEl) {
                    gsap.killTweensOf(fromEl.querySelectorAll('*'));
                    fromEl.classList.remove('active');
                }
            }
            const toEl = document.getElementById(toId);
            if (toEl) {
                const anims = toEl.querySelectorAll('[data-anim]');
                gsap.set(anims, { opacity: 0, y: FADE_IN_Y });
                toEl.classList.add('active');
            }
            self.currentPage = toId;
        });
    }

    replayInstant(index) {
        const desc = this.steps[index];

        if (desc.page && desc.page !== this.currentPage) {
            if (this.currentPage) {
                const fromEl = document.getElementById(this.currentPage);
                if (fromEl) fromEl.classList.remove('active');
            }
            const toEl = document.getElementById(desc.page);
            if (toEl) {
                toEl.querySelectorAll('[data-anim]').forEach(el => {
                    gsap.set(el, { opacity: 0, y: 0 });
                });
                toEl.classList.add('active');
            }
            this.currentPage = desc.page;
        }

        if (desc.replay) {
            desc.replay();
            return;
        }

        if (desc.exit) {
            this.queryAll(desc.exit).forEach(el => gsap.set(el, { opacity: 0 }));
        }
        if (desc.enter) {
            this.queryAll(desc.enter).forEach(el => gsap.set(el, { opacity: 1, y: 0 }));
        }
    }

    queryAll(selectors) {
        const els = [];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) els.push(el);
        }
        return els;
    }

    updateUI() {
        const total = this.steps.length;
        const current = this.currentStep + 1;
        const progress = current > 0 ? (current / total) * 100 : 0;
        this.progressBar.style.width = progress + '%';
        this.stepInfo.textContent = current > 0 ? current + '/' + total : '';
        this.btnBack.disabled = this.currentStep <= 0;
        this.btnNext.disabled = this.currentStep >= this.steps.length - 1;
    }
}
