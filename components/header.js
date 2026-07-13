(function () {
  let activeSearchRequest = 0;
  let debounceTimer;
  const menuFocusTimers = new Map();

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

  function setMobileNavOpen(isOpen, returnFocus = false) {
    const layer = document.querySelector("#mobileNavLayer");
    const toggle = document.querySelector("#mobileNavToggle");

    if (!layer || !toggle) {
      return;
    }

    layer.classList.toggle("is-open", isOpen);
    layer.setAttribute("aria-hidden", String(!isOpen));
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("overflow-hidden", isOpen);

    if (isOpen) {
      window.setTimeout(() => document.querySelector("#mobileNavClose")?.focus(), 120);
    } else if (returnFocus) {
      toggle.focus();
    }
  }

  function setDesktopMenuOpen(menuName, isOpen) {
    if (isOpen) {
      ["Genre", "Year"].forEach((name) => {
        if (name !== menuName) {
          setDesktopMenuOpen(name, false);
        }
      });
    }

    const menu = document.querySelector(`#desktop${menuName}Menu`);
    const toggle = document.querySelector(`#desktop${menuName}Toggle`);
    const dropdown = document.querySelector(`#desktop${menuName}Dropdown`);

    menu?.classList.toggle("is-open", isOpen);
    toggle?.setAttribute("aria-expanded", String(isOpen));
    dropdown?.setAttribute("aria-hidden", String(!isOpen));
  }

  function setMobileFilterOpen(filterName, isOpen) {
    if (isOpen) {
      ["Genre", "Year"].forEach((name) => {
        if (name !== filterName) {
          setMobileFilterOpen(name, false);
        }
      });
    }

    const list = document.querySelector(`#mobile${filterName}List`);
    const toggle = document.querySelector(`#mobile${filterName}Toggle`);

    list?.classList.toggle("is-open", isOpen);
    list?.setAttribute("aria-hidden", String(!isOpen));
    toggle?.setAttribute("aria-expanded", String(isOpen));
  }

  function hideDropdown() {
    document.querySelector("#searchDropdown")?.classList.add("hidden");
    document.querySelector("#globalSearch")?.setAttribute("aria-expanded", "false");
  }

  function setSearchOpen(isOpen, returnFocus = false) {
    const search = document.querySelector("#headerSearch");
    const panel = document.querySelector("#searchPanel");
    const toggle = document.querySelector("#searchToggle");

    search?.classList.toggle("is-open", isOpen);
    panel?.setAttribute("aria-hidden", String(!isOpen));
    toggle?.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      window.setTimeout(() => document.querySelector("#globalSearch")?.focus(), 100);
    } else {
      activeSearchRequest += 1;
      window.clearTimeout(debounceTimer);
      hideDropdown();

      if (returnFocus) {
        toggle?.focus();
      }
    }
  }

  window.updateHeaderRoute = function updateHeaderRoute(routeName, params = {}) {
    let activeRoute = routeName;

    if (routeName === "watch") {
      activeRoute = params.mediaType === "tv" ? "series" : "movies";
    }

    document.querySelectorAll("[data-nav-route]").forEach((link) => {
      const isActive = link.getAttribute("data-nav-route") === activeRoute;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.querySelectorAll("[data-genre-slug]").forEach((link) => {
      const isActive =
        routeName === "genre" &&
        link.getAttribute("data-genre-slug") === params.genre;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.querySelectorAll("[data-year]").forEach((link) => {
      const isActive =
        routeName === "year" && link.getAttribute("data-year") === params.year;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    setMobileFilterOpen("Genre", routeName === "genre");
    setMobileFilterOpen("Year", routeName === "year");
  };

  function searchGhostRows() {
    return Array.from(
      { length: 3 },
      () => `
        <div class="flex gap-3 border-b border-blue-950/70 p-3 last:border-b-0">
          <div class="h-16 w-11 shrink-0 animate-pulse bg-blue-950/70"></div>
          <div class="min-w-0 flex-1 pt-1">
            <div class="h-4 w-3/4 animate-pulse bg-blue-950/70"></div>
            <div class="mt-3 h-3 w-1/2 animate-pulse bg-blue-950/50"></div>
          </div>
        </div>
      `,
    ).join("");
  }

  function renderFilterMenus() {
    const genres = window.RainFlixApi?.GENRES || [];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1949 }, (_, index) => currentYear - index);
    const genreMarkup = genres
      .map(
        (genre) => `
          <a
            class="filter-menu-link"
            href="#genre/${encodeURIComponent(genre.slug)}"
            data-genre-slug="${escapeHtml(genre.slug)}"
            role="menuitem"
          >
            ${escapeHtml(genre.name)}
          </a>
        `,
      )
      .join("");
    const yearMarkup = years
      .map(
        (year) => `
          <a
            class="filter-menu-link text-center"
            href="#year/${year}"
            data-year="${year}"
            role="menuitem"
          >
            ${year}
          </a>
        `,
      )
      .join("");

    const desktopGenreList = document.querySelector("#desktopGenreList");
    const mobileGenreList = document.querySelector("#mobileGenreList");
    const desktopYearList = document.querySelector("#desktopYearList");
    const mobileYearList = document.querySelector("#mobileYearList");

    if (desktopGenreList) {
      desktopGenreList.innerHTML = genreMarkup;
    }

    if (mobileGenreList) {
      mobileGenreList.innerHTML = genreMarkup.replaceAll(' role="menuitem"', "");
    }

    if (desktopYearList) {
      desktopYearList.innerHTML = yearMarkup;
    }

    if (mobileYearList) {
      mobileYearList.innerHTML = yearMarkup.replaceAll(' role="menuitem"', "");
    }
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
          : '<div class="px-4 py-3 text-sm text-slate-400">Search is unavailable without TMDb credentials.</div>',
      );
      return;
    }

    setDropdownContent(`
      <div class="max-h-[22rem] overflow-y-auto">
        ${results
          .map((item) => {
            const image = item.poster || item.backdrop || imageFallback(item.title);

            return `
              <button
                class="flex min-h-[5.5rem] w-full gap-3 border-b border-blue-950/70 p-3 text-left transition-colors duration-200 last:border-b-0 hover:bg-sky-400/10 focus-visible:bg-sky-400/10 focus-visible:outline-none"
                type="button"
                data-search-result
                data-more-info
                data-media-type="${escapeHtml(item.mediaType)}"
                data-media-id="${escapeHtml(item.id)}"
                role="option"
                aria-label="More information about ${escapeHtml(item.title)}"
              >
                <img
                  class="h-16 w-11 shrink-0 object-cover"
                  src="${image}"
                  alt=""
                  loading="lazy"
                  onerror="this.onerror=null;this.src='${imageFallback(item.title)}';"
                />
                <span class="min-w-0 pt-1">
                  <span class="block truncate text-sm font-bold text-slate-100">${escapeHtml(item.title)}</span>
                  <span class="mt-1 block text-xs text-slate-400">${window.RainFlixApi.mediaLabel(item.mediaType)} &middot; ${escapeHtml(item.year)} &middot; ${escapeHtml(item.rating)}</span>
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    `);
  }

  function attachDesktopMenu(menuName) {
    const menu = document.querySelector(`#desktop${menuName}Menu`);
    const toggle = document.querySelector(`#desktop${menuName}Toggle`);
    const list = document.querySelector(`#desktop${menuName}List`);

    menu?.addEventListener("pointerenter", () => {
      setDesktopMenuOpen(menuName, true);
    });
    menu?.addEventListener("pointerleave", () => {
      if (!menu.contains(document.activeElement)) {
        setDesktopMenuOpen(menuName, false);
      }
    });
    menu?.addEventListener("focusin", () => {
      window.clearTimeout(menuFocusTimers.get(menuName));
      setDesktopMenuOpen(menuName, true);
    });
    menu?.addEventListener("focusout", () => {
      window.clearTimeout(menuFocusTimers.get(menuName));
      menuFocusTimers.set(
        menuName,
        window.setTimeout(() => {
          if (!menu.contains(document.activeElement)) {
            setDesktopMenuOpen(menuName, false);
          }
        }, 80),
      );
    });
    toggle?.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setDesktopMenuOpen(menuName, !isOpen);
    });
    list?.addEventListener("click", () => setDesktopMenuOpen(menuName, false));
  }

  window.initHeader = function initHeader() {
    renderFilterMenus();

    const headerShell = document.querySelector("#site-header");
    const search = document.querySelector("#headerSearch");
    const searchInput = document.querySelector("#globalSearch");
    const searchToggle = document.querySelector("#searchToggle");
    const searchClose = document.querySelector("#searchClose");
    const searchDropdown = document.querySelector("#searchDropdown");
    const mobileGenreToggle = document.querySelector("#mobileGenreToggle");
    const mobileYearToggle = document.querySelector("#mobileYearToggle");
    const mobileNavLayer = document.querySelector("#mobileNavLayer");
    const mobileNavToggle = document.querySelector("#mobileNavToggle");
    const mobileNavClose = document.querySelector("#mobileNavClose");
    const mobileNavBackdrop = document.querySelector("#mobileNavBackdrop");

    if (mobileNavLayer?.parentElement !== document.body) {
      document.body.appendChild(mobileNavLayer);
    }

    const syncHeaderSurface = () => {
      headerShell?.classList.toggle("is-scrolled", window.scrollY > 24);
    };

    syncHeaderSurface();
    window.addEventListener("scroll", syncHeaderSurface, { passive: true });

    searchToggle?.addEventListener("click", () => {
      setSearchOpen(searchToggle.getAttribute("aria-expanded") !== "true");
    });
    searchClose?.addEventListener("click", () => setSearchOpen(false, true));

    searchInput?.addEventListener("input", (event) => {
      window.clearTimeout(debounceTimer);
      activeSearchRequest += 1;

      if (event.target.value.trim().length < 2) {
        hideDropdown();
        return;
      }

      setDropdownContent(searchGhostRows());
      debounceTimer = window.setTimeout(() => {
        runSearch(event.target.value).catch(() => {
          setDropdownContent(
            '<div class="px-4 py-3 text-sm text-slate-400">Search is unavailable right now.</div>',
          );
        });
      }, 300);
    });

    searchInput?.addEventListener("focus", () => {
      if (searchInput.value.trim().length >= 2) {
        runSearch(searchInput.value).catch(hideDropdown);
      }
    });

    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSearchOpen(false, true);
        return;
      }

      if (event.key === "ArrowDown") {
        const firstResult = document.querySelector("#searchDropdown [data-search-result]");

        if (firstResult) {
          event.preventDefault();
          firstResult.focus();
        }
      }
    });

    searchDropdown?.addEventListener("click", (event) => {
      if (event.target.closest("[data-search-result]")) {
        if (searchInput) {
          searchInput.value = "";
        }
        setSearchOpen(false);
      }
    });

    searchDropdown?.addEventListener("keydown", (event) => {
      const results = [
        ...document.querySelectorAll("#searchDropdown [data-search-result]"),
      ];
      const currentIndex = results.indexOf(document.activeElement);

      if (event.key === "Escape") {
        event.preventDefault();
        setSearchOpen(false, true);
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();

      if (event.key === "ArrowUp" && currentIndex === 0) {
        searchInput?.focus();
        return;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(
        results.length - 1,
        Math.max(0, currentIndex + direction),
      );
      results[nextIndex]?.focus();
    });

    attachDesktopMenu("Genre");
    attachDesktopMenu("Year");

    mobileNavToggle?.addEventListener("click", () => setMobileNavOpen(true));
    mobileNavClose?.addEventListener("click", () => setMobileNavOpen(false, true));
    mobileNavBackdrop?.addEventListener("click", () => setMobileNavOpen(false, true));
    mobileGenreToggle?.addEventListener("click", () => {
      setMobileFilterOpen(
        "Genre",
        mobileGenreToggle.getAttribute("aria-expanded") !== "true",
      );
    });
    mobileYearToggle?.addEventListener("click", () => {
      setMobileFilterOpen(
        "Year",
        mobileYearToggle.getAttribute("aria-expanded") !== "true",
      );
    });
    mobileNavLayer?.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        setMobileNavOpen(false);
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#headerSearch") && search?.classList.contains("is-open")) {
        setSearchOpen(false);
      }

      if (!event.target.closest("#desktopGenreMenu")) {
        setDesktopMenuOpen("Genre", false);
      }

      if (!event.target.closest("#desktopYearMenu")) {
        setDesktopMenuOpen("Year", false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (search?.classList.contains("is-open")) {
        setSearchOpen(false, true);
        return;
      }

      const openMenu = ["Genre", "Year"].find(
        (name) =>
          document.querySelector(`#desktop${name}Toggle`)?.getAttribute(
            "aria-expanded",
          ) === "true",
      );

      if (openMenu) {
        setDesktopMenuOpen(openMenu, false);
        document.querySelector(`#desktop${openMenu}Toggle`)?.focus();
        return;
      }

      if (mobileNavToggle?.getAttribute("aria-expanded") === "true") {
        setMobileNavOpen(false, true);
      }
    });
  };
})();
