window.addEventListener("pageshow", () => {
  const btn = document.querySelector(".mainchart-btn");
  if (!btn) {
    const container = document.getElementById("mainChart");
    const button = document.createElement("button");
    button.className = "mainchart-btn";
    button.textContent = "Interactive Chart";
    button.onclick = () => location.href = "chart.html";
    container.appendChild(button);
  }
});