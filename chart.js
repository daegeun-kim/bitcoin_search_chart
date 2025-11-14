(async function () {
  const d3sel = d3.select;




  // ---------------------------------------
  // ---------- Create containers ----------
  // ---------------------------------------
  let container = d3sel("div.chart");
  if (container.empty()) container = d3sel("body");
  const wrap = container.append("div").attr("id", "wrap");

  const title = wrap.append("h2").text("Bitcoin Price vs Search Volume — Daily Trace");

  const svg = wrap.append("svg")
    .attr("id", "chart")
    .attr("viewBox", "0 0 900 560")
    .attr("width", "100%");

  const controls = wrap.append("div").attr("id", "controls");
  const playBtn = controls.append("button").attr("id", "play").text("Play");
  const scrub = controls.append("input").attr("id", "scrub").attr("type", "range").attr("min", 0).attr("max", 0).attr("value", 0).attr("step", 1);
  const dateLabel = controls.append("div").attr("id", "dateLabel").text("—");





  // ---------------------------------------
  // ---------- Dimensions -----------------
  // ---------------------------------------
  const M = { top: 25, right: 40, bottom: 50, left: 40 };
  const viewBox = svg.node().viewBox.baseVal;
  const innerW = viewBox.width - M.left - M.right;
  const innerH = viewBox.height - M.top - M.bottom;





  // ---------------------------------------
  // ---------- Groups ---------------------
  // ---------------------------------------
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const gx = g.append("g").attr("class", "x").attr("transform", `translate(0,${innerH})`);
  const gy = g.append("g").attr("class", "y");
  const gridX = g.append("g").attr("class", "gridX").attr("transform", `translate(0,${innerH})`);
  const gridY = g.append("g").attr("class", "gridY");

  g.append("text").attr("x", -10).attr("y", -12).attr("text-anchor", "start").text("Volume (daily)")
    .attr("class", "axis-label");
  g.append("text").attr("y", innerH + 44).attr("x", -10).attr("text-anchor", "start").text("BTC price (USD)")
    .attr("class", "axis-label");




  // ---------------------------------------
  // ---------- Dataset Config -------------
  // ---------------------------------------
  const datasets = [
    { 
      id: 2,
      volumeField: 'volume2',
      traceClass: 'traces traces2',
      curveClass: 'curve curve2',
      cursorClass: 'cursor cursor2',
      baseOpacity: 0.5
    },
    {
      id: 3,
      volumeField: 'volume3',
      traceClass: 'traces traces3',
      curveClass: 'curve curve3',
      cursorClass: 'cursor cursor3',
      baseOpacity: 0.5
    },
    {
      id: 4,
      volumeField: 'volume4',
      traceClass: 'traces traces4',
      curveClass: 'curve curve4',
      cursorClass: 'cursor cursor4',
      baseOpacity: 0.5
    }
  ];

  // --------------------------------------------------
  // Creating traces and cursors for each dataset -----
  // --------------------------------------------------
  const traces = datasets.map(ds => 
    g.append("g")
      .attr("class", ds.traceClass)
  );

  const cursors = datasets.map(ds =>
    g.append("circle")
      .attr("class", ds.cursorClass)
      .attr("r", 4.5)
  );






  // --------------------------------------------------
  // ------- text annotation next to cursor -----------
  // --------------------------------------------------
  const FIELD_NAMES = {
    volume2: 'bitcoin price',
    volume3: 'nft',
    volume4: 'blockchain'
  };
  const labels = datasets.map(ds =>
    g.append("text")
      .attr("class", "cursor-label")
      .attr("dx", 8)
      .attr("dy", -8)
      .style("font-size", "12px")
      .style("fill", "white")
      .style("opacity", 0)
      .text(FIELD_NAMES[ds.volumeField] || ds.volumeField)
  );





  // --------------------------------------------------
  // ------- load csv data ----------------------------
  // --------------------------------------------------
  let data = await d3.csv("btc_data_daily_scaled.csv", d3.autoType);
  data = data.map(d => ({
    date: d.date instanceof Date ? d.date : new Date(d.date),
    price: +d.close,
    volume1: +d.bitcoin,
    volume2: d.bitcoin_price,
    volume3: d.nft != null ? +d.nft : NaN,
    volume4: d.blockchain != null ? +d.blockchain : NaN
  })).filter(d => Number.isFinite(d.price) && Number.isFinite(d.volume1) && d.date)
    .sort((a, b) => a.date - b.date);

  if (!data.length) {
    dateLabel.text("No valid rows in btc_data_daily.csv");
    playBtn.attr("disabled", true);
    scrub.attr("disabled", true);
    return;
  }





  // --------------------------------------------------
  // ------- scale and axis ---------------------------
  // --------------------------------------------------
  const xExtent = d3.extent(data, d => d.volume1);
  const yExtent = d3.extent(data, d => d.price);
  const xPad = (xExtent[1] - xExtent[0]) * 0.06 || 1;
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 1;

  const yMin = 10; 
  const yMax = 8000; 
  const xMin = 100;   
  const xMax = 110000;

  // const x = d3.scaleLinear()
  //   .domain([xMin, xMax])
  //   .range([0, innerW]);

  const x = d3.scaleLog()
  .domain([xMin, xMax])
  .range([0, innerW])
  .base(10)
  .clamp(true); 

  const y = d3.scaleLog()
  .domain([yMin, yMax])
  .range([innerH, 0])
  .base(10)
  .clamp(true); 


  gx.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  gy.call(d3.axisLeft(y).ticks(8).tickSizeOuter(0));

  gridX.call(d3.axisBottom(x).ticks(8).tickSize(-innerH).tickFormat(""));
  gridY.call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat(""));

  const makeCurves = datasets.map(ds => 
    d3.line()
      .x(d => x(d.price))
      .y(d => y(d[ds.volumeField]))
      .curve(d3.curveCatmullRom.alpha(0.5))
  );





  // --------------------------------------------------
  // ------- slider setup -----------------------------
  // --------------------------------------------------
  scrub.attr("max", Math.max(0, data.length - 1)).property("value", 0);

  const fmtDate = d3.timeFormat("%Y-%m-%d");
  function updateLabel(d) {
    dateLabel.text(d ? fmtDate(d.date) : "—");
  }

  function render(index) {
  const windows = d3.range(1, index + 1).map(i => {
    const start = Math.max(0, i - 1);
    return data.slice(start, i + 1);
  });

  const isLastDate = data[index]?.date?.getTime() === new Date('2024-12-31').getTime();
  datasets.forEach((ds, i) => {
    const segs = traces[i].selectAll("path").data(windows);
    segs.join(
      enter => enter.append("path")
        .attr("class", ds.curveClass)
        .attr("d", makeCurves[i])
        .style("opacity", (d, j) => {
          if (isLastDate) return 0.2;
          const segEnd = j + 1;
          const age = index - segEnd;
          return Math.max(0.05, ds.baseOpacity - age * 0.002);
        }),
      update => update
        .attr("d", makeCurves[i])
        .style("opacity", (d, j) => {
          if (isLastDate) return 0.2;
          const segEnd = j + 1;
          const age = index - segEnd;
          return Math.max(0.05, ds.baseOpacity - age * 0.002);
        }),
      exit => exit.remove()
    );
  });

  const d = data[index];
  datasets.forEach((ds, i) => {
    cursors[i]
      .attr("cx", x(d.price))
      .attr("cy", y(d[ds.volumeField]))
      .style("opacity", 1);
    // position the label next to the cursor
    if (labels && labels[i]) {
      labels[i]
        .attr("x", x(d.price))
        .attr("y", y(d[ds.volumeField]))
        .style("opacity", 1);
    }
  });
  updateLabel(d);
}

  function animateStep(fromIdx, toIdx, duration = 260) {
    const dPath = makeLine(data.slice(0, toIdx + 1));
    tracePath.attr("d", dPath);

    const node = tracePath.node();
    const L = node.getTotalLength();
    const frac = (toIdx + 1) / data.length;
    const targetLen = L * frac;

    tracePath
      .attr("stroke-dasharray", `${targetLen} ${Math.max(1, L - targetLen)}`)
      .attr("stroke-dashoffset", 0)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr("stroke-dasharray", `${L} 0`)
      .on("end", () => tracePath.attr("stroke-dasharray", null));
  }


  // Initial render
  render(0);





  
  // --------------------------------------------------
  // ---------- Wheel / scroll interaction ------------
  // --------------------------------------------------
  // Use wheel scrolling to move the time forward/backward when not over the storyline.
  // Allow the storyline element to scroll normally when the pointer is over it.
  // Implement accumulation + sensitivity so touchpad and mouse wheel move time faster.
  const WHEEL_THRESHOLD = 36; // pixels of wheel delta per step
  const WHEEL_SENSITIVITY = 2; // multiplier for how many indices per step
  let wheelAccum = 0;

  function onWheelMove(e) {
    if (e.target && e.target.closest && e.target.closest('.storyline')) {
      return; // do not intercept
    }
    e.preventDefault();
    wheelAccum += e.deltaY;

    const crosses = Math.trunc(wheelAccum / WHEEL_THRESHOLD);
    if (crosses === 0) return; // not enough movement yet

    const step = crosses * WHEEL_SENSITIVITY;
    wheelAccum = wheelAccum - crosses * WHEEL_THRESHOLD;
    let i = +scrub.property('value');
    i = Math.max(0, Math.min(data.length - 1, i + step));
    if (i !== +scrub.property('value')) {
      scrub.property('value', i);
      render(i);
    }
  }
  window.addEventListener('wheel', onWheelMove, { passive: false });






  // --------------------------------------------------
  // ---------- Interactions & Play button ------------
  // --------------------------------------------------
  let timer = null;
  function play() {
    if (timer) return;
    playBtn.text("Pause");
    scrub.attr("disabled", true);

    let i = +scrub.property("value");
    timer = d3.interval(() => {
      if (i >= data.length - 1) { stop(); return; }
      const next = i + 1;
      i = next;
      scrub.property("value", i);
      render(i);
      const d = data[i];
      datasets.forEach((ds, idx) => {
        cursors[idx]
          .transition()
          .duration(150)
          .ease(d3.easeCubicOut)
          .attr("cx", x(d.price))
          .attr("cy", y(d[ds.volumeField]));
      });
    }, 40);
  }

  function stop() {
    if (timer) { timer.stop(); timer = null; }
    playBtn.text("Play");
    scrub.attr("disabled", null);
  }

  playBtn.on("click", () => (timer ? stop() : play()));
  scrub.on("input", (e) => {
    const i = +e.target.value;
    render(i);
  });
})();
