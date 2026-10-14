const destinationInput = document.getElementById('destination');
const targetTimeInput = document.getElementById('target-time');
const statusText = document.getElementById('status-text');
const countdownEl = document.getElementById('countdown');
const messageEl = document.getElementById('message');
const progressCircle = document.getElementById('progress-circle');
const alarmToggle = document.getElementById('alarm-toggle');

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
let timerId = null;
let initialDuration = 0;
let redirecting = false;
let alarmEnabled = false;
let audioContext = null;

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

async function toggleAlarm() {
  if (alarmEnabled) {
    alarmEnabled = false;
    alarmToggle.textContent = 'Bật chuông báo';
    alarmToggle.setAttribute('aria-pressed', 'false');
    updateMessage('Chuông báo đã tắt.');
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    updateMessage('Trình duyệt này không hỗ trợ phát chuông báo.', 'error');
    return;
  }

  try {
    audioContext = audioContext || new AudioContextClass();
    await audioContext.resume();
    alarmEnabled = true;
    alarmToggle.textContent = 'Tắt chuông báo';
    alarmToggle.setAttribute('aria-pressed', 'true');
    updateMessage('Đã bật chuông. Chuông sẽ reo khi chuyển sang trang vé.');
  } catch (error) {
    updateMessage('Không thể bật chuông. Hãy kiểm tra cài đặt âm thanh của trình duyệt.', 'error');
  }
}

function playAlarm() {
  if (!alarmEnabled || !audioContext || audioContext.state !== 'running') {
    return;
  }

  const startAt = audioContext.currentTime;
  const duration = 3;
  const frequencies = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
  let offset = 0;

  while (offset < duration) {
    const noteDuration = Math.min(0.14 + Math.random() * 0.19, duration - offset);
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = ['sine', 'triangle', 'square'][Math.floor(Math.random() * 3)];
    oscillator.frequency.setValueAtTime(
      frequencies[Math.floor(Math.random() * frequencies.length)],
      startAt + offset,
    );
    volume.gain.setValueAtTime(0.0001, startAt + offset);
    volume.gain.exponentialRampToValueAtTime(0.16, startAt + offset + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + noteDuration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + noteDuration + 0.01);
    offset += noteDuration + 0.04 + Math.random() * 0.08;
  }
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
    clearInterval(timerId);
    timerId = null;
    const destination = destinationInput.value.trim();
    if (alarmEnabled && audioContext?.state === 'running') {
      setStatus('complete', 'Chuông báo');
      updateMessage('Chuông đang reo. Đang chuyển sang trang vé...', 'success');
      playAlarm();
      window.setTimeout(() => window.location.assign(destination), 3100);
    } else {
      setStatus('complete', 'Đang chuyển hướng');
      updateMessage(`Đang mở ${destination}...`, 'success');
      window.location.assign(destination);
    }
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
    updateMessage('Bộ đếm tự chạy và sẽ báo chuông 3 giây trước khi mở liên kết.');
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
alarmToggle.addEventListener('click', toggleAlarm);

restartClock();
