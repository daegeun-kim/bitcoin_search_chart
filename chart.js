(async function () {
  const d3sel = d3.select;

  
  // ---------- Create containers ----------
  const body = d3sel("body");
  const wrap = body.append("div").attr("id", "wrap");

  const title = wrap.append("h2").text("Bitcoin Price vs Search Volume — Daily Trace");

  const svg = wrap.append("svg")
    .attr("id", "chart")
    .attr("viewBox", "0 0 900 560")
    .attr("width", "100%");

  const controls = wrap.append("div").attr("id", "controls");
  const playBtn = controls.append("button").attr("id", "play").text("Play");
  const scrub = controls.append("input").attr("id", "scrub").attr("type", "range").attr("min", 0).attr("max", 0).attr("value", 0).attr("step", 1);
  const dateLabel = controls.append("div").attr("id", "dateLabel").text("—");



  // ---------- Dimensions ----------
  const W = 900, H = 560;
  const M = { top: 36, right: 24, bottom: 60, left: 76 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;



  // ---------- Groups ----------
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const gx = g.append("g").attr("class", "x").attr("transform", `translate(0,${innerH})`);
  const gy = g.append("g").attr("class", "y");
  const gridX = g.append("g").attr("class", "gridX").attr("transform", `translate(0,${innerH})`);
  const gridY = g.append("g").attr("class", "gridY");

  g.append("text").attr("x", -10).attr("y", -12).attr("text-anchor", "start").text("Volume (daily)")
    .attr("class", "axis-label");
  g.append("text").attr("y", innerH + 44).attr("x", -10).attr("text-anchor", "start").text("BTC price (USD)")
    .attr("class", "axis-label");

  // Dataset configurations
  const datasets = [
    { 
      id: 1,
      volumeField: 'volume1',
      traceClass: 'traces traces1',
      curveClass: 'curve curve1',
      cursorClass: 'cursor cursor1'
    },
    { 
      id: 2,
      volumeField: 'volume2',
      traceClass: 'traces traces2',
      curveClass: 'curve curve2',
      cursorClass: 'cursor cursor2'
    }
  ];

  // Create traces and cursors for each dataset
  const traces = datasets.map(ds => 
    g.append("g")
      .attr("class", ds.traceClass)
  );

  const cursors = datasets.map(ds =>
    g.append("circle")
      .attr("class", ds.cursorClass)
      .attr("r", 4.5)
  );



  // ---------- Load data ----------
  let data = await d3.csv("btc_data_daily.csv", d3.autoType);
  data = data.map(d => ({
    date: d.date instanceof Date ? d.date : new Date(d.date),
    price: +d.close,
    volume1: +d.bitcoin,
    volume2: d.bitcoin_price
  })).filter(d => Number.isFinite(d.price) && Number.isFinite(d.volume1) && d.date)
    .sort((a, b) => a.date - b.date);

  if (!data.length) {
    dateLabel.text("No valid rows in btc_data_daily.csv");
    playBtn.attr("disabled", true);
    scrub.attr("disabled", true);
    return;
  }



  // ---------- Scales & axes ----------
  const xExtent = d3.extent(data, d => d.volume1);
  const yExtent = d3.extent(data, d => d.price);
  const xPad = (xExtent[1] - xExtent[0]) * 0.06 || 1;
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 1;

  const xMin = 40; 
  const xMax = 5000; 
  const yMin = 200;   
  const yMax = 110000;

  // const x = d3.scaleLinear()
  //   .domain([xMin, xMax])
  //   .range([0, innerW]);

  const x = d3.scaleLog()
  .domain([yMin, yMax])
  .range([0, innerW])
  .base(10)
  .clamp(true); 

  const y = d3.scaleLog()
  .domain([xMin, xMax])
  .range([innerH, 0])
  .base(10)
  .clamp(true); 


  gx.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  gy.call(d3.axisLeft(y).ticks(8).tickSizeOuter(0));

  gridX.call(d3.axisBottom(x).ticks(8).tickSize(innerH).tickFormat(""));
  gridY.call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat(""));

  // Create line generators for each dataset
  const makeCurves = datasets.map(ds => 
    d3.line()
      .x(d => x(d.price))
      .y(d => y(d[ds.volumeField]))
      .curve(d3.curveCatmullRom.alpha(0.5))
  );



  // ---------- Slider setup ----------
  scrub.attr("max", Math.max(0, data.length - 1)).property("value", 0);

  const fmtDate = d3.timeFormat("%Y-%m-%d");
  function updateLabel(d) {
    if (!d) {
      dateLabel.text("—");
      return;
    }
    const volumes = datasets.map(ds => `vol${ds.id} ${d[ds.volumeField]}`).join(" · ");
    dateLabel.text(`${fmtDate(d.date)} — $${d3.format(",")(Math.round(d.price))} · ${volumes}`);
  }

  function render(index) {
  // windows like [d0,d1], [d0,d1,d2], [d1,d2,d3], ... up to index
  const windows = d3.range(1, index + 1).map(i => {
    const start = Math.max(0, i - 1);     // 3-point window
    return data.slice(start, i + 1);
  });

  // Render all datasets
  datasets.forEach((ds, i) => {
    const segs = traces[i].selectAll("path").data(windows);
    segs.join(
      enter => enter.append("path")
        .attr("class", ds.curveClass)
        .attr("d", makeCurves[i]),
      update => update.attr("d", makeCurves[i]),
      exit => exit.remove()
    );
  });

  const d = data[index];
  // Update all cursors
  datasets.forEach((ds, i) => {
    cursors[i]
      .attr("cx", x(d.price))
      .attr("cy", y(d[ds.volumeField]))
      .style("opacity", 1);
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



  // ---------- Interactions ----------
  let timer = null;
  function play() {
    if (timer) return;
    playBtn.text("Pause");
    scrub.attr("disabled", true);

    let i = +scrub.property("value");
    timer = d3.interval(() => {
      if (i >= data.length - 1) { stop(); return; }
      const next = i + 1;
      animateStep(i, next, 260);
      i = next;
      scrub.property("value", i);
      const d = data[i];
      // Update all cursors
      datasets.forEach((ds, i) => {
        cursors[i]
          .attr("cx", x(d.price))
          .attr("cy", y(d[ds.volumeField]));
      });
      updateLabel(d);
    }, 280);
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
