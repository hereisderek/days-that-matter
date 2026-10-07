// ==========================================================================
// DAYS THAT MATTER — V1 INTERACTIVE PROTOTYPE ENGINE
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Target Event: "Trip to Tokyo & Kyoto" (42 days in future)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 42);
  targetDate.setHours(9, 30, 0, 0);

  // --- 1. Live Countdown Ticker Engine ---
  function updateCountdowns() {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      // Update Home Ticker
      const elDays = document.getElementById("val-days");
      const elHours = document.getElementById("val-hours");
      const elMinutes = document.getElementById("val-minutes");
      const elSeconds = document.getElementById("val-seconds");

      if (elDays) elDays.textContent = String(days).padStart(2, "0");
      if (elHours) elHours.textContent = String(hours).padStart(2, "0");
      if (elMinutes) elMinutes.textContent = String(minutes).padStart(2, "0");
      if (elSeconds) elSeconds.textContent = String(seconds).padStart(2, "0");

      // Update Detail screen
      const detailBigNum = document.getElementById("detail-days-num");
      if (detailBigNum) detailBigNum.textContent = days;

      // Update Story Card
      const storyNum = document.getElementById("story-days-num");
      if (storyNum) storyNum.textContent = days;
    }
  }

  setInterval(updateCountdowns, 1000);
  updateCountdowns();

  // --- 2. Screen Switching in Mobile Frame ---
  const screenTabs = document.querySelectorAll(".screen-tab");
  const appScreens = document.querySelectorAll(".device-container .app-screen");

  function switchScreen(screenId) {
    screenTabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.target === screenId);
    });
    appScreens.forEach(screen => {
      screen.classList.toggle("active", screen.id === screenId);
    });
  }

  screenTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      switchScreen(tab.dataset.target);
    });
  });

  // Deep-link triggers inside the app screens
  const triggerDetail = document.querySelectorAll(".trigger-detail");
  triggerDetail.forEach(el => {
    el.addEventListener("click", () => switchScreen("screen-detail"));
  });

  const triggerEdit = document.querySelectorAll(".trigger-edit");
  triggerEdit.forEach(el => {
    el.addEventListener("click", () => switchScreen("screen-edit"));
  });

  const triggerShare = document.querySelectorAll(".trigger-share");
  triggerShare.forEach(el => {
    el.addEventListener("click", () => switchScreen("screen-share"));
  });

  const triggerHome = document.querySelectorAll(".trigger-home");
  triggerHome.forEach(el => {
    el.addEventListener("click", () => switchScreen("screen-home"));
  });

  // --- 3. View Mode: Mobile Device vs Multi-Screen Gallery ---
  const viewBtns = document.querySelectorAll(".view-btn");
  const studioWrapper = document.querySelector(".studio-wrapper");

  viewBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      viewBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const mode = btn.dataset.mode;
      if (mode === "gallery") {
        studioWrapper.classList.add("gallery-mode");
      } else {
        studioWrapper.classList.remove("gallery-mode");
      }
    });
  });

  // --- 4. Interactive Live Event Editor ---
  const titleInput = document.getElementById("input-event-title");
  const previewTitles = document.querySelectorAll(".dynamic-event-title");

  if (titleInput) {
    titleInput.addEventListener("input", (e) => {
      const val = e.target.value.trim() || "Trip to Tokyo & Kyoto";
      previewTitles.forEach(el => {
        el.textContent = val;
      });
    });
  }

  // Color Swatch Selection
  const swatches = document.querySelectorAll(".color-swatch");
  const heroCard = document.getElementById("featured-hero-card");
  const storyCanvas = document.getElementById("story-canvas-export");

  const gradientThemes = {
    blue: "linear-gradient(145deg, #1E1B4B 0%, #172554 50%, #030712 100%)",
    rose: "linear-gradient(145deg, #4C0519 0%, #881337 50%, #030712 100%)",
    emerald: "linear-gradient(145deg, #022C22 0%, #064E3B 50%, #030712 100%)",
    amber: "linear-gradient(145deg, #451A03 0%, #78350F 50%, #030712 100%)",
    violet: "linear-gradient(145deg, #2E1065 0%, #581C87 50%, #030712 100%)"
  };

  const storyGradients = {
    blue: "linear-gradient(160deg, #1E1B4B 0%, #2563EB 50%, #4F46E5 100%)",
    rose: "linear-gradient(160deg, #4C0519 0%, #E11D48 50%, #F43F5E 100%)",
    emerald: "linear-gradient(160deg, #022C22 0%, #059669 50%, #10B981 100%)",
    amber: "linear-gradient(160deg, #451A03 0%, #D97706 50%, #F59E0B 100%)",
    violet: "linear-gradient(160deg, #2E1065 0%, #7C3AED 50%, #8B5CF6 100%)"
  };

  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      swatches.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");

      const theme = swatch.dataset.theme;
      if (heroCard && gradientThemes[theme]) {
        heroCard.style.background = gradientThemes[theme];
      }
      if (storyCanvas && storyGradients[theme]) {
        storyCanvas.style.background = storyGradients[theme];
      }
    });
  });

  // --- 5. Interactive Audio Player Simulation ---
  const audioToggle = document.getElementById("btn-audio-toggle");
  const vinylDisc = document.querySelector(".vinyl-disc");
  let isPlaying = true;

  if (audioToggle && vinylDisc) {
    audioToggle.addEventListener("click", () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        vinylDisc.style.animationPlayState = "running";
        audioToggle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        `;
      } else {
        vinylDisc.style.animationPlayState = "paused";
        audioToggle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
      }
    });
  }

  // --- 6. Category Chip Filter Simulation ---
  const categoryChips = document.querySelectorAll(".pill-chip");
  categoryChips.forEach(chip => {
    chip.addEventListener("click", () => {
      categoryChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  // --- 7. Multi-Screen Studio Gallery Population ---
  function populateGallery() {
    const screens = [
      { id: "screen-home", slot: "gallery-slot-home" },
      { id: "screen-detail", slot: "gallery-slot-detail" },
      { id: "screen-edit", slot: "gallery-slot-edit" },
      { id: "screen-share", slot: "gallery-slot-share" }
    ];

    screens.forEach(({ id, slot }) => {
      const origScreen = document.getElementById(id);
      const targetSlot = document.getElementById(slot);
      if (origScreen && targetSlot && targetSlot.children.length === 0) {
        const bezel = document.createElement("div");
        bezel.className = "phone-bezel";
        bezel.style.transform = "scale(0.9)";
        bezel.style.transformOrigin = "top center";

        const phoneScreen = document.createElement("div");
        phoneScreen.className = "phone-screen";

        // Status bar clone
        const statusBar = document.querySelector(".phone-status-bar").cloneNode(true);
        phoneScreen.appendChild(statusBar);

        // Screen clone
        const clone = origScreen.cloneNode(true);
        clone.classList.add("active");
        clone.id = `gallery-${id}`;
        phoneScreen.appendChild(clone);

        bezel.appendChild(phoneScreen);
        targetSlot.appendChild(bezel);
      }
    });
  }

  populateGallery();
});
