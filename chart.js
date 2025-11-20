(async function () {
  const d3sel = d3.select;

  const timeSpeed = 40;
  const cursorRadius = 4.5;
  const traceOpacity = 0.15;
  const traceWidth = 1.8;
  const pauseTime = 3000;

  let container = d3sel("div.chart");
  if (container.empty()) container = d3sel("body");
  const wrap = container.append("div").attr("id", "wrap");

  const title = wrap.append("h2")
    .attr("class", "chart-title")
    .text("Bitcoin Price vs Keyword Search Volume : Daily Trace");

  const svg = wrap.append("svg")
    .attr("id", "chart")
    .attr("viewBox", "0 0 900 560")
    .attr("width", "100%");

  const controls = wrap.append("div").attr("id", "controls");
  const playBtn = controls.append("button").attr("id", "play").text("Play");
  const scrub = controls.append("input").attr("id", "scrub").attr("type", "range").attr("min", 0).attr("max", 0).attr("value", 0).attr("step", 1);
  const yToggleBtn = controls.append("button").attr("id", "toggle-y-scale").text("Y: Linear");
  const dateLabel = controls.append("div").attr("id", "dateLabel").text("—");

  const M = { top: 25, right: 40, bottom: 50, left: 40 };
  const viewBox = svg.node().viewBox.baseVal;
  const innerW = viewBox.width - M.left - M.right;
  const innerH = viewBox.height - M.top - M.bottom;

  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const gx = g.append("g").attr("class", "x").attr("transform", `translate(0,${innerH})`);
  const gy = g.append("g").attr("class", "y");
  const gridX = g.append("g").attr("class", "gridX").attr("transform", `translate(0,${innerH})`);
  const gridY = g.append("g").attr("class", "gridY");

  g.append("text").attr("x", -10).attr("y", -12).attr("text-anchor", "start").text("Relative Search Volume (Normalized, Peak = 100)")
    .attr("class", "axis-label");
  g.append("text").attr("y", innerH + 44).attr("x", -10).attr("text-anchor", "start").text("BTC price (USD)")
    .attr("class", "axis-label");

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

  const traces = datasets.map(ds => 
    g.append("g")
      .attr("class", ds.traceClass)
  );

  const vline = g.append("line")
    .attr("class", "cursor-vline")
    .attr("y1", 0)
    .attr("y2", innerH)
    .style("stroke", "#838383ff")
    .style("stroke-width", 0.5)
    .style("opacity", 0);

  const cursors = datasets.map(ds =>
    g.append("circle")
      .attr("class", ds.cursorClass)
      .attr("r", cursorRadius)
  );


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

  const scalernum = 98.053525;

  let data = await d3.csv("btc_data_daily_scaled.csv", d3.autoType);
  data = data.map(d => ({
    date: d.date instanceof Date ? d.date : new Date(d.date),
    price: +d.close,
    volume1: +d.bitcoin,
    volume2: d.bitcoin_price / scalernum,
    volume3: d.nft / scalernum != null ? +d.nft / scalernum : NaN,
    volume4: d.blockchain / scalernum != null ? +d.blockchain / scalernum : NaN
  })).filter(d => Number.isFinite(d.price) && Number.isFinite(d.volume1) && d.date)
    .sort((a, b) => a.date - b.date);

  if (!data.length) {
    dateLabel.text("No valid rows in btc_data_daily.csv");
    playBtn.attr("disabled", true);
    scrub.attr("disabled", true);
    return;
  }

  const xExtent = d3.extent(data, d => d.volume1);
  const yExtent = d3.extent(data, d => d.price);
  const xPad = (xExtent[1] - xExtent[0]) * 0.06 || 1;
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 1;

  const xMinLog = 200;
  const yMinLog = 0.1;

  const xMinLinear = 0;
  const yMinLinear = 0;

  const yMax = 3; 
  const xMax = 1000;

  let yScaleType = "linear";
  
  function createXScale() {
    if (yScaleType === "log") {
      return d3.scaleLog()
        .domain([xMinLog, xMax])
        .range([0, innerW])
        .base(10)
        .clamp(true);
    } else {
      return d3.scaleLinear()
        .domain([xMinLinear, xMax])
        .range([0, innerW]);
    }
  }

  function createYScale() {
    if (yScaleType === "log") {
      return d3.scaleLog()
        .domain([yMinLog, yMax])
        .range([innerH, 0])
        .base(10)
        .clamp(true);
    } else {
      return d3.scaleLinear()
        .domain([yMinLinear, yMax])
        .range([innerH, 0]);
    }
  }

  let x = createXScale();
  let y = createYScale();

  gx.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  gy.call(d3.axisLeft(y).ticks(8).tickSizeOuter(0).tickFormat((d, i) => (i % 2 === 1 ? d3.format(".1f")(d) : "")));

  gridX.call(d3.axisBottom(x).ticks(8).tickSize(-innerH).tickFormat(""));
  gridY.call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat(""));

  function getDynamicMaxForDate(date) {
    if (!date) return { xMax: xMax, yMax: yMax };
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (d >= new Date('2015-01-01') && d <= new Date('2016-12-31')) return { xMax: 1000, yMax: 3 };
    if (d >= new Date('2017-01-01') && d <= new Date('2017-12-31')) return { xMax: 20000, yMax: 80 };
    if (d >= new Date('2018-01-01') && d <= new Date('2021-01-02')) return { xMax: 40000, yMax: 80 };
    if (d >= new Date('2021-01-03') && d <= new Date('2022-12-31')) return { xMax: 70000, yMax: 100 };
    if (d >= new Date('2023-01-01') && d <= new Date('2024-12-31')) return { xMax: 110000, yMax: 100 };
    return { xMax: xMax, yMax: yMax };
  }

  let prevDyn = { xMax: xMax, yMax: yMax };

  const makeCurves = datasets.map(ds => 
    d3.line()
      .x(d => x(d.price))
      .y(d => y(d[ds.volumeField]))
      .curve(d3.curveCatmullRom.alpha(0.5))
  );

  scrub.attr("max", Math.max(0, data.length - 1)).property("value", 0);

  const transitionTime = 1000;

  const fmtDate = d3.utcFormat("%Y-%m-%d");
  function updateLabel(d) {
    dateLabel.text(d ? fmtDate(d.date) : "—");
  }

  function render(index) {
    const currentDate = data[index] && data[index].date ? data[index].date : null;
    const dynMax = getDynamicMaxForDate(currentDate);
    const currentXMin = (yScaleType === "log") ? xMinLog : xMinLinear;
    const currentYMin = (yScaleType === "log") ? yMinLog : yMinLinear;

    x.domain([currentXMin, dynMax.xMax]);
    y.domain([currentYMin, dynMax.yMax]);

    const dynChanged = dynMax.xMax !== prevDyn.xMax || dynMax.yMax !== prevDyn.yMax;
    const transitionDuration = dynChanged ? transitionTime : 0;
    const t = d3.transition().duration(transitionDuration).ease(d3.easeCubicOut);

    gx.transition(t).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
    gy.transition(t).call(d3.axisLeft(y).ticks(8).tickSizeOuter(0).tickFormat((d, i) => (i % 2 === 1 ? d3.format(".1f")(d) : "")));
    gridX.transition(t).call(d3.axisBottom(x).ticks(8).tickSize(-innerH).tickFormat(""));
    gridY.transition(t).call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat(""));

    datasets.forEach((ds, i) => {
      traces[i].selectAll("path").transition(t).attr("d", makeCurves[i]);
    });

    datasets.forEach((ds, i) => {
      cursors[i].transition(t)
        .attrTween("cx", function() {
          const start = +this.getAttribute('cx') || 0;
          const end = x(data[index].price);
          return d3.interpolateNumber(start, end);
        })
        .attrTween("cy", function() {
          const start = +this.getAttribute('cy') || 0;
          const end = y(data[index][ds.volumeField]);
          return d3.interpolateNumber(start, end);
        });

      if (labels && labels[i]) {
        labels[i].transition(t)
          .attrTween("x", function() {
            const start = +this.getAttribute('x') || 0;
            const end = x(data[index].price);
            return d3.interpolateNumber(start, end);
          })
          .attrTween("y", function() {
            const start = +this.getAttribute('y') || 0;
            const end = y(data[index][ds.volumeField]);
            return d3.interpolateNumber(start, end);
          });
      }
    });

    if (dynChanged) {
      prevDyn = { xMax: dynMax.xMax, yMax: dynMax.yMax };
    }

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
          .style("stroke-width", traceWidth)
          .style("opacity", (d, j) => {
            if (isLastDate) return traceOpacity;
            const segEnd = j + 1;
            const age = index - segEnd;
            return Math.max(0.02, ds.baseOpacity - age * 0.002);
          }),
        update => update
          .transition(t)
          .attr("d", makeCurves[i])
          .style("stroke-width", traceWidth)
          .style("opacity", (d, j) => {
            if (isLastDate) return traceOpacity;
            const segEnd = j + 1;
            const age = index - segEnd;
            return Math.max(0.02, ds.baseOpacity - age * 0.002);
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
      vline
        .attr("x1", x(d.price))
        .attr("x2", x(d.price))
        .style("opacity", 1);
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

  render(0);

  const WHEEL_THRESHOLD = 36;
  const WHEEL_SENSITIVITY = 2;
  let wheelAccum = 0;

  function onWheelMove(e) {
    if (e.target && e.target.closest && e.target.closest('.storyline')) {
      return;
    }
    e.preventDefault();
    wheelAccum += e.deltaY;

    const crosses = Math.trunc(wheelAccum / WHEEL_THRESHOLD);
    if (crosses === 0) return;

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

  const storylineEl = d3sel(".storyline");

  const phase1IntroEl = d3sel("#phase1-intro");
  const phase2IntroEl = d3sel("#phase2-intro");
  const phase3IntroEl = d3sel("#phase3-intro");
  const phase4IntroEl = d3sel("#phase4-intro");

  const news20160525El = d3sel("[id='2016-05-25']");
  const news20171130El = d3sel("[id='2017-11-30']");
  const news20201216El = d3sel("[id='2020-12-16']");
  const news20210311El = d3sel("[id='2021-03-11']");
  const news20241217El = d3sel("[id='2024-12-17']");

  function setOpacity(sel, val) { if (sel) sel.style("opacity", val); }

  setOpacity(phase1IntroEl, 1);
  setOpacity(phase2IntroEl, 0);
  setOpacity(phase3IntroEl, 0);
  setOpacity(phase4IntroEl, 0);

  setOpacity(news20160525El, 0);
  setOpacity(news20171130El, 0);
  setOpacity(news20201216El, 0);
  setOpacity(news20210311El, 0);
  setOpacity(news20241217El, 0);

  if (storylineEl) storylineEl.style("overflow", "hidden");

  function scrollPhaseIntoView(el) {
    if (!storylineEl || !el) return;
    const container = storylineEl.node();
    const target = el.node();
    const offset = target.offsetTop - container.offsetTop;
    container.scrollTo({ top: offset, behavior: "smooth" });
  }

  const d20160525 = new Date("2016-05-25");
  const d20171130 = new Date("2017-11-30");
  const d20190101 = new Date("2019-01-01");
  const d20201216 = new Date("2020-12-16");
  const d20210101 = new Date("2021-01-01");
  const d20210311 = new Date("2021-03-11");
  const d20220901 = new Date("2022-09-01");
  const d20241217 = new Date("2024-12-17");

  let pause20160525Done = false;
  let pause20171130Done = false;
  let pause20201216Done = false;
  let pause20210101Done = false;
  let pause20210311Done = false;
  let pause20220901Done = false;
  let pause20241217Done = false;

  let phase2Activated = false;
  let phase3Activated = false;
  let phase4Activated = false;
  let news20160525Activated = false;
  let news20171130Activated = false;
  let news20201216Activated = false;
  let news20210311Activated = false;
  let news20241217Activated = false;

  let lastActiveSection = null;

  function show(el) { if (el) el.style("opacity", 1); }
  function hide(el) { if (el) el.style("opacity", 0); }

  function updateStoryForDate(currentDate, fromPlayLoop) {
    if (!currentDate) return;

    if (currentDate < d20160525) {
      show(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(phase4IntroEl);
      hide(news20241217El);
      if (lastActiveSection !== 'phase1intro') {
        lastActiveSection = 'phase1intro';
        scrollPhaseIntoView(phase1IntroEl);
      }
      return;
    }

    if (currentDate >= d20160525 && currentDate < d20171130) {
      hide(phase1IntroEl);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(phase4IntroEl);
      hide(news20241217El);

      show(news20160525El);
      if (lastActiveSection !== 'news20160525') {
        lastActiveSection = 'news20160525';
        scrollPhaseIntoView(news20160525El);
      }

      if (fromPlayLoop && !pause20160525Done && currentDate >= d20160525) {
        pause20160525Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }

    if (currentDate >= d20171130 && currentDate < d20190101) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(phase4IntroEl);
      hide(news20241217El);

      show(news20171130El);
      if (lastActiveSection !== 'news20171130') {
        lastActiveSection = 'news20171130';
        scrollPhaseIntoView(news20171130El);
      }

      if (fromPlayLoop && !pause20171130Done && currentDate >= d20171130) {
        pause20171130Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }

    if (currentDate >= d20190101 && currentDate < d20201216) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(phase4IntroEl);
      hide(news20241217El);

      show(phase2IntroEl);
      if (lastActiveSection !== 'phase2intro') {
        lastActiveSection = 'phase2intro';
        scrollPhaseIntoView(phase2IntroEl);
      }
      return;
    }

    if (currentDate >= d20201216 && currentDate < d20210101) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(phase4IntroEl);
      hide(news20241217El);

      show(news20201216El);
      if (lastActiveSection !== 'news20201216') {
        lastActiveSection = 'news20201216';
        scrollPhaseIntoView(news20201216El);
      }

      if (fromPlayLoop && !pause20201216Done && currentDate >= d20201216) {
        pause20201216Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }

    if (currentDate >= d20210101 && currentDate < d20210311) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(news20210311El);
      hide(phase4IntroEl);
      hide(news20241217El);

      show(phase3IntroEl);
      if (lastActiveSection !== 'phase3intro') {
        lastActiveSection = 'phase3intro';
        scrollPhaseIntoView(phase3IntroEl);
      }

      if (fromPlayLoop && !pause20210101Done && currentDate >= d20210101) {
        pause20210101Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }

    if (currentDate >= d20210311 && currentDate < d20220901) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(phase4IntroEl);
      hide(news20241217El);

      show(news20210311El);
      if (lastActiveSection !== 'news20210311') {
        lastActiveSection = 'news20210311';
        scrollPhaseIntoView(news20210311El);
      }

      if (fromPlayLoop && !pause20210311Done && currentDate >= d20210311) {
        pause20210311Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }

    if (currentDate >= d20220901 && currentDate < d20241217) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(news20241217El);

      show(phase4IntroEl);
      if (lastActiveSection !== 'phase4intro') {
        lastActiveSection = 'phase4intro';
        scrollPhaseIntoView(phase4IntroEl);
      }

      if (fromPlayLoop && !pause20220901Done && currentDate >= d20220901) {
        pause20220901Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }

    if (currentDate >= d20241217) {
      hide(phase1IntroEl);
      hide(news20160525El);
      hide(news20171130El);
      hide(phase2IntroEl);
      hide(news20201216El);
      hide(phase3IntroEl);
      hide(news20210311El);
      hide(phase4IntroEl);

      show(news20241217El);
      if (lastActiveSection !== 'news20241217') {
        lastActiveSection = 'news20241217';
        scrollPhaseIntoView(news20241217El);
      }

      if (fromPlayLoop && !pause20241217Done && currentDate >= d20241217) {
        pause20241217Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, pauseTime);
      }
      return;
    }
  }

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
      updateStoryForDate(d.date, true);
    }, timeSpeed);
  }

  function stop() {
    if (timer) {
      timer.stop();
      timer = null;
    }
    playBtn.text("Play");
    scrub.attr("disabled", null);
  }

  playBtn.on("click", () => (timer ? stop() : play()));

  scrub.on("input", (e) => {
    const i = +e.target.value;
    render(i);
    const d = data[i];
    updateStoryForDate(d.date, false);
  });

  yToggleBtn.on("click", () => {
    yScaleType = yScaleType === "linear" ? "log" : "linear";
    x = createXScale();
    y = createYScale();

    const i = +scrub.property("value");
    render(i);

    yToggleBtn.text(yScaleType === "linear" ? "Y: Linear" : "Y: Log");
  });
})();
