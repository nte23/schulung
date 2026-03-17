// KI Workshop Presentation Controller
class Presentation {
    constructor() {
        this.slides = document.querySelectorAll('.slide');
        this.currentSlide = 0;
        this.totalSlides = this.slides.length;
        this.isAnimating = false;

        this.progressBar = document.getElementById('progressBar');
        this.currentSlideEl = document.getElementById('currentSlide');
        this.totalSlidesEl = document.getElementById('totalSlides');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');

        // Speaker notes
        this.speakerNotes = document.getElementById('speakerNotes');
        this.notesContent = document.getElementById('notesContent');
        this.notesClose = document.getElementById('notesClose');

        this.init();
    }

    init() {
        this.totalSlidesEl.textContent = this.totalSlides;

        this.prevBtn.addEventListener('click', () => this.prevSlide());
        this.nextBtn.addEventListener('click', () => this.nextSlide());

        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        document.querySelector('.presentation').addEventListener('click', (e) => {
            if (!e.target.closest('.slide-nav') && !e.target.closest('button')) {
                this.nextSlide();
            }
        });

        // Notes toggle
        this.notesClose.addEventListener('click', () => this.toggleNotes());

        this.updateUI();
        this.updateNotes();

        // Set initial state for first slide elements then animate
        const firstSlide = this.slides[0];
        const elements = firstSlide.querySelectorAll('.overline, h1, h2, .subtitle, .check-item');
        gsap.set(elements, { opacity: 0, y: 30 });
        this.animateSlideIn(0);
    }

    handleKeydown(e) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.nextSlide();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.prevSlide();
        } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            this.toggleNotes();
        }
    }

    toggleNotes() {
        this.speakerNotes.classList.toggle('visible');
    }

    updateNotes() {
        const slide = this.slides[this.currentSlide];
        const notes = slide.querySelector('.notes');
        if (notes) {
            this.notesContent.innerHTML = notes.innerHTML;
        } else {
            this.notesContent.innerHTML = '<em>Keine Notizen für diese Folie.</em>';
        }
    }

    nextSlide() {
        if (this.currentSlide < this.totalSlides - 1 && !this.isAnimating) {
            this.goToSlide(this.currentSlide + 1);
        }
    }

    prevSlide() {
        if (this.currentSlide > 0 && !this.isAnimating) {
            this.goToSlide(this.currentSlide - 1);
        }
    }

    goToSlide(index) {
        if (index === this.currentSlide || this.isAnimating) return;

        this.isAnimating = true;
        const direction = index > this.currentSlide ? 1 : -1;
        const oldSlide = this.slides[this.currentSlide];
        const newSlide = this.slides[index];

        // Hide elements in new slide before showing
        const newElements = newSlide.querySelectorAll('.overline, h1, h2, .subtitle, .check-item');
        gsap.set(newElements, { opacity: 0, y: 30 });

        gsap.to(oldSlide, {
            opacity: 0,
            x: -50 * direction,
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => {
                oldSlide.classList.remove('active');
            }
        });

        newSlide.classList.add('active');
        gsap.fromTo(newSlide,
            { opacity: 1, x: 50 * direction },
            {
                opacity: 1,
                x: 0,
                duration: 0.4,
                ease: 'power2.out',
                onComplete: () => {
                    this.isAnimating = false;
                    this.animateSlideIn(index);
                }
            }
        );

        this.currentSlide = index;
        this.updateUI();
        this.updateNotes();
    }

    updateUI() {
        this.currentSlideEl.textContent = this.currentSlide + 1;
        const progress = ((this.currentSlide + 1) / this.totalSlides) * 100;
        this.progressBar.style.width = `${progress}%`;
        this.prevBtn.disabled = this.currentSlide === 0;
        this.nextBtn.disabled = this.currentSlide === this.totalSlides - 1;
    }

    animateSlideIn(index) {
        const slide = this.slides[index];
        const elements = slide.querySelectorAll('.overline, h1, h2, .subtitle');

        gsap.fromTo(elements,
            { opacity: 0, y: 30 },
            {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.15,
                ease: 'power2.out'
            }
        );

        // Animate check items if present
        const checkItems = slide.querySelectorAll('.check-item');
        if (checkItems.length > 0) {
            gsap.to(checkItems, {
                opacity: 1,
                y: 0,
                duration: 0.5,
                stagger: 0.3,
                delay: 0.4,
                ease: 'power2.out'
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Presentation();
});
