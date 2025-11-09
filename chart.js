(async function () {
  const d3sel = d3.select;


  
  // ---------- Create containers ----------
  const body = d3sel("body");
  const wrap = body.append("div").attr("id", "wrap").style("max-width", "1100px").style("margin", "24px auto").style("padding", "0 16px");

  const title = wrap.append("h2").text("Bitcoin Price vs Search Volume — Daily Trace")
    .style("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif")
    .style("margin", "4px 0 8px");

  const svg = wrap.append("svg")
    .attr("id", "chart")
    .attr("viewBox", "0 0 900 560")
    .attr("width", "100%")
    .style("background", "#fbfcffff")
    .style("border-radius", "12px");

  const controls = wrap.append("div").style("display", "grid").style("grid-template-columns", "auto 1fr auto").style("gap", "12px").style("align-items", "center").style("margin-top", "10px");
  const playBtn = controls.append("button").attr("id", "play").text("Play")
    .style("padding", "8px 14px").style("border", "0").style("border-radius", "8px").style("background", "#7aa2ff").style("color", "#0b0e13").style("font-weight", "600").style("cursor", "pointer");

  const scrub = controls.append("input").attr("id", "scrub").attr("type", "range").attr("min", 0).attr("max", 0).attr("value", 0).attr("step", 1).style("width", "100%");
  const dateLabel = controls.append("div").attr("id", "dateLabel").text("—")
    .style("text-align", "right").style("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif").style("color", "#9aa4b2");



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

  g.append("text").attr("x", innerW).attr("y", innerH + 44).attr("text-anchor", "end").text("Search volume (daily)")
    .style("fill", "#9aa4b2").style("font", "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif");
  g.append("text").attr("x", -10).attr("y", -12).attr("text-anchor", "start").text("BTC price (USD)")
    .style("fill", "#9aa4b2").style("font", "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif");

  const traces = g.append("g")
  .attr("class", "traces")
  .style("mix-blend-mode", "multiply");

  const cursor = g.append("circle")
    .attr("r", 4.5)
    .style("fill", "#ffd166")
    .style("stroke", "#222")
    .style("stroke-width", 1.25)
    .style("opacity", 0);



  // ---------- Load data ----------
  let data = await d3.csv("btc_data_daily.csv", d3.autoType);
  data = data.map(d => ({
    date: d.date instanceof Date ? d.date : new Date(d.date),
    price: +d.close,
    volume: +d.bitcoin_scaled
  })).filter(d => Number.isFinite(d.price) && Number.isFinite(d.volume) && d.date)
    .sort((a, b) => a.date - b.date);

  if (!data.length) {
    dateLabel.text("No valid rows in btc_data_daily.csv");
    playBtn.attr("disabled", true);
    scrub.attr("disabled", true);
    return;
  }



  // ---------- Scales & axes ----------
  const xExtent = d3.extent(data, d => d.volume);
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
  .domain([xMin, xMax])
  .range([0, innerW])
  .base(10)
  .clamp(true); 

  // const y = d3.scaleLinear()
  //   .domain([yMin, yMax])
  //   .range([innerH, 0]);

  const y = d3.scaleLog()
  .domain([yMin, yMax])
  .range([innerH, 0])
  .base(10)
  .clamp(true); 


  gx.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  gy.call(d3.axisLeft(y).ticks(8).tickSizeOuter(0));

  gridX.call(d3.axisBottom(x).ticks(8).tickSize(innerH).tickFormat("")).selectAll("line").attr("stroke", "#1c2230").attr("stroke-width", 0.3);
  gridY.call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat("")).selectAll("line").attr("stroke", "#1c2230").attr("stroke-width", 0.3);
  g.selectAll(".x path,.x line,.y path,.y line").attr("stroke", "#000000ff");
  g.selectAll(".x text,.y text").attr("fill", "#000000ff").style("font", "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif");

  const makeCurve = d3.line()
  .x(d => x(d.volume))    
  .y(d => y(d.price))
  .curve(d3.curveCatmullRom.alpha(0.5));



  // ---------- Slider setup ----------
  scrub.attr("max", Math.max(0, data.length - 1)).property("value", 0);

  const fmtDate = d3.timeFormat("%Y-%m-%d");
  function updateLabel(d) {
    dateLabel.text(d ? `${fmtDate(d.date)} — $${d3.format(",")(Math.round(d.price))} · vol ${d.volume}` : "—");
  }

  function render(index) {
  // windows like [d0,d1], [d0,d1,d2], [d1,d2,d3], ... up to index
  const windows = d3.range(1, index + 1).map(i => {
    const start = Math.max(0, i - 1);     // 3-point window
    return data.slice(start, i + 1);
  });

  const segs = traces.selectAll("path").data(windows);
  segs.join(
    enter => enter.append("path")
      .attr("class", "curve")
      .attr("d", makeCurve)
      .style("fill", "none")
      .style("stroke", "#ff0000ff")
      .style("stroke-width", 3)
      .style("stroke-linecap", "round")
      .style("stroke-linejoin", "round")
      .style("opacity", 0.2),
    update => update.attr("d", makeCurve),
    exit => exit.remove()
  );

  const d = data[index];
  cursor.attr("cx", x(d.volume)) // or x(d.price_change)
        .attr("cy", y(d.price))
        .style("opacity", 1);
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
      cursor.attr("cx", x(d.volume)).attr("cy", y(d.price));
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
