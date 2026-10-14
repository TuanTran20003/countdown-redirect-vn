const destinationInput = document.getElementById('destination');
const targetTimeInput = document.getElementById('target-time');
const statusText = document.getElementById('status-text');
const countdownEl = document.getElementById('countdown');
const messageEl = document.getElementById('message');
const progressCircle = document.getElementById('progress-circle');

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
let timerId = null;
let initialDuration = 0;
let redirecting = false;

function updateMessage(text, type = '') {
  messageEl.textContent = text;
  messageEl.className = 'message';
  if (type) {
    messageEl.classList.add(type);
  }
}

function setStatus(status, text) {
  statusText.className = `status-text ${status}`;
  statusText.textContent = text;
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const days = Math.floor(safeSeconds / 86400);
  const hours = String(Math.floor((safeSeconds % 86400) / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  const time = `${hours}:${minutes}:${seconds}`;
  return days > 0 ? `${days} ngày ${time}` : time;
}

function drawProgress(remainingSeconds) {
  const progress = initialDuration > 0
    ? Math.min(1, Math.max(0, 1 - remainingSeconds / initialDuration))
    : 0;
  progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progressCircle.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - progress)}`;

  const svg = progressCircle.ownerSVGElement;
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  if (!defs.querySelector('#countdown-gradient')) {
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'countdown-gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('y2', '100%');

    for (const [offset, color] of [['0%', '#7c9cff'], ['100%', '#3dd598']]) {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', color);
      gradient.appendChild(stop);
    }

    defs.appendChild(gradient);
  }

  progressCircle.style.stroke = 'url(#countdown-gradient)';
}

function validateUrl(value) {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function getTargetTimestamp() {
  if (!targetTimeInput.value) {
    return NaN;
  }
  return new Date(targetTimeInput.value).getTime();
}

function tick() {
  if (redirecting) {
    return;
  }

  const targetTimestamp = getTargetTimestamp();
  if (!Number.isFinite(targetTimestamp)) {
    setStatus('idle', 'Chưa chọn thời điểm');
    updateMessage('Vui lòng chọn thời điểm chuyển hướng hợp lệ.', 'error');
    return;
  }

  const remainingSeconds = Math.max(0, (targetTimestamp - Date.now()) / 1000);
  countdownEl.textContent = formatTime(remainingSeconds);
  drawProgress(remainingSeconds);

  if (remainingSeconds <= 0) {
    if (!validateUrl(destinationInput.value)) {
      setStatus('cancelled', 'Chưa thể chuyển hướng');
      updateMessage('Thời điểm đã đến nhưng URL không hợp lệ. Hãy nhập một địa chỉ http:// hoặc https://.', 'error');
      clearInterval(timerId);
      timerId = null;
      return;
    }

    redirecting = true;
    setStatus('complete', 'Đang chuyển hướng');
    updateMessage(`Đang mở ${destinationInput.value.trim()}...`, 'success');
    clearInterval(timerId);
    timerId = null;
    window.location.assign(destinationInput.value.trim());
    return;
  }

  setStatus('running', 'Đang đếm ngược');
}

function restartClock() {
  redirecting = false;
  clearInterval(timerId);
  const targetTimestamp = getTargetTimestamp();
  initialDuration = Number.isFinite(targetTimestamp)
    ? Math.max(0, (targetTimestamp - Date.now()) / 1000)
    : 0;
  if (initialDuration > 0 && validateUrl(destinationInput.value)) {
    updateMessage('Bộ đếm tự chạy theo thời gian thực và sẽ tự mở liên kết khi về 0.');
  }
  tick();
  if (!redirecting) {
    timerId = setInterval(tick, 250);
  }
}

destinationInput.addEventListener('input', () => {
  if (!validateUrl(destinationInput.value)) {
    updateMessage('Nhập URL hợp lệ bắt đầu bằng http:// hoặc https://.', 'error');
  } else {
    updateMessage('Liên kết đã sẵn sàng để tự động mở đúng thời điểm.');
  }
});

targetTimeInput.addEventListener('input', restartClock);
targetTimeInput.addEventListener('change', restartClock);

restartClock();
