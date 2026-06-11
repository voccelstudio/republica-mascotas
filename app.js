// Product Data
const featuredProducts = [
    {
        id: 1,
        name: "Mordiente de Cuerda Pro",
        price: 45000,
        image: "assets/cat_toy.png",
        category: "Juguetes"
    },
    {
        id: 2,
        name: "Shampoo Orgánico Aloe",
        price: 65000,
        image: "assets/shampoo.png",
        category: "Higiene"
    },
    {
        id: 3,
        name: "Cucha Ortopédica Grey",
        price: 185000,
        image: "assets/dog_bed.png",
        category: "Camas"
    },
    {
        id: 4,
        name: "Collar Soft-Touch",
        price: 35000,
        image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        category: "Accesorios"
    },
    {
        id: 5,
        name: "Rascador Torre Gato",
        price: 220000,
        image: "https://images.unsplash.com/photo-1545249390-6bdfa286032f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        category: "Gatos"
    },
    {
        id: 6,
        name: "Plato Cerámica Anti-Ant",
        price: 25000,
        image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        category: "Hogar"
    }
];

// State
let cart = JSON.parse(localStorage.getItem('rep_mascota_cart')) || [];
let deliveryFee = 25000;

// DOM Elements
const featuredGrid = document.getElementById('featuredProducts');
const cartCount = document.getElementById('cartCount');
const cartItems = document.getElementById('cartItems');
const subtotalDisplay = document.getElementById('subtotalDisplay');
const deliveryDisplay = document.getElementById('deliveryDisplay');
const totalDisplay = document.getElementById('totalDisplay');
const cartSidebar = document.getElementById('cartSidebar');
const overlay = document.getElementById('overlay');

// Formatting
const formatter = new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
});

// Toast
function showToast(message, icon = 'fa-check-circle') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3200);
}

// Image Error Fallback
function handleImgError(img) {
    img.onerror = null;
    const fallback = document.createElement('div');
    fallback.className = 'img-error';
    fallback.innerHTML = '<i class="fas fa-paw"></i>';
    fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#f1f2f6;color:#ccc;font-size:3rem;height:100%;width:100%';
    img.replaceWith(fallback);
}

function handleCartImgError(img) {
    img.onerror = null;
    const fallback = document.createElement('div');
    fallback.className = 'cart-item-img-fallback';
    fallback.innerHTML = '<i class="fas fa-paw"></i>';
    img.replaceWith(fallback);
}

// Initialize Highlights
function initProducts() {
    featuredGrid.innerHTML = featuredProducts.map(product => `
        <div class="product-card">
            <div class="product-img">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="handleImgError(this)">
            </div>
            <div class="product-info">
                <div>
                    <span style="font-size: 0.75rem; color: var(--primary-blue); font-weight: 700; text-transform: uppercase;">${product.category}</span>
                    <h3>${product.name}</h3>
                </div>
                <div class="price">${formatter.format(product.price)}</div>
                <button class="btn btn-primary" onclick="addToCart(${product.id})">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('#featuredProducts .product-img img').forEach(img => {
        img.addEventListener('error', function() { handleImgError(this); });
    });
}

// Bulk Logic Refresh
function initBulkLogic() {
    const bulkCards = document.querySelectorAll('.bulk-controls');
    
    bulkCards.forEach(card => {
        const pricePerKg = parseInt(card.dataset.price);
        const weightDisplay = card.querySelector('.weight-display');
        const priceDisplay = card.querySelector('.price');
        const incBtn = card.querySelector('.inc-bulk');
        const decBtn = card.querySelector('.dec-bulk');
        const addBtn = card.closest('.product-info').querySelector('.add-bulk-btn');
        
        let weight = 0.1;
        
        const updateDisplay = () => {
            weightDisplay.textContent = weight.toFixed(1);
            priceDisplay.textContent = formatter.format(Math.round(weight * pricePerKg));
        };
        
        incBtn.onclick = () => { weight += 0.1; updateDisplay(); };
        decBtn.onclick = () => { if(weight > 0.1) { weight -= 0.1; updateDisplay(); } };
        
        addBtn.onclick = () => {
            const item = {
                id: card.dataset.id + '-' + Date.now(),
                name: `${card.dataset.name} (${weight.toFixed(1)}kg)`,
                price: Math.round(weight * pricePerKg),
                image: card.closest('.product-card').querySelector('img').src || '',
                quantity: 1
            };
            cart.push(item);
            updateCart();
            openCart();
            showToast(`${item.name} agregado al carrito`);
        };
        
        updateDisplay();
    });
}

// Cart Logic
function addToCart(productId) {
    const product = featuredProducts.find(p => p.id === productId);
    const existing = cart.find(item => item.id === productId);
    
    if (existing) {
        existing.quantity += 1;
        showToast(`${product.name} x${existing.quantity} en tu carrito`);
    } else {
        cart.push({ ...product, quantity: 1 });
        showToast(`${product.name} agregado al carrito`);
    }
    
    updateCart();
    openCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCart();
    showToast('Producto eliminado del carrito', 'fa-trash');
}

function updateQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(id);
    } else {
        updateCart();
    }
}

function updateCart() {
    localStorage.setItem('rep_mascota_cart', JSON.stringify(cart));
    
    // Update Count
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    // Render Items
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #999; margin-top: 50px;">Tu carrito está vacío</p>';
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" class="cart-item-img" onerror="handleCartImgError(this)">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span style="font-size: 0.8rem;">${formatter.format(item.price)} c/u</span>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                        <span class="qty-display">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: #ff7675; cursor: pointer; font-size: 1.1rem;" aria-label="Eliminar ${item.name}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }
    
    // Totals
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    subtotalDisplay.textContent = formatter.format(subtotal);
    deliveryDisplay.textContent = formatter.format(deliveryFee);
    totalDisplay.textContent = formatter.format(subtotal + deliveryFee);
}

// UI Controls
function openCart() {
    cartSidebar.classList.add('open');
    overlay.classList.add('show');
}

function closeCart() {
    cartSidebar.classList.remove('open');
    overlay.classList.remove('show');
}

document.getElementById('cartToggle').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

// Delivery Toggle
document.querySelectorAll('input[name="delivery"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        deliveryFee = parseInt(e.target.value);
        updateCart();
    });
});

// Checkout
document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (cart.length === 0) return showToast('El carrito está vacío', 'fa-exclamation-circle');
    
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = subtotal + deliveryFee;
    const deliveryType = deliveryFee > 0 ? 'Delivery' : 'Retiro en Tienda';
    
    let message = `*Nuevo Pedido - República Mascota*\n\n`;
    cart.forEach(item => {
        message += `- ${item.name} (x${item.quantity}): ${formatter.format(item.price * item.quantity)}\n`;
    });
    
    message += `\n*Subtotal:* ${formatter.format(subtotal)}`;
    message += `\n*Envío (${deliveryType}):* ${formatter.format(deliveryFee)}`;
    message += `\n*TOTAL:* ${formatter.format(total)}`;
    
    const whatsappUrl = `https://wa.me/595992311700?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    cart = [];
    updateCart();
    closeCart();
    showToast('Pedido enviado. Te contactamos a la brevedad', 'fa-check-circle');
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Carousel Logic
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-item');
const dotsContainer = document.getElementById('carouselDots');
let slideInterval;

function initCarousel() {
    // Create dots
    slides.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = `dot ${i === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(i);
        dotsContainer.appendChild(dot);
    });

    document.getElementById('nextSlide').onclick = nextSlide;
    document.getElementById('prevSlide').onclick = prevSlide;
    
    startAutoPlay();
}

function updateSlides() {
    const inner = document.querySelector('.carousel-inner');
    inner.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    updateSlides();
    resetAutoPlay();
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    updateSlides();
    resetAutoPlay();
}

function goToSlide(n) {
    currentSlide = n;
    updateSlides();
    resetAutoPlay();
}

function startAutoPlay() {
    slideInterval = setInterval(nextSlide, 5000);
}

function resetAutoPlay() {
    clearInterval(slideInterval);
    startAutoPlay();
}

// Menu Toggle
document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('mainNav').classList.toggle('open');
    const icon = document.querySelector('#menuToggle i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

document.querySelectorAll('#mainNav a').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById('mainNav').classList.remove('open');
        const icon = document.querySelector('#menuToggle i');
        icon.className = 'fas fa-bars';
    });
});

// Scroll to Top
const scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
    scrollBtn.classList.toggle('show', window.scrollY > 400);
});
scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Booking Form Validation
const bookingForm = document.getElementById('bookingForm');
const bookingDateInput = document.getElementById('bookingDate');
const today = new Date().toISOString().split('T')[0];
bookingDateInput.setAttribute('min', today);

bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (!formData.get('petName').trim()) {
        showToast('Ingresá el nombre de tu mascota', 'fa-exclamation-circle');
        return;
    }
    if (!formData.get('bookingDate')) {
        showToast('Elegí una fecha sugerida', 'fa-exclamation-circle');
        return;
    }
    
    const data = {
        pet: formData.get('petName'),
        type: formData.get('petType'),
        service: formData.get('serviceType'),
        date: formData.get('bookingDate')
    };

    const message = `*Reserva de Peluquería - República Mascota*\n\n` +
                    `- *Mascota:* ${data.pet}\n` +
                    `- *Tipo:* ${data.type}\n` +
                    `- *Servicio:* ${data.service}\n` +
                    `- *Fecha Sugerida:* ${data.date}\n\n` +
                    `Por favor confirmarme disponibilidad.`;

    const whatsappUrl = `https://wa.me/595992311700?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    bookingForm.reset();
    showToast('Solicitud enviada. Te confirmamos por WhatsApp', 'fa-check-circle');
});

// Image error handlers for bulk section
document.querySelectorAll('#bulk .product-img img').forEach(img => {
    img.addEventListener('error', function() { handleImgError(this); });
});

// Start
document.addEventListener('DOMContentLoaded', () => {
    initProducts();
    initBulkLogic();
    initCarousel();
    updateCart();
});
