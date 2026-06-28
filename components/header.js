(function () {
  let searchHandler;
  let blurHandler;
  let resultClickHandler;
  let activeSearchRequest = 0;
  let debounceTimer;

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
  }

  function hideDropdown() {
    document.querySelector("#searchDropdown")?.classList.add("hidden");
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

    document
      .querySelector("#searchDropdown")
      ?.addEventListener("click", resultClickHandler);
  };
})();
