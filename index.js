document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("draws-container");
  const filterButtons = document.querySelectorAll("#denom-filters .btn");
  let allData = null;

  // Fetch the data
  const fetchData = async () => {
    try {
      // Show loading state
      container.innerHTML = Array(6)
        .fill(0)
        .map(
          () => `
                <div class="card">
                    <div style="height: 24px; width: 60%; margin-bottom: 20px;" class="skeleton"></div>
                    <div class="card-info">
                        <div style="height: 16px; width: 100%;" class="skeleton"></div>
                        <div style="height: 16px; width: 100%;" class="skeleton"></div>
                        <div style="height: 16px; width: 100%;" class="skeleton"></div>
                    </div>
                </div>
            `,
        )
        .join("");

      const response = await fetch("/data/all_draws.json");
      if (!response.ok) throw new Error("Failed to load data");

      allData = await response.json();
      renderDraws("all");
    } catch (error) {
      console.error("Error:", error);
      container.innerHTML = `
                <div class="empty-state">
                    <h2 style="color: #e74c3c;">Connection Error</h2>
                    <p style="margin-top: 1rem;">Could not load bond data. Please ensure the scraper has been run and the server is active.</p>
                    <button class="btn" onclick="location.reload()" style="margin-top: 1.5rem;">Retry Connection</button>
                </div>
            `;
    }
  };

  const renderDraws = (denomination) => {
    let drawsToRender = [];

    if (denomination === "all") {
      Object.values(allData).forEach((list) => {
        drawsToRender = [...drawsToRender, ...list];
      });
    } else {
      drawsToRender = allData[denomination.toString()] || [];
    }

    // Sort by date (newest first)
    drawsToRender.sort(
      (a, b) => new Date(b.date_parsed) - new Date(a.date_parsed),
    );

    if (drawsToRender.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <h2>No Records Found</h2>
                    <p>No data available for the selected bond type.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = drawsToRender
      .map(
        (draw) => `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Rs. ${draw.denomination}</h3>
                    <span class="badge badge-${draw.file_type}">${draw.file_type}</span>
                </div>
                
                <div class="card-info">
                    <div class="info-item">
                        <span class="info-label">Draw Date</span>
                        <span class="info-value">${draw.date_string}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Year</span>
                        <span class="info-value">${draw.year}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value" style="color: ${draw.downloaded ? "#2ecc71" : "#f1c40f"}">
                            ${draw.downloaded ? "✓ Locally Saved" : "● Available Online"}
                        </span>
                    </div>
                </div>

                <a href="${draw.file_url}" target="_blank" class="download-link">
                    View Official Results
                </a>
            </div>
        `,
      )
      .join("");
  };

  // Filter logic
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderDraws(btn.dataset.denom);
    });
  });

  fetchData();
});
