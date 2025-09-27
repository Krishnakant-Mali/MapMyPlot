
// ====== plot.js - draggable partition lines (customize mode) + exact area partitions ======
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('landCanvas');
  const ctx = canvas.getContext('2d');

  // Controls (expected to exist in the page)
  const drawBtn = document.getElementById('drawBtn');
  const undoBtn = document.getElementById('undoBtn');
  const okBtn = document.getElementById('okBtn');
  const resetBtn = document.getElementById('resetBtn');
  const generateBtn = document.getElementById('generateBtn');
  const customizeBtn = document.getElementById('customizeBtn'); // new toggle button
  const numPartitionsInput = document.getElementById('numPartitions');
  const refLengthInput = document.getElementById('refLength');
  const unitsSelect = document.getElementById('units');
  const areaTableBody = document.getElementById('areaTable');
  const totalAreaSpan = document.getElementById('totalArea');
  const imageInput = document.getElementById('imageUpload');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadModal = document.getElementById('uploadModal');
  const chooseFileBtn = document.getElementById('chooseFileBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const measureBtn = document.getElementById('measureBtn');
  const measureBox = document.getElementById('measureDistanceBox');
  const distanceInput = document.getElementById('boundaryDistance');

  // State
  let img = new Image();
  let imgLoaded = false;
  let drawMode = false;
  let drawingPreview = false;

  let boundaryPoints = [];
  let undoneStack = [];
  let boundaryFinal = null; // finalized polygon (array of {x,y})

  // partitions: array of objects { x: Number, dragging: Boolean }
  let partitions = [];
  let customizeMode = false;

  let pan = { x: 0, y: 0 };
  let scale = 1;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  // Measurement
  let measureMode = false;
  let measurePoints = [];
  let measurePath = [];

  // Scale calibration (meters-per-pixel)
  let scaleMetersPerPixel = null; // null until computed
  let currentUnit = 'm';

  const exportBtn = document.getElementById('exportBtn');

  exportBtn && exportBtn.addEventListener('click', () => {
  if (!boundaryFinal) return alert('No boundary drawn to export.');

  exportBtn.disabled = true;
  const originalText = exportBtn.textContent;
  exportBtn.textContent = 'Preparing Report...';

  // 1️⃣ Capture canvas with partitions
  redraw();
  const imgData = canvas.toDataURL('image/png');

  // 2️⃣ Gather details
  const numPartitions = partitions.length || 0;
  const referenceLength = refLengthInput ? refLengthInput.value + ' ' + (unitsSelect?.value || 'm') : '—';
  const totalAreaText = totalAreaSpan ? totalAreaSpan.textContent : '—';
  const tableData = Array.from(areaTableBody.querySelectorAll('tr')).map(row => {
    const cells = row.querySelectorAll('td');
    return [cells[0].textContent, cells[1].textContent];
  });
  const now = new Date();

  // 🔑 Base64 or hosted logo (optional)
  const logoBase64 = "data:image/png;base64,PUT-YOUR-LOGO-BASE64-HERE";

  // 3️⃣ Build Report
  const reportDiv = document.createElement('div');
  reportDiv.id = "report-content"; // for page numbering
  reportDiv.style.width = '700px';
  reportDiv.style.fontFamily = 'Times New Roman, serif';
  reportDiv.innerHTML = `
    <div style="display:flex; align-items:center; margin-bottom:10px;">
      <img src="./assets/logo.png" style="height:70px; margin-right:15px;">
      <div style="flex:1; text-align:center;">
        <h1 style="margin:0; font-size:22px; text-transform:uppercase;">MapMyPlot</h1>
        <p style="margin:0; font-size:12px;">Official Land Partition Report</p>
      </div>
    </div>
    <hr>
    <p style="text-align:right; font-size:12px;">
      Report Date: ${now.toLocaleString("en-IN", {
        year:"numeric", month:"long", day:"numeric",
        hour:"2-digit", minute:"2-digit"
      })}<br>
      Reference No: REF-${now.getTime()}
    </p>
    
    <h3>Plot Information</h3>
    <table style="border-collapse:collapse; width:100%; margin-bottom:15px;">
      <tr><td style="padding:5px; border:1px solid #333;">Number of partitions</td><td style="padding:5px; border:1px solid #333;">${numPartitions}</td></tr>
      <tr><td style="padding:5px; border:1px solid #333;">Reference Length</td><td style="padding:5px; border:1px solid #333;">${referenceLength}</td></tr>
      <tr><td style="padding:5px; border:1px solid #333;">Total Area</td><td style="padding:5px; border:1px solid #333;">${totalAreaText}</td></tr>
    </table>
    
    <h3>Partition Details</h3>
    <table style="border-collapse: collapse; width: 100%; margin-bottom:15px; page-break-inside:auto; word-wrap:break-word;">
      <thead style="display:table-header-group;">
        <tr style="background:#e0e0e0;">
          <th style="border:1px solid #333; padding:5px;">S.No</th>
          <th style="border:1px solid #333; padding:5px;">Partition</th>
          <th style="border:1px solid #333; padding:5px;">Area</th>
        </tr>
      </thead>
      <tbody style="display:table-row-group;">
        ${tableData.map((row, idx) => `
          <tr style="background-color:${idx%2===0?'#f9f9f9':'#fff'}; page-break-inside:avoid;">
            <td style="border:1px solid #333; padding:5px;">${idx+1}</td>
            <td style="border:1px solid #333; padding:5px;">${row[0]}</td>
            <td style="border:1px solid #333; padding:5px;">${row[1]}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    
    <h3>Figure</h3>
    <p style="font-size:12px; margin:5px 0;">Figure 1: Plot boundary with marked partitions</p>
    <img src="${imgData}" style="max-width:100%; height:auto; border:1px solid #333; margin:10px 0; page-break-inside:avoid;">
    
    <hr>
    <div style="margin-top:40px; text-align:left;">
      <p style="font-size:12px;"><b>Authorized Signatory</b></p>
      <div style="border-top:1px solid #000; width:200px; margin-top:20px;"></div>
    </div>
    
    <div style="text-align:center; font-size:12px; margin-top:20px;">
      <p>Generated by MapMyPlot Solutions | Confidential Legal Document</p>
    </div>
  `;

  // 4️⃣ PDF Options
  const opt = {
    margin:       [10,10,20,10], // extra bottom margin
    filename:     'land_partition_report.pdf',
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // 5️⃣ Generate PDF with dynamic page numbers
  html2pdf()
    .from(reportDiv)
    .set(opt)
    .toPdf()
    .get('pdf')
    .then(function (pdf) {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pdf.internal.pageSize.getWidth() / 2,
          pdf.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
    })
    .save()
    .finally(() => {
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    });
});


  // ====== Canvas resize & DPR handling ======
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ====== Upload modal handlers ======
  uploadBtn && uploadBtn.addEventListener('click', () => uploadModal.style.display = 'flex');
  closeModalBtn && closeModalBtn.addEventListener('click', () => uploadModal.style.display = 'none');
  chooseFileBtn && chooseFileBtn.addEventListener('click', () => imageInput.click());
  imageInput && imageInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { img.src = ev.target.result; uploadModal.style.display = 'none'; };
    reader.readAsDataURL(file);
  });
  img.onload = () => { imgLoaded = true; redraw(); };

  // ====== Basic helpers ======
  function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function drawImageOnCanvas() {
    if (!imgLoaded) return;
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    const canvasRatio = cw / ch;
    const imgRatio = img.width / img.height;
    let drawW, drawH, offsetX, offsetY;
    if (imgRatio > canvasRatio) {
      drawW = cw; drawH = cw / imgRatio;
      offsetX = 0; offsetY = (ch - drawH) / 2;
    } else {
      drawH = ch; drawW = ch * imgRatio;
      offsetY = 0; offsetX = (cw - drawW) / 2;
    }
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();
  }

  // ====== Drawing preview & final polygon ======
  function drawBoundaryPreview(mousePos) {
    if (boundaryPoints.length === 0 && !mousePos) return;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    if (boundaryPoints.length > 0) {
      ctx.strokeStyle = 'green';
      ctx.fillStyle = 'rgba(0,255,0,0.12)';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.beginPath();
      ctx.moveTo(boundaryPoints[0].x, boundaryPoints[0].y);
      for (let i = 1; i < boundaryPoints.length; i++) ctx.lineTo(boundaryPoints[i].x, boundaryPoints[i].y);
      ctx.stroke();
    }

    if (mousePos && boundaryPoints.length > 0) {
      const last = boundaryPoints[boundaryPoints.length - 1];
      ctx.strokeStyle = 'rgba(0,128,0,0.7)';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
    }

    ctx.fillStyle = 'red';
    boundaryPoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2); ctx.fill(); });

    ctx.restore();
  }

  // draw final polygon + partitions + measure path
  function drawBoundaryFinal() {
    if (!boundaryFinal) return;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    // polygon fill
    ctx.fillStyle = 'rgba(144,238,144,0.5)';
    ctx.strokeStyle = 'green';
    ctx.lineWidth = Math.max(1, 2 / scale);
    ctx.beginPath();
    ctx.moveTo(boundaryFinal[0].x, boundaryFinal[0].y);
    for (let i = 1; i < boundaryFinal.length; i++) ctx.lineTo(boundaryFinal[i].x, boundaryFinal[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // draw partition vertical segments (inner polygon segments)
    if (partitions && partitions.length) {
      ctx.strokeStyle = customizeMode ? 'red' : 'blue';
      ctx.lineWidth = Math.max(1, 2 / scale);
      partitions.forEach(p => {
        const ys = getPolygonIntersectionsAtX(p.x, boundaryFinal);
        for (let i = 0; i + 1 < ys.length; i += 2) {
          ctx.beginPath();
          ctx.moveTo(p.x, ys[i]);
          ctx.lineTo(p.x, ys[i + 1]);
          ctx.stroke();
        }
      });
    }

    // draw draggable handles (intersection points) when in customize mode
    if (customizeMode && partitions && partitions.length) {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = Math.max(1, 1 / scale);
      partitions.forEach(p => {
        const ys = getPolygonIntersectionsAtX(p.x, boundaryFinal);
        for (let i = 0; i + 1 < ys.length; i += 2) {
          // draw small handle at top and bottom intersections
          const y0 = ys[i], y1 = ys[i + 1];
          [y0, y1].forEach(y => {
            ctx.beginPath();
            ctx.arc(p.x, y, 6 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      });
    }

    // draw measure path
    if (measurePath.length > 0) {
      ctx.strokeStyle = 'orange';
      ctx.lineWidth = Math.max(2, 3 / scale);
      ctx.beginPath();
      ctx.moveTo(measurePath[0].x, measurePath[0].y);
      for (let i = 1; i < measurePath.length; i++) ctx.lineTo(measurePath[i].x, measurePath[i].y);
      ctx.stroke();
    }
    ctx.fillStyle = 'red';
    measurePoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2); ctx.fill(); });

    ctx.restore();
  }


  function redraw(mousePosForPreview) {
    clearCanvas();
    drawImageOnCanvas();
    if (!boundaryFinal) {
      if (drawMode) drawBoundaryPreview(mousePosForPreview);
      else drawBoundaryPreview(null);
    } else {
      drawBoundaryFinal();
      if (drawMode) drawBoundaryPreview(mousePosForPreview); // in case user toggles draw while polygon exists
    }
  }

  // ====== Geometry helpers ======
  function polygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let a = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return Math.abs(a / 2);
  }

  //to indicate the mode
function updateModeIndicator() {
  const el = document.getElementById("modeIndicator");
  if (!el) return;

  if (drawMode) {
    el.textContent = "Mode: Draw";
  } else if (measureMode) {
    el.textContent = "Mode: Measure";
  } else if (customizeMode) {
    el.textContent = "Mode: Customize";
  } else {
    el.textContent = "Mode: Normal";
  }
}


  // Clip polygon with vertical line x = c. If keepLeft true, returns polygon ∩ {x <= c}
  function clipPolygonByVertical(poly, c, keepLeft = true) {
    if (!poly || poly.length < 3) return [];
    const out = [];
    const eps = 1e-9;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const aIn = keepLeft ? (a.x <= c + eps) : (a.x >= c - eps);
      const bIn = keepLeft ? (b.x <= c + eps) : (b.x >= c - eps);

      if (aIn && bIn) {
        out.push({ x: b.x, y: b.y });
      } else if (aIn && !bIn) {
        const denom = (b.x - a.x);
        if (Math.abs(denom) > 1e-12) {
          const t = (c - a.x) / denom;
          const y = a.y + t * (b.y - a.y);
          out.push({ x: c, y });
        }
      } else if (!aIn && bIn) {
        const denom = (b.x - a.x);
        if (Math.abs(denom) > 1e-12) {
          const t = (c - a.x) / denom;
          const y = a.y + t * (b.y - a.y);
          out.push({ x: c, y });
        }
        out.push({ x: b.x, y: b.y });
      } // else both out
    }
    // remove near duplicates
    const cleaned = [];
    for (let i = 0; i < out.length; i++) {
      if (i === 0) cleaned.push(out[i]);
      else {
        const prev = cleaned[cleaned.length - 1];
        if (Math.hypot(prev.x - out[i].x, prev.y - out[i].y) > 1e-6) cleaned.push(out[i]);
      }
    }
    return cleaned;
  }

  // Return sorted y-coordinates where vertical line x intersects polygon edges
  function getPolygonIntersectionsAtX(x, poly) {
    const ys = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
        if (Math.abs(b.x - a.x) < 1e-12) {
          ys.push(a.y, b.y);
        } else {
          const t = (x - a.x) / (b.x - a.x);
          if (t >= -1e-9 && t <= 1 + 1e-9) {
            const y = a.y + t * (b.y - a.y);
            ys.push(y);
          }
        }
      }
    }
    ys.sort((u, v) => u - v);
    // remove near duplicates
    const res = [];
    for (const y of ys) {
      if (res.length === 0 || Math.abs(res[res.length - 1] - y) > 1e-6) res.push(y);
    }
    return res;
  }

  // ====== Mouse coordinate helpers ======
  function getMousePosCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left - pan.x) / scale, y: (e.clientY - rect.top - pan.y) / scale };
  }

  // ====== Mouse events & partition dragging ======
  let activePartition = null;
  let activeHandle = null; // 'top' or 'bottom' or null (we only need to know that user clicked near an endpoint)

  canvas.addEventListener('mousedown', (e) => {
    const pos = getMousePosCanvas(e);

    // partition handle picking (only in customize mode)
    if (customizeMode && boundaryFinal && partitions.length) {
      const tol = 8 / scale; // tolerance in canvas coords
      for (let p of partitions) {
        const ys = getPolygonIntersectionsAtX(p.x, boundaryFinal);
        for (let i = 0; i + 1 < ys.length; i += 2) {
          const candidates = [ys[i], ys[i + 1]];
          for (let idx = 0; idx < candidates.length; idx++) {
            const y = candidates[idx];
            const d = Math.hypot(pos.x - p.x, pos.y - y);
            if (d <= tol) {
              // start dragging this partition's x
              activePartition = p;
              p.dragging = true;
              activeHandle = idx === 0 ? 'top' : 'bottom';
              return; // take precedence over other actions
            }
          }
        }
      }
    }

    // drawing polygon mode
    if (drawMode) {
      // close polygon if clicking near first point
      if (boundaryPoints.length > 2) {
        const first = boundaryPoints[0];
        const d = Math.hypot(pos.x - first.x, pos.y - first.y);
        if (d < 6 / Math.max(1, scale)) {
          boundaryPoints.push({ ...first });
          drawingPreview = false;
          redraw();
          return;
        }
      }
      boundaryPoints.push(pos);
      undoneStack = [];
      drawingPreview = true;
      redraw();
      return;
    }

    // measure mode (snap to boundary)
    if (measureMode && boundaryFinal) {
      if (measurePoints.length < 2) {
        const closest = closestPointOnBoundary(pos, boundaryFinal);
        measurePoints.push(closest);
        if (measurePoints.length === 2) {
          measurePath = getShortestBoundaryPath(boundaryFinal, measurePoints[0], measurePoints[1]);
          const distPx = measurePathLength(measurePath); // px
          if (scaleMetersPerPixel) {
            const distMeters = distPx * scaleMetersPerPixel;
            const out = metersToUnit(distMeters, currentUnit);
            distanceInput.value = `${out.toFixed(3)} ${currentUnit}`;
          } else {
            distanceInput.value = `${distPx.toFixed(3)} px (no scale)`;
          }
        }
        redraw();
        return;
      }
    }

    // otherwise start panning
    isDragging = true;
    dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePosCanvas(e);

    // dragging a partition in customize mode
    if (activePartition && activePartition.dragging) {
      // compute allowable range (don't cross neighbors)
      const idx = partitions.indexOf(activePartition);
      const boundaryMinX = Math.min(...boundaryFinal.map(p => p.x));
      const boundaryMaxX = Math.max(...boundaryFinal.map(p => p.x));
      const leftBound = (idx > 0) ? (partitions[idx - 1].x + 1e-3) : boundaryMinX;
      const rightBound = (idx < partitions.length - 1) ? (partitions[idx + 1].x - 1e-3) : boundaryMaxX;
      // clamp proposed x to [leftBound, rightBound]
      let proposedX = Math.max(leftBound, Math.min(rightBound, pos.x));

      // additionally ensure proposedX is within polygon's horizontal span at the handle's y
      // We do a simple check: if proposedX has 0 intersections (outside polygon), nudge it to nearest side
      const testYs = getPolygonIntersectionsAtX(proposedX, boundaryFinal);
      if (testYs.length < 2) {
        // attempt to nudge slightly left/right until we find intersections (bounded)
        const step = (rightBound - leftBound) / 100 || 1;
        let found = false;
        for (let sign of [0, -1, 1, -2, 2]) {
          const tryX = proposedX + sign * step;
          if (tryX < leftBound || tryX > rightBound) continue;
          if (getPolygonIntersectionsAtX(tryX, boundaryFinal).length >= 2) { proposedX = tryX; found = true; break; }
        }
        if (!found) {
          // fallback: don't move
          proposedX = activePartition.x;
        }
      }

      activePartition.x = proposedX;
      updateAreas(); // live update areas
      redraw();
      return;
    }

    // drawing preview while creating polygon
    if (drawMode && boundaryPoints.length > 0 && drawingPreview) {
      redraw(pos);
      return;
    }

    // panning
    if (isDragging) {
      pan.x = e.clientX - dragStart.x;
      pan.y = e.clientY - dragStart.y;
      redraw();
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (activePartition) activePartition.dragging = false;
    activePartition = null;
    activeHandle = null;
    isDragging = false;
    drawingPreview = false;
  });

  canvas.addEventListener('mouseout', () => {
    // cancel interactive states
    if (activePartition) activePartition.dragging = false;
    activePartition = null;
    activeHandle = null;
    isDragging = false;
    drawingPreview = false;
    redraw();
  });

  // ====== Draw / Undo / OK ======
  undoBtn && undoBtn.addEventListener('click', () => {
    if (boundaryPoints.length === 0) return;
    undoneStack.push(boundaryPoints.pop());
    redraw();
  });

  okBtn && okBtn.addEventListener('click', () => {
    if (boundaryPoints.length < 3) return alert('Draw a closed boundary first (at least 3 points).');
    const pts = boundaryPoints.slice();
    // remove duplicate final point if equals first
    if (pts.length > 1) {
      const first = pts[0], last = pts[pts.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) pts.pop();
    }
    boundaryFinal = pts;
    boundaryPoints = [];
    drawMode = false;
    drawingPreview = false;
    drawBtn && drawBtn.classList.remove('active');

    // reset partitions & measures
    partitions = [];
    measureMode = false;
    measurePoints = [];
    measurePath = [];
    measureBox && (measureBox.style.display = 'none');
    distanceInput && (distanceInput.value = '');
    totalAreaSpan && (totalAreaSpan.textContent = '—');
    areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);

    // update scale if ref present
    updateScaleFromInputs();

      // 🟢 NEW: hide image after finalizing
  imgLoaded = false;
  img.src = "";

  updateModeIndicator();  // 🟢 reset after OK

    redraw();
  });

  drawBtn && drawBtn.addEventListener('click', () => {
    drawMode = !drawMode;
    drawBtn.classList.toggle('active', drawMode);
    if (drawMode) {
      boundaryPoints = [];
      undoneStack = [];
      boundaryFinal = null;
      partitions = [];
      totalAreaSpan && (totalAreaSpan.textContent = '—');
      areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);
    } else {
      drawingPreview = false;
    }
    updateModeIndicator();  // 🟢 new
    redraw();
  });

  // ====== Wheel Zoom (centered on cursor) ======
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoomFactor = 1 - e.deltaY * 0.00125;
    const newScale = scale * zoomFactor;
    // clamp to reasonable range
    if (newScale < 0.2 || newScale > 10) return;
    pan.x = mx - (mx - pan.x) * (newScale / scale);
    pan.y = my - (my - pan.y) * (newScale / scale);
    scale = newScale;
    redraw();
  }, { passive: false });

  // ====== Unit/scale helpers ======
  function lengthToMeters(length, unit) {
    switch (unit) {
      case 'm': return length;
      case 'ft': return length * 0.3048;
      case 'in': return length * 0.0254;
      case 'km': return length * 1000;
      case 'mi': return length * 1609.344;
      default: return length; // fallback
    }
  }
  function metersToUnit(lengthMeters, unit) {
    switch (unit) {
      case 'm': return lengthMeters;
      case 'ft': return lengthMeters / 0.3048;
      case 'in': return lengthMeters / 0.0254;
      case 'km': return lengthMeters / 1000;
      case 'mi': return lengthMeters / 1609.344;
      default: return lengthMeters;
    }
  }
function areaMeters2ToUnit(areaM2, unit) {
  switch (unit) {
    case 'm': return { value: areaM2, label: 'm²' };
    case 'ft': return { value: areaM2 / 0.09290304, label: 'ft²' }; // 1 m² = 10.7639 ft²
    case 'in': return { value: areaM2 / 0.00064516, label: 'in²' }; // 1 m² = 1550 in²
    case 'acre': return { value: areaM2 / 4046.8564224, label: 'acres' };
    default: return { value: areaM2, label: 'm²' }; // fallback
  }
}


function updateScaleFromInputs(lengthUnit = 'm') {
  if (!boundaryFinal || boundaryFinal.length < 2) { 
    scaleMetersPerPixel = null; 
    return; 
  }

  const refValue = parseFloat(refLengthInput.value);
  if (!refValue || !isFinite(refValue)) { 
    scaleMetersPerPixel = null; 
    return; 
  }

  const p1 = boundaryFinal[0], p2 = boundaryFinal[1];
  const refPixelLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (refPixelLen <= 0) { scaleMetersPerPixel = null; return; }

  const refMeters = lengthToMeters(refValue, lengthUnit);
  scaleMetersPerPixel = refMeters / refPixelLen; // meters per pixel
}


  // Keep scale updated when user edits inputs
  refLengthInput && refLengthInput.addEventListener('change', updateScaleFromInputs);
  unitsSelect && unitsSelect.addEventListener('change', () => { updateScaleFromInputs(); currentUnit = unitsSelect.value; });

  // ====== Partition generation (exact equal-area using binary search) ======
 generateBtn && generateBtn.addEventListener('click', () => {
  if (!boundaryFinal) return alert('Finalize boundary first.');
  const num = Math.max(1, parseInt(numPartitionsInput.value || '1', 10));
  if (num <= 0) return alert('Enter valid number of partitions.');

  // Read current units from selectors
  const lengthUnit = document.getElementById('lengthUnit')?.value || 'm';
  const areaUnit = document.getElementById('areaUnit')?.value || 'm';

  // Update scale based on reference length and length unit
  updateScaleFromInputs(lengthUnit);

  const totalAreaPx = polygonArea(boundaryFinal);
  if (totalAreaPx === 0) return alert('Zero area polygon.');

  // compute min&max X
  const minX = Math.min(...boundaryFinal.map(p => p.x));
  const maxX = Math.max(...boundaryFinal.map(p => p.x));

  const areaLeftOfX = (x) => polygonArea(clipPolygonByVertical(boundaryFinal, x, true));

  // create cut positions via binary search to achieve equal-area partitions
  partitions = [];
  for (let i = 1; i < num; i++) {
    const targetPx = (totalAreaPx * i) / num;
    let left = minX, right = maxX, mid = (left + right) / 2;
    for (let iter = 0; iter < 60; iter++) {
      mid = (left + right) / 2;
      const a = areaLeftOfX(mid);
      if (a < targetPx) left = mid;
      else right = mid;
    }
    const cutX = (left + right) / 2;
    partitions.push({ x: cutX, dragging: false });
  }

  // Update area table using selected area unit
  updateAreas(areaUnit);

  redraw();
});


  // update area table from current partitions (live)
function updateAreas(areaUnit = 'm') {
  if (!boundaryFinal) return;

  const minX = Math.min(...boundaryFinal.map(p => p.x));
  const maxX = Math.max(...boundaryFinal.map(p => p.x));
  const areaLeftOfX = (x) => polygonArea(clipPolygonByVertical(boundaryFinal, x, true));
  
  areaTableBody.innerHTML = '';
  let prevX = minX;
  const cutXs = partitions.map(p => p.x).concat([maxX]);

  let cumM2 = 0;
  for (let idx = 0; idx < cutXs.length; idx++) {
    const x = cutXs[idx];
    const areaPx = areaLeftOfX(x) - areaLeftOfX(prevX);
    const areaPxSafe = Math.max(0, areaPx);
    if (scaleMetersPerPixel) {
      const areaM2 = areaPxSafe * (scaleMetersPerPixel ** 2);
      const converted = areaMeters2ToUnit(areaM2, areaUnit);
      areaTableBody.innerHTML += `<tr><td>P${idx + 1}</td><td>${converted.value.toFixed(4)} ${converted.label}</td></tr>`;
      cumM2 += areaM2;
    } else {
      areaTableBody.innerHTML += `<tr><td>P${idx + 1}</td><td>${areaPxSafe.toFixed(3)} px² (no scale)</td></tr>`;
    }
    prevX = x;
  }

  // update total area display
  if (scaleMetersPerPixel) {
    const totalConverted = areaMeters2ToUnit(cumM2, areaUnit);
    totalAreaSpan.textContent = `${totalConverted.value.toFixed(4)} ${totalConverted.label}`;
  } else {
    const totalPx = polygonArea(boundaryFinal);
    totalAreaSpan.textContent = `${totalPx.toFixed(3)} px² (no scale)`;
  }
}


// ====== Measurement helpers (unchanged) ======
  function closestPointOnBoundary(pt, poly) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const proj = closestPointOnSegment(pt, a, b);
      const d = Math.hypot(proj.x - pt.x, proj.y - pt.y);
      if (d < bestD) { bestD = d; best = proj; }
    }
    return best;
  }

  function closestPointOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    if (t <= 0) return { x: a.x, y: a.y };
    if (t >= 1) return { x: b.x, y: b.y };
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  function findClosestSegmentIndex(poly, pt) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const proj = closestPointOnSegment(pt, poly[i], poly[(i + 1) % poly.length]);
      const d = Math.hypot(proj.x - pt.x, proj.y - pt.y);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    return bestIdx;
  }

  function buildPath(poly, start, end, startIdx, endIdx, clockwise = true) {
    const path = [start];
    if (startIdx === endIdx) {
      path.push(end);
      return path;
    }
    if (clockwise) {
      let idx = startIdx;
      while (true) {
        idx = (idx + 1) % poly.length;
        path.push(poly[idx]);
        if (idx === endIdx) break;
      }
    } else {
      let idx = startIdx;
      while (true) {
        idx = (idx - 1 + poly.length) % poly.length;
        path.push(poly[idx]);
        if (idx === endIdx) break;
      }
    }
    path.push(end);
    return path;
  }

  function getShortestBoundaryPath(poly, p1, p2) {
    const i1 = findClosestSegmentIndex(poly, p1);
    const i2 = findClosestSegmentIndex(poly, p2);
    const path1 = buildPath(poly, p1, p2, i1, i2, true);
    const path2 = buildPath(poly, p1, p2, i1, i2, false);
    return measurePathLength(path1) <= measurePathLength(path2) ? path1 : path2;
  }

  function measurePathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return len;
  }

  measureBtn && measureBtn.addEventListener('click', () => {
    if (!boundaryFinal) return alert('Finalize boundary first.');
    measureMode = !measureMode;
    measurePoints = [];
    measurePath = [];
    distanceInput && (distanceInput.value = '');
    measureBox && (measureBox.style.display = measureMode ? 'block' : 'none');
    measureBtn && measureBtn.classList.toggle('active', measureMode);
    updateModeIndicator();  // 🟢 new
    redraw();
  });

  

  // ====== Reset handler ======
  resetBtn && resetBtn.addEventListener('click', () => {
    boundaryPoints = [];
    boundaryFinal = null;
    partitions = [];
    undoneStack = [];
    imgLoaded = false;
    pan = { x: 0, y: 0 };
    scale = 1;
    measureMode = false;
    measurePoints = [];
    measurePath = [];
    measureBox && (measureBox.style.display = 'none');
    totalAreaSpan && (totalAreaSpan.textContent = '—');
    areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr><tr><td>P2</td><td>—</td></tr>`);
    distanceInput && (distanceInput.value = '');
    scaleMetersPerPixel = null;
    redraw();
  });

  // ====== Customize toggle ======
  customizeBtn && customizeBtn.addEventListener('click', () => {
    if (!boundaryFinal || partitions.length === 0) return alert('Generate partitions first.');
    customizeMode = !customizeMode;
    customizeBtn.classList.toggle('active', customizeMode);
    // when leaving customize mode, stop any active dragging
    if (!customizeMode) {
      partitions.forEach(p => p.dragging = false);
      activePartition = null;
      activeHandle = null;
    }
    updateModeIndicator();  // 🟢 new
    redraw();
  });

  // ====== Keyboard shortcuts ======
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      drawMode = false;
      drawBtn && drawBtn.classList.remove('active');
      drawingPreview = false;
      redraw();
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (boundaryPoints.length) {
        undoneStack.push(boundaryPoints.pop());
        redraw();
      }
    }
  });

  // initial UI values
  areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);

});