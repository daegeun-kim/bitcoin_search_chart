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

  g.append("text").attr("x", -10).attr("y", -12).attr("text-anchor", "start").text("Relative Search Volume (Normalized, Peak = 100)")
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





  // --------------------------------------------------
  // ------- scale and axis ---------------------------
  // --------------------------------------------------
  const xExtent = d3.extent(data, d => d.volume1);
  const yExtent = d3.extent(data, d => d.price);
  const xPad = (xExtent[1] - xExtent[0]) * 0.06 || 1;
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 1;

  const yMin = 0.1; 
  const yMax = 3; 
  const xMin = 100;   
  const xMax = 1000;

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

  // const y = d3.scaleLinear()
  // .domain([yMin, yMax])
  // .range([innerH, 0]);
  gx.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  gy.call(d3.axisLeft(y).ticks(8).tickSizeOuter(0));

  gridX.call(d3.axisBottom(x).ticks(8).tickSize(-innerH).tickFormat(""));
  gridY.call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat(""));

  // Helper: return dynamic x/y max values for a given date (keep mins unchanged)
  function getDynamicMaxForDate(date) {
    if (!date) return { xMax: xMax, yMax: yMax };
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (d >= new Date('2015-01-01') && d <= new Date('2016-12-31')) return { xMax: 1000, yMax: 3 };
    if (d >= new Date('2017-01-01') && d <= new Date('2017-12-31')) return { xMax: 20000, yMax: 80 };
    if (d >= new Date('2018-01-01') && d <= new Date('2020-12-31')) return { xMax: 30000, yMax: 80 };
    if (d >= new Date('2021-01-01') && d <= new Date('2022-12-31')) return { xMax: 70000, yMax: 100 };
    if (d >= new Date('2023-01-01') && d <= new Date('2024-12-31')) return { xMax: 100000, yMax: 100 };
    return { xMax: xMax, yMax: yMax };
  }

  // track previous dynamic max so we only animate on change
  let prevDyn = { xMax: xMax, yMax: yMax };

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
  // update scales' max domain based on the current date (mins remain unchanged)
  const currentDate = data[index] && data[index].date ? data[index].date : null;
  const dynMax = getDynamicMaxForDate(currentDate);
  x.domain([xMin, dynMax.xMax]);
  y.domain([yMin, dynMax.yMax]);

  // If the dynamic max changed from the previous frame, animate axes and chart
  const dynChanged = dynMax.xMax !== prevDyn.xMax || dynMax.yMax !== prevDyn.yMax;
  const transitionDuration = dynChanged ? transitionTime : 0;
  const t = d3.transition().duration(transitionDuration).ease(d3.easeCubicOut);

  // animate axes & grids with transition
  gx.transition(t).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
  gy.transition(t).call(d3.axisLeft(y).ticks(8).tickSizeOuter(0));
  gridX.transition(t).call(d3.axisBottom(x).ticks(8).tickSize(-innerH).tickFormat(""));
  gridY.transition(t).call(d3.axisLeft(y).ticks(8).tickSize(-innerW).tickFormat(""));

  // animate existing traces' path shapes to new scales
  datasets.forEach((ds, i) => {
    traces[i].selectAll("path").transition(t).attr("d", makeCurves[i]);
  });

  // animate cursors and labels
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
    // store new dyn as previous after transition
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
        .style("opacity", (d, j) => {
          if (isLastDate) return 0.2;
          const segEnd = j + 1;
          const age = index - segEnd;
          return Math.max(0.05, ds.baseOpacity - age * 0.002);
        }),
      update => update
        .transition(t)
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
  // --------------------------------------------------
  // ---------- Transition & Interaction Config ------
  // --------------------------------------------------
  const transitionTime = 1000; // milliseconds for smooth transitions (axes, traces, cursors, labels)

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
  const storylineEl = d3sel(".storyline");

  // Phase intro elements
  const phase1IntroEl = d3sel("#phase1-intro");
  const phase2IntroEl = d3sel("#phase2-intro");
  const phase3IntroEl = d3sel("#phase3-intro");
  const phase4IntroEl = d3sel("#phase4-intro");

  // News elements (IDs start with digits → use attribute selectors)
  const news20160525El = d3sel("[id='2016-05-25']");
  const news20171130El = d3sel("[id='2017-11-30']");
  const news20201216El = d3sel("[id='2020-12-16']");
  const news20210311El = d3sel("[id='2021-03-11']");
  const news20241217El = d3sel("[id='2024-12-17']");

  function setOpacity(sel, val) { if (sel) sel.style("opacity", val); }

  // Initial visibility:
  // - Phase 1 intro visible from the beginning
  // - Everything else hidden
  setOpacity(phase1IntroEl, 1);
  setOpacity(phase2IntroEl, 0);
  setOpacity(phase3IntroEl, 0);
  setOpacity(phase4IntroEl, 0);

  setOpacity(news20160525El, 0);
  setOpacity(news20171130El, 0);
  setOpacity(news20201216El, 0);
  setOpacity(news20210311El, 0);
  setOpacity(news20241217El, 0);

  // Remove scrollbar; we scroll programmatically
  if (storylineEl) storylineEl.style("overflow", "hidden");

  // Scroll a phase so its top aligns with the top of the storyline column
  function scrollPhaseIntoView(el) {
    if (!storylineEl || !el) return;
    const container = storylineEl.node();
    const target = el.node();
    const offset = target.offsetTop - container.offsetTop;
    container.scrollTo({ top: offset, behavior: "smooth" });
  }

  // Timeline markers
  const d20160525 = new Date("2016-05-25");
  const d20171130 = new Date("2017-11-30");
  const d20190101 = new Date("2019-01-01");
  const d20201216 = new Date("2020-12-16");
  const d20210101 = new Date("2021-01-01");
  const d20210311 = new Date("2021-03-11");
  const d20220901 = new Date("2022-09-01");
  const d20241217 = new Date("2024-12-17");

  // Pause flags (each pause happens only once)
  let pause20160525Done = false;
  let pause20171130Done = false;
  let pause20201216Done = false;
  let pause20210101Done = false;
  let pause20210311Done = false;
  let pause20220901Done = false;
  let pause20241217Done = false;

  // Track first entry into Phase 2 for snapping to top
  let phase2Activated = false;
  let phase3Activated = false;
  let phase4Activated = false;
  let news20160525Activated = false;
  let news20171130Activated = false;
  let news20201216Activated = false;
  let news20210311Activated = false;
  let news20241217Activated = false;

  // Track last active section to detect transitions
  let lastActiveSection = null;

  function show(el) { if (el) el.style("opacity", 1); }
  function hide(el) { if (el) el.style("opacity", 0); }

  // Update storyline based on current date.
  // fromPlayLoop === true only when called from the automatic Play timer.
  function updateStoryForDate(currentDate, fromPlayLoop) {
    if (!currentDate) return;

    // ---------- Before 2016-05-25 ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'phase1intro') {
        lastActiveSection = 'phase1intro';
        scrollPhaseIntoView(phase1IntroEl); // snap Phase 1 to top
      }
      return;
    }

    // ---------- 2016-05-25 → hide phase intro, show 2016 text, pause once, keep until 2019-01-01 ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'news20160525') {
        lastActiveSection = 'news20160525';
        scrollPhaseIntoView(news20160525El); // snap news to top
      }

      if (fromPlayLoop && !pause20160525Done && currentDate >= d20160525) {
        pause20160525Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
      }
      return;
    }

    // ---------- 2017-11-30 → hide 2016 news, show 2017 text, pause once, keep until 2019-01-01 ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'news20171130') {
        lastActiveSection = 'news20171130';
        scrollPhaseIntoView(news20171130El); // snap news to top
      }

      if (fromPlayLoop && !pause20171130Done && currentDate >= d20171130) {
        pause20171130Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
      }
      return;
    }

    // ---------- 2019-01-01 → hide Phase 1 + its news, show Phase 2 intro, snap to top ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'phase2intro') {
        lastActiveSection = 'phase2intro';
        scrollPhaseIntoView(phase2IntroEl); // snap Phase 2 to top
      }
      return;
    }

    // ---------- 2020-12-16 → hide phase2 intro, show 2020-12-16 text, pause once, keep until 2021-01-01 ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'news20201216') {
        lastActiveSection = 'news20201216';
        scrollPhaseIntoView(news20201216El); // snap news to top
      }

      if (fromPlayLoop && !pause20201216Done && currentDate >= d20201216) {
        pause20201216Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
      }
      return;
    }

    // ---------- 2021-01-01 → hide Phase 2 + its news, show Phase 3 intro, pause once ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'phase3intro') {
        lastActiveSection = 'phase3intro';
        scrollPhaseIntoView(phase3IntroEl); // snap Phase 3 to top
      }

      if (fromPlayLoop && !pause20210101Done && currentDate >= d20210101) {
        pause20210101Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
      }
      return;
    }

    // ---------- 2021-03-11 → hide phase3 intro, show 2021-03-11 text, pause once ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'news20210311') {
        lastActiveSection = 'news20210311';
        scrollPhaseIntoView(news20210311El); // snap news to top
      }

      if (fromPlayLoop && !pause20210311Done && currentDate >= d20210311) {
        pause20210311Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
      }
      return;
    }

    // ---------- 2022-09-01 → hide Phase 3 + its news, show Phase 4 intro, pause once ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'phase4intro') {
        lastActiveSection = 'phase4intro';
        scrollPhaseIntoView(phase4IntroEl); // snap Phase 4 to top
      }

      if (fromPlayLoop && !pause20220901Done && currentDate >= d20220901) {
        pause20220901Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
      }
      return;
    }

    // ---------- 2024-12-17 → hide phase4 intro, show 2024-12-17 text, pause once ----------
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
      
      // Scroll to top when transitioning to this section
      if (lastActiveSection !== 'news20241217') {
        lastActiveSection = 'news20241217';
        scrollPhaseIntoView(news20241217El); // snap news to top
      }

      if (fromPlayLoop && !pause20241217Done && currentDate >= d20241217) {
        pause20241217Done = true;
        stop();
        setTimeout(() => { if (!timer) play(); }, 8000);
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
      // Update storyline & handle pauses at milestone dates
      updateStoryForDate(d.date, true);

      datasets.forEach((ds, idx) => {
        cursors[idx]
          .transition()
          .duration(transitionTime)
          .ease(d3.easeCubicOut)
          .attr("cx", x(d.price))
          .attr("cy", y(d[ds.volumeField]));
      });
    }, 40);
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
    // Manual scrubbing updates text but does NOT trigger pauses
    updateStoryForDate(d.date, false);
  });
})();
