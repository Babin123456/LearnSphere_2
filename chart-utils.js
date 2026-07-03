// chart-utils.js – Simple line chart helper using Canvas 2D
// Assumes data points are numeric values between 0 and 1 (e.g., accuracy)

window.drawLineChart = function(canvas, labels, values) {
  if (!canvas || !labels || !values) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  // background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const valid = values.map((v, i) => ({ v, i })).filter(p => typeof p.v === 'number' && !Number.isNaN(p.v));
  if (valid.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px Arial';
    ctx.fillText('Not enough data to draw chart.', 16, 28);
    return;
  }

  const xStep = width / (labels.length - 1);
  const marginTop = 16;
  const marginBottom = 24;
  const usable = height - marginTop - marginBottom;
  const toY = acc => marginTop + (1 - acc) * usable;

  ctx.strokeStyle = '#66fcf1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  valid.forEach((p, idx) => {
    const x = p.i * xStep;
    const y = toY(p.v);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // points
  valid.forEach(p => {
    const x = p.i * xStep;
    const y = toY(p.v);
    ctx.fillStyle = '#66fcf1';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  // x labels (show up to 6)
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px Arial';
  const stride = Math.max(1, Math.floor(labels.length / 6));
  labels.forEach((lab, i) => {
    if (i % stride !== 0 && i !== labels.length - 1) return;
    ctx.fillText(lab, i * xStep - 10, height - 8);
  });
}
