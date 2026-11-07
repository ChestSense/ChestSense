const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// nav: solid background once you scroll, burger menu on phones
const nav = $('nav');
const burger = $('burger');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 12);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
$('links').addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// fade sections in as they scroll into view
const revealer = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    revealer.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('[data-reveal]').forEach(el => revealer.observe(el));

// "how it works": the step in the middle of the screen picks the screenshot
const steps = [...document.querySelectorAll('.step')];
const frames = [...document.querySelectorAll('.stage-frame > :not(.stage-coord)')];
const stageCoord = $('stageCoord');
const stepWatcher = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const i = Number(e.target.dataset.step);
    steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    frames.forEach((f, j) => f.classList.toggle('is-active', j === i));
    stageCoord.textContent = `0${i + 1} / 0${steps.length}`;
  }
}, { rootMargin: '-45% 0px -45% 0px' });
steps.forEach(s => stepWatcher.observe(s));

// the Battle Bus crossing the hero grid, along the same line the SVG draws
const hero = document.querySelector('.hero');
const heroMap = document.querySelector('.hero-map');
const bus = $('bus');
if (reduceMotion) {
  bus.remove();
} else {
  let heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  const LAP = 16000;
  const tick = t => {
    if (heroVisible) {
      const f = (t % LAP) / LAP;
      const w = heroMap.clientWidth, h = heroMap.clientHeight;
      const x = (-0.04 + 1.08 * f) * w;
      const y = (0.96 - 0.9 * f) * h;
      const angle = Math.atan2(-0.9 * h, 1.08 * w);
      bus.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// the hero screenshot leans toward the mouse a little (mouse only)
if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
  const tilt = $('tilt');
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.setProperty('--ry', `${(px * 7).toFixed(2)}deg`);
    tilt.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`);
  });
  hero.addEventListener('pointerleave', () => {
    tilt.style.setProperty('--ry', '0deg');
    tilt.style.setProperty('--rx', '0deg');
  });
}

// ---------- Buy Now & Lifetime Access Crypto Modal ----------
const COINS = {
  solana: {
    name: 'Solana',
    label: 'Solana (SOL) Deposit Window',
    walletLabel: 'Solana Wallet Address',
    address: '5TMc6jQxQkmgbFonKb3xxWi6811aiuhDHxymSz1V5Smf',
    qr: 'qr-solana.png'
  },
  ethereum: {
    name: 'Ethereum',
    label: 'Ethereum (ETH) Deposit Window',
    walletLabel: 'Ethereum Wallet Address',
    address: '0xa4558c2cf4519a526d469d9df2f4cf9e4f021828',
    qr: 'qr-ethereum.png'
  },
  polygon: {
    name: 'Polygon (POL)',
    label: 'Polygon (POL) Deposit Window',
    walletLabel: 'Polygon (POL) Wallet Address',
    address: '0xa4558c2cf4519a526d469d9df2f4cf9e4f021828',
    qr: 'qr-polygon.png'
  }
};

const TX_DURATION_SECONDS = 300;
const buyModal = $('buyModal');
const closeBuyModalBtn = $('closeBuyModal');
const coinButtons = [...document.querySelectorAll('.coin-btn')];
const buyEmptyState = $('buyEmptyState');
const buyPaymentPanel = $('buyPaymentPanel');
const activeCoinLabel = $('activeCoinLabel');
const txTimerDisplay = $('txTimerDisplay');
const txTimerProgress = $('txTimerProgress');
const qrImage = $('qrImage');
const qrCaption = $('qrCaption');
const walletNetworkLabel = $('walletNetworkLabel');
const walletAddressOutput = $('walletAddressOutput');
const copyAddressBtn = $('copyAddressBtn');
const copyBtnText = $('copyBtnText');
const txExpiredBox = $('txExpiredBox');
const tryAgainBtn = $('tryAgainBtn');

let activeCoinKey = null;
let txIntervalId = null;
let remainingSeconds = TX_DURATION_SECONDS;
let copyResetTimeout = null;
let lastFocusedElement = null;

function formatTimer(sec) {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function stopTxTimer() {
  if (txIntervalId !== null) {
    clearInterval(txIntervalId);
    txIntervalId = null;
  }
}

function renderTimerState() {
  txTimerDisplay.textContent = formatTimer(remainingSeconds);
  const pct = Math.max(0, Math.min(100, (remainingSeconds / TX_DURATION_SECONDS) * 100));
  txTimerProgress.style.width = `${pct}%`;

  const expired = remainingSeconds <= 0;
  txTimerDisplay.classList.toggle('is-expired', expired);
  txTimerProgress.classList.toggle('is-expired', expired);

  if (expired) {
    stopTxTimer();
    copyAddressBtn.disabled = true;
    copyBtnText.textContent = 'Copy Address';
    txExpiredBox.hidden = false;
  }
}

function startTxTimer() {
  stopTxTimer();
  remainingSeconds = TX_DURATION_SECONDS;
  copyAddressBtn.disabled = false;
  copyBtnText.textContent = 'Copy Address';
  txExpiredBox.hidden = true;
  renderTimerState();

  txIntervalId = setInterval(() => {
    remainingSeconds -= 1;
    renderTimerState();
  }, 1000);
}

function selectCoin(coinKey) {
  const coin = COINS[coinKey];
  if (!coin) return;

  activeCoinKey = coinKey;
  coinButtons.forEach(btn => {
    const isSelected = btn.dataset.coin === coinKey;
    btn.classList.toggle('is-active', isSelected);
    btn.setAttribute('aria-pressed', String(isSelected));
  });

  buyEmptyState.hidden = true;
  buyPaymentPanel.hidden = false;

  activeCoinLabel.textContent = coin.label;
  walletNetworkLabel.textContent = coin.walletLabel;
  walletAddressOutput.textContent = coin.address;
  qrImage.src = coin.qr;
  qrImage.alt = `QR Code for ${coin.name} wallet address`;
  qrCaption.textContent = `Scan QR · ${coin.name}`;

  startTxTimer();
}

function openBuyModal(triggerEl) {
  lastFocusedElement = triggerEl || document.activeElement;
  buyModal.hidden = false;
  buyModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  closeBuyModalBtn.focus();
}

function closeBuyModal() {
  if (buyModal.hidden) return;
  buyModal.hidden = true;
  buyModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  stopTxTimer();
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

document.querySelectorAll('[data-open-buy-modal]').forEach(btn => {
  btn.addEventListener('click', () => openBuyModal(btn));
});

closeBuyModalBtn.addEventListener('click', closeBuyModal);

buyModal.addEventListener('click', e => {
  if (e.target === buyModal) closeBuyModal();
});

addEventListener('keydown', e => {
  if (e.key === 'Escape' && !buyModal.hidden) {
    closeBuyModal();
  }
});

coinButtons.forEach(btn => {
  btn.addEventListener('click', () => selectCoin(btn.dataset.coin));
});

tryAgainBtn.addEventListener('click', () => {
  if (activeCoinKey) {
    selectCoin(activeCoinKey);
  }
});

copyAddressBtn.addEventListener('click', async () => {
  if (copyAddressBtn.disabled || !activeCoinKey) return;
  const address = COINS[activeCoinKey].address;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(address);
    } else {
      const ta = document.createElement('textarea');
      ta.value = address;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtnText.textContent = 'Copied to Clipboard!';
    clearTimeout(copyResetTimeout);
    copyResetTimeout = setTimeout(() => {
      if (!copyAddressBtn.disabled) {
        copyBtnText.textContent = 'Copy Address';
      }
    }, 2000);
  } catch {
    copyBtnText.textContent = 'Select & Copy Above';
  }
});

