(async function () {
  const container = d3.select("#baseChart");
  container.selectAll("*").remove();

  const dataRaw = await d3.csv("btc_data_daily_scaled.csv", d3.autoType);

  const data = dataRaw
    .map(d => ({
      date: d.date instanceof Date ? d.date : new Date(d.date),
      close: +d.close,
      bitcoin_price: d.bitcoin_price == null ? NaN : +d.bitcoin_price,
      nft: d.nft == null ? NaN : +d.nft,
      blockchain: d.blockchain == null ? NaN : +d.blockchain
    }))
    .filter(d => d.date && Number.isFinite(d.close))
    .sort((a, b) => a.date - b.date);

  const outerW = 1000;
  const chartH = 440;
  const gap = 36;
  const margin = { top: 22, right: 20, bottom: 36, left: 60 };
  const innerW = outerW - margin.left - margin.right;
  const innerH = chartH - margin.top - margin.bottom;

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([0, innerW]);

  function makeChart(titleText, series) {
    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${outerW} ${chartH}`)
      .style("width", "100%")
      .style("height", "auto");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("text")
      .attr("x", 0)
      .attr("y", -6)
      .style("font-size", "13px")
      .style("fill", "#ffffff")
      .text(titleText);

    const values = series.flatMap(s => data.map(d => d[s.key])).filter(Number.isFinite);
    const y = d3.scaleLinear()
      .domain(d3.extent(values))
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("class", "grid-x")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .ticks(6)
          .tickSize(-innerH)
          .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "#ffffff")
      .attr("stroke-opacity", 0.08);

    g.append("g")
      .attr("class", "grid-y")
      .call(
        d3.axisLeft(y)
          .ticks(6)
          .tickSize(-innerW)
          .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "#ffffff")
      .attr("stroke-opacity", 0.08);

    g.selectAll(".grid-x path, .grid-y path").remove();

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6));

    g.append("g")
      .call(d3.axisLeft(y).ticks(6));

    const line = d3.line()
      .defined(d => Number.isFinite(d.v))
      .x(d => x(d.date))
      .y(d => y(d.v));

    series.forEach(s => {
      const pts = data.map(d => ({ date: d.date, v: d[s.key] }));
      g.append("path")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("stroke", s.stroke)
        .attr("d", line(pts));
    });

    const legend = g.append("g").attr("transform", `translate(0,${innerH + 26})`);
    series.forEach((s, i) => {
      const item = legend.append("g").attr("transform", `translate(${i * 180},0)`);
      item.append("line")
        .attr("x1", 0).attr("x2", 22)
        .attr("y1", 0).attr("y2", 0)
        .attr("stroke-width", 3)
        .attr("stroke", s.stroke);
      item.append("text")
        .attr("x", 30)
        .attr("y", 4)
        .style("font-size", "12px")
        .style("fill", "#ffffff")
        .text(s.label);
    });
  }

  makeChart("BTC Close (USD)", [
    { key: "close", label: "close", stroke: "#ff0000ff" }
  ]);

  container.append("div").style("height", `${gap}px`);

  makeChart("Keyword Search Volume (Scaled)", [
    { key: "bitcoin_price", label: "bitcoin price", stroke: "#00c2ff" },
    { key: "nft", label: "nft", stroke: "#ff4d9d" },
    { key: "blockchain", label: "blockchain", stroke: "#9cff57" }
  ]);
})();
