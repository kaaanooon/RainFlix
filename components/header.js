(function () {
  let searchHandler;
  let blurHandler;
  let resultClickHandler;
  let resultKeyHandler;
  let searchKeyHandler;
  let mobileNavKeyHandler;
  let activeSearchRequest = 0;
  let debounceTimer;

  function setMobileNavOpen(isOpen, returnFocus = false) {
    const layer = document.querySelector("#mobileNavLayer");
    const toggle = document.querySelector("#mobileNavToggle");

    if (!layer || !toggle) {
      return;
    }

    layer.classList.toggle("hidden", !isOpen);
    layer.setAttribute("aria-hidden", String(!isOpen));
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("overflow-hidden", isOpen);

    if (isOpen) {
      document.querySelector("#mobileNavClose")?.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  }

  window.updateHeaderRoute = function updateHeaderRoute(routeName, params = {}) {
    let activeRoute = routeName;

    if (routeName === "watch") {
      activeRoute = params.mediaType === "tv" ? "series" : "movies";
    }

    document.querySelectorAll("[data-nav-route]").forEach((link) => {
      const isActive = link.getAttribute("data-nav-route") === activeRoute;
      link.classList.toggle("bg-sky-400/15", isActive);
      link.classList.toggle("text-sky-300", isActive);
      link.classList.toggle("text-slate-400", !isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  function searchGhostRows() {
    return Array.from({ length: 3 }, () => (
      `<div class="flex gap-3 border-b border-blue-950/70 p-3 last:border-b-0">
        <div class="h-16 w-11 shrink-0 animate-pulse rounded bg-blue-950/70"></div>
        <div class="min-w-0 flex-1 pt-1">
          <div class="h-4 w-3/4 animate-pulse rounded bg-blue-950/70"></div>
          <div class="mt-3 h-3 w-1/2 animate-pulse rounded bg-blue-950/50"></div>
        </div>
      </div>`
    )).join("");
  }

  function escapeHtml(value) {
    return window.RainFlixApi?.escapeHtml
      ? window.RainFlixApi.escapeHtml(value)
      : String(value || "");
  }

  function imageFallback(title) {
    return window.RainFlixApi?.createImageFallback
      ? window.RainFlixApi.createImageFallback(title)
      : "";
  }

  function setDropdownContent(html) {
    const dropdown = document.querySelector("#searchDropdown");

    if (!dropdown) {
      return;
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove("hidden");
    document.querySelector("#globalSearch")?.setAttribute("aria-expanded", "true");
  }

  function hideDropdown() {
    document.querySelector("#searchDropdown")?.classList.add("hidden");
    document.querySelector("#globalSearch")?.setAttribute("aria-expanded", "false");
  }

  async function runSearch(query) {
    const requestId = ++activeSearchRequest;
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      hideDropdown();
      return;
    }

    const results = await window.RainFlixApi.search(cleanQuery);

    if (requestId !== activeSearchRequest) {
      return;
    }

    if (!results.length) {
      setDropdownContent(
        window.RainFlixApi.hasTmdbCredentials()
          ? '<div class="px-4 py-3 text-sm text-slate-400">No titles found.</div>'
          : '<div class="px-4 py-3 text-sm text-slate-400">Add TMDb credentials in scripts/config.js to search the full database.</div>',
      );
      return;
    }

    setDropdownContent(
      `<div class="max-h-[22rem] overflow-y-auto">
        ${results
          .map((item) => {
            const image = item.poster || item.backdrop || imageFallback(item.title);
            const url = window.RainFlixApi.buildWatchUrl(item);

            return `
              <a
                class="flex min-h-[5.5rem] gap-3 border-b border-blue-950/70 p-3 text-left transition last:border-b-0 hover:bg-sky-400/10 focus-visible:bg-sky-400/10 focus-visible:outline-none"
                href="${url}"
                role="option"
              >
                <img
                  class="h-16 w-11 shrink-0 rounded object-cover"
                  src="${image}"
                  alt=""
                  loading="lazy"
                  onerror="this.onerror=null;this.src='${imageFallback(item.title)}';"
                />
                <span class="min-w-0 pt-1">
                  <span class="block truncate text-sm font-bold text-slate-100">${escapeHtml(item.title)}</span>
                  <span class="mt-1 block text-xs text-slate-400">${window.RainFlixApi.mediaLabel(item.mediaType)} &middot; ${escapeHtml(item.year)} &middot; ${escapeHtml(item.rating)}</span>
                </span>
              </a>
            `;
          })
          .join("")}
      </div>${
        window.RainFlixApi.hasTmdbCredentials()
          ? ""
          : '<div class="border-t border-blue-950/70 px-4 py-3 text-xs text-slate-500">Full TMDb search activates after adding credentials in scripts/config.js.</div>'
      }`,
    );
  }

  window.initHeader = function initHeader() {
    const searchInput = document.querySelector("#globalSearch");
    const mobileNavLayer = document.querySelector("#mobileNavLayer");
    const mobileNavToggle = document.querySelector("#mobileNavToggle");
    const mobileNavClose = document.querySelector("#mobileNavClose");
    const mobileNavBackdrop = document.querySelector("#mobileNavBackdrop");

    if (mobileNavLayer?.parentElement !== document.body) {
      document.body.appendChild(mobileNavLayer);
    }

    if (searchHandler && searchInput) {
      searchInput.removeEventListener("input", searchHandler);
    }

    if (blurHandler) {
      document.removeEventListener("click", blurHandler);
    }

    if (resultClickHandler) {
      document
        .querySelector("#searchDropdown")
        ?.removeEventListener("click", resultClickHandler);
    }

    if (resultKeyHandler) {
      document
        .querySelector("#searchDropdown")
        ?.removeEventListener("keydown", resultKeyHandler);
    }

    if (searchKeyHandler && searchInput) {
      searchInput.removeEventListener("keydown", searchKeyHandler);
    }

    searchHandler = (event) => {
      window.clearTimeout(debounceTimer);
      activeSearchRequest += 1;

      if (event.target.value.trim().length < 2) {
        hideDropdown();
        return;
      }

      setDropdownContent(
        searchGhostRows(),
      );

      debounceTimer = window.setTimeout(() => {
        runSearch(event.target.value).catch(() => {
          setDropdownContent(
            '<div class="px-4 py-3 text-sm text-slate-400">Search is unavailable right now.</div>',
          );
        });
      }, 360);
    };

    searchInput?.addEventListener("input", searchHandler);

    searchInput?.addEventListener("focus", () => {
      if (searchInput.value.trim().length >= 2) {
        runSearch(searchInput.value).catch(hideDropdown);
      }
    });

    searchKeyHandler = (event) => {
      if (event.key === "Escape") {
        hideDropdown();
        return;
      }

      if (event.key === "ArrowDown") {
        const firstResult = document.querySelector("#searchDropdown a");

        if (firstResult) {
          event.preventDefault();
          firstResult.focus();
        }
      }
    };

    searchInput?.addEventListener("keydown", searchKeyHandler);

    blurHandler = (event) => {
      if (!event.target.closest("#searchDropdown") && event.target !== searchInput) {
        hideDropdown();
      }
    };

    document.addEventListener("click", blurHandler);

    resultClickHandler = (event) => {
      if (event.target.closest("a")) {
        hideDropdown();
        if (searchInput) {
          searchInput.value = "";
        }
      }
    };

    resultKeyHandler = (event) => {
      const results = [...document.querySelectorAll("#searchDropdown a")];
      const currentIndex = results.indexOf(document.activeElement);

      if (event.key === "Escape") {
        event.preventDefault();
        hideDropdown();
        searchInput?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(
        results.length - 1,
        Math.max(0, currentIndex + direction),
      );

      if (event.key === "ArrowUp" && currentIndex === 0) {
        searchInput?.focus();
        return;
      }

      results[nextIndex]?.focus();
    };

    document
      .querySelector("#searchDropdown")
      ?.addEventListener("click", resultClickHandler);
    document
      .querySelector("#searchDropdown")
      ?.addEventListener("keydown", resultKeyHandler);

    mobileNavToggle?.addEventListener("click", () => setMobileNavOpen(true));
    mobileNavClose?.addEventListener("click", () => setMobileNavOpen(false, true));
    mobileNavBackdrop?.addEventListener("click", () => setMobileNavOpen(false, true));
    document.querySelector("#mobileNavLayer")?.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        setMobileNavOpen(false);
      }
    });

    mobileNavKeyHandler = (event) => {
      if (
        event.key === "Escape" &&
        document.querySelector("#mobileNavToggle")?.getAttribute("aria-expanded") ===
          "true"
      ) {
        setMobileNavOpen(false, true);
      }
    };

    document.addEventListener("keydown", mobileNavKeyHandler);
  };
})();
