(function () {
  const MODAL_HISTORY_KEY = "rainflixDetailsModal";
  let activeRequest = 0;
  let returnFocusElement = null;

  function api() {
    return window.RainFlixApi;
  }

  function escapeHtml(value) {
    return api()?.escapeHtml(value) || String(value || "");
  }

  function imageFallback(title, wide = false) {
    return api()?.createImageFallback(title, wide) || "";
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
      return value || "Not announced";
    }

    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  }

  function modalElements() {
    return {
      content: document.querySelector("#titleDetailsContent"),
      dialog: document.querySelector(".title-details-dialog"),
      modal: document.querySelector("#titleDetailsModal"),
    };
  }

  function historyState() {
    return history.state && typeof history.state === "object"
      ? history.state
      : {};
  }

  function modalHistoryState() {
    const modalState = historyState()[MODAL_HISTORY_KEY];

    if (
      !modalState ||
      !modalState.mediaType ||
      !String(modalState.id || "").trim()
    ) {
      return null;
    }

    return modalState;
  }

  function stateWithoutModal() {
    const nextState = { ...historyState() };
    delete nextState[MODAL_HISTORY_KEY];
    return nextState;
  }

  function setModalHistory(mediaType, id, replace = false) {
    const nextState = {
      ...stateWithoutModal(),
      [MODAL_HISTORY_KEY]: {
        id: String(id),
        mediaType: String(mediaType),
      },
    };
    const method = replace ? "replaceState" : "pushState";

    history[method](nextState, "", window.location.href);
  }

  function renderLoading() {
    const { content } = modalElements();

    if (!content) {
      return;
    }

    content.innerHTML = `
      <h2 id="titleDetailsHeading" class="sr-only">Loading title details</h2>
      <div class="h-64 animate-pulse bg-blue-950/50 md:h-80"></div>
      <div class="space-y-5 p-5 md:p-7">
        <div class="h-7 w-2/3 animate-pulse bg-blue-950/60"></div>
        <div class="h-4 w-1/2 animate-pulse bg-blue-950/45"></div>
        <div class="space-y-3">
          <div class="h-4 w-full animate-pulse bg-blue-950/35"></div>
          <div class="h-4 w-11/12 animate-pulse bg-blue-950/35"></div>
          <div class="h-4 w-4/5 animate-pulse bg-blue-950/35"></div>
        </div>
      </div>
    `;
  }

  function castTemplate(person) {
    const image = person.image
      ? `<img class="aspect-[2/3] w-full object-cover" src="${person.image}" alt="${escapeHtml(person.name)} portrait" loading="lazy" decoding="async" />`
      : `<div class="grid aspect-[2/3] w-full place-items-center bg-blue-950/55 px-2 text-center text-xs font-bold text-slate-400">${escapeHtml(person.name)}</div>`;

    return `
      <figure class="w-24 shrink-0">
        <div class="overflow-hidden rounded-lg bg-slate-950">${image}</div>
        <figcaption class="mt-2">
          <span class="line-clamp-2 block text-xs font-bold leading-4 text-slate-100">${escapeHtml(person.name)}</span>
          ${person.character ? `<span class="mt-1 line-clamp-2 block text-[0.7rem] leading-4 text-slate-500">${escapeHtml(person.character)}</span>` : ""}
        </figcaption>
      </figure>
    `;
  }

  function trailerUrl(trailerKey, { controls = false } = {}) {
    const params = new URLSearchParams({
      autoplay: "1",
      controls: controls ? "1" : "0",
      mute: "0",
      playsinline: "1",
      rel: "0",
    });

    return `https://www.youtube-nocookie.com/embed/${trailerKey}?${params.toString()}`;
  }

  function revealTrailer(frame, interactive = false) {
    frame.classList.toggle("pointer-events-none", !interactive);
    window.requestAnimationFrame(() => frame.classList.add("opacity-100"));
    document.querySelectorAll("[data-trailer-overlay]").forEach((overlay) => {
      overlay.classList.add("opacity-0");
    });
  }

  function mountTrailer(trailerKey, { controls = false, interactive = false } = {}) {
    const stage = document.querySelector("#detailsTrailerStage");

    if (
      !stage ||
      !document.querySelector("#titleDetailsModal")?.classList.contains("is-open") ||
      !/^[A-Za-z0-9_-]+$/.test(trailerKey)
    ) {
      return null;
    }

    let frame = stage.querySelector("[data-trailer-frame]");

    if (!frame) {
      frame = document.createElement("iframe");
      frame.className =
        "pointer-events-none absolute inset-0 h-full w-full bg-black opacity-0 transition duration-700";
      frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.frameBorder = "0";
      frame.loading = "eager";
      frame.dataset.trailerFrame = "";
      stage.appendChild(frame);
    }

    frame.title = controls ? "Official trailer" : "Trailer preview";
    frame.addEventListener(
      "load",
      () => revealTrailer(frame, interactive),
      { once: true },
    );
    frame.src = trailerUrl(trailerKey, { controls });
    return frame;
  }

  function renderDetails(details) {
    const { content } = modalElements();

    if (!content) {
      return;
    }

    const backdrop =
      details.backdrop || details.poster || imageFallback(details.title, true);
    const watchUrl = api().buildWatchUrl(details);
    const genres = details.genres || [];
    const cast = details.cast || [];
    const trailerKey = /^[A-Za-z0-9_-]+$/.test(details.trailerKey || "")
      ? details.trailerKey
      : "";
    const runtime = details.duration || details.runtime || "Not available";

    content.innerHTML = `
      <article>
        <div class="relative h-64 overflow-hidden bg-slate-950 md:h-80">
          <div id="detailsTrailerStage" class="absolute inset-0">
            <img
              class="absolute inset-0 h-full w-full object-cover opacity-80"
              src="${backdrop}"
              alt=""
              decoding="async"
              onerror="this.onerror=null;this.src='${imageFallback(details.title, true)}';"
            />
          </div>
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/58 to-slate-950/15 transition duration-300" data-trailer-overlay></div>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 to-transparent transition duration-300" data-trailer-overlay></div>

          <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 pr-16 transition duration-300 md:p-7 md:pr-20" data-trailer-overlay>
            <p class="mb-3 text-xs font-black uppercase text-sky-300">${api().mediaLabel(details.mediaType)}</p>
            <h2 id="titleDetailsHeading" class="${details.logo ? "sr-only" : "max-w-3xl text-3xl font-black leading-tight text-slate-50 md:text-5xl"}">${escapeHtml(details.title)}</h2>
            ${
              details.logo
                ? `<div>
                    <img class="title-logo max-h-20 w-auto max-w-[min(30rem,76vw)] object-contain object-left md:max-h-24" src="${details.logo}" alt="" decoding="async" onload="this.nextElementSibling.classList.add('hidden');" onerror="this.classList.add('hidden');" />
                    <span class="max-w-3xl text-3xl font-black leading-tight text-slate-50 md:text-5xl">${escapeHtml(details.title)}</span>
                  </div>`
                : ""
            }
            ${details.tagline ? `<p class="mt-3 max-w-2xl text-sm italic text-slate-300 md:text-base">${escapeHtml(details.tagline)}</p>` : ""}
          </div>
        </div>

        <div class="p-5 md:p-7">
          <div class="flex flex-wrap items-center gap-3">
            <a class="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 transition duration-200 hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/25" href="${watchUrl}">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              Watch now
            </a>
            ${
              trailerKey
                ? `<button class="inline-flex items-center gap-2 rounded-lg border border-blue-800/80 bg-blue-950/45 px-5 py-3 text-sm font-black text-slate-100 transition duration-200 hover:border-sky-500 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/20" type="button" data-play-trailer="${trailerKey}" aria-pressed="false">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path d="m10 8 6 4-6 4V8Z" fill="currentColor" /></svg>
                    <span data-trailer-label>Play trailer</span>
                  </button>`
                : ""
            }
          </div>

          <dl class="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-blue-950/80 py-5 sm:grid-cols-4">
            <div>
              <dt class="text-xs font-bold uppercase text-slate-500">Release date</dt>
              <dd class="mt-1 text-sm font-bold text-slate-100">${escapeHtml(formatDate(details.releaseDate))}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase text-slate-500">Runtime</dt>
              <dd class="mt-1 text-sm font-bold text-slate-100">${escapeHtml(runtime)}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase text-slate-500">Status</dt>
              <dd class="mt-1 text-sm font-bold text-slate-100">${escapeHtml(details.status || "Not available")}</dd>
            </div>
            <div>
              <dt class="text-xs font-bold uppercase text-slate-500">Rating</dt>
              <dd class="mt-1 text-sm font-bold text-slate-100">${escapeHtml(details.rating)} / 10</dd>
            </div>
          </dl>

          <section class="mt-6" aria-labelledby="detailsSynopsisTitle">
            <h3 id="detailsSynopsisTitle" class="text-lg font-black text-slate-50">Synopsis</h3>
            <p class="mt-3 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">${escapeHtml(details.synopsis)}</p>
          </section>

          ${
            genres.length
              ? `<section class="mt-6" aria-labelledby="detailsGenresTitle">
                  <h3 id="detailsGenresTitle" class="text-lg font-black text-slate-50">Genres</h3>
                  <div class="mt-3 flex flex-wrap gap-2">
                    ${genres.map((genre) => `<span class="rounded-full border border-blue-800/70 px-3 py-1 text-xs font-bold text-sky-200">${escapeHtml(genre)}</span>`).join("")}
                  </div>
                </section>`
              : ""
          }

          ${
            cast.length
              ? `<section class="mt-7" aria-labelledby="detailsCastTitle">
                  <h3 id="detailsCastTitle" class="text-lg font-black text-slate-50">Cast</h3>
                  <div class="mt-4 flex gap-4 overflow-x-auto pb-3">${cast.map(castTemplate).join("")}</div>
                </section>`
              : ""
          }

        </div>
      </article>
    `;

  }

  function renderError() {
    const { content } = modalElements();

    if (!content) {
      return;
    }

    content.innerHTML = `
      <div class="grid min-h-[22rem] place-items-center p-7 text-center">
        <div>
          <h2 id="titleDetailsHeading" class="text-2xl font-black text-slate-50">Details unavailable</h2>
          <p class="mt-3 text-sm text-slate-400">RainFlix could not load this title's information right now.</p>
        </div>
      </div>
    `;
  }

  function closeDetailsModal(returnFocus = true, updateHistory = true) {
    const { content, modal } = modalElements();

    if (!modal?.classList.contains("is-open")) {
      return;
    }

    activeRequest += 1;
    content?.querySelectorAll("iframe").forEach((frame) => {
      frame.src = "about:blank";
    });
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("details-modal-open");

    if (returnFocus) {
      let focusTarget = returnFocusElement;

      if (
        !(focusTarget instanceof HTMLElement) ||
        !focusTarget.getClientRects().length ||
        focusTarget.closest('[aria-hidden="true"]')
      ) {
        focusTarget = returnFocusElement?.closest("#searchDropdown")
          ? document.querySelector("#searchToggle")
          : document.querySelector("#app-view");
      }

      focusTarget?.focus({ preventScroll: true });
    }

    returnFocusElement = null;

    if (updateHistory && modalHistoryState()) {
      history.back();
    }
  }

  async function openDetailsModal(mediaType, id, updateHistory = true) {
    const { modal } = modalElements();

    if (!modal || !mediaType || !id) {
      return;
    }

    const requestId = ++activeRequest;
    const wasOpen = modal.classList.contains("is-open");

    if (!wasOpen) {
      returnFocusElement = document.activeElement;
    }

    if (updateHistory) {
      setModalHistory(mediaType, id, wasOpen && Boolean(modalHistoryState()));
    }

    renderLoading();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("details-modal-open");
    window.setTimeout(() => modal.querySelector(".title-details-close")?.focus(), 80);

    try {
      const details = await api().getDetails(mediaType, id);

      if (requestId !== activeRequest || !modal.classList.contains("is-open")) {
        return;
      }

      if (!details) {
        renderError();
        return;
      }

      renderDetails(details);
    } catch (error) {
      if (requestId === activeRequest) {
        renderError();
      }
    }
  }

  function playTrailer(button) {
    const trailerKey = button.getAttribute("data-play-trailer") || "";

    if (!/^[A-Za-z0-9_-]+$/.test(trailerKey)) {
      return;
    }

    const frame = mountTrailer(trailerKey, {
      controls: true,
      interactive: true,
    });

    if (!frame) {
      return;
    }

    button.setAttribute("aria-pressed", "true");
    const label = button.querySelector("[data-trailer-label]");

    if (label) {
      label.textContent = "Restart trailer";
    }
    document.querySelectorAll("[data-trailer-overlay]").forEach((overlay) => {
      overlay.classList.add("opacity-0");
    });
  }

  function trapModalFocus(event) {
    const { dialog, modal } = modalElements();

    if (!modal?.classList.contains("is-open")) {
      return;
    }

    const isEditable = event.target.matches?.(
      'input, textarea, select, [contenteditable="true"]',
    );
    const isBackKey =
      ["Escape", "BrowserBack", "GoBack"].includes(event.key) ||
      [27, 461, 10009].includes(event.keyCode) ||
      (event.key === "Backspace" && !isEditable);

    if (isBackKey) {
      event.preventDefault();
      event.stopPropagation();
      closeDetailsModal();
      return;
    }

    if (event.key !== "Tab" || !dialog) {
      return;
    }

    const focusable = [...dialog.querySelectorAll(
      'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0);

    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (modalHistoryState()) {
      history.replaceState(stateWithoutModal(), "", window.location.href);
    }

    document.addEventListener("click", (event) => {
      const moreInfoButton = event.target.closest("[data-more-info]");

      if (moreInfoButton) {
        event.preventDefault();
        event.stopPropagation();
        openDetailsModal(
          moreInfoButton.getAttribute("data-media-type"),
          moreInfoButton.getAttribute("data-media-id"),
        );
        return;
      }

      if (event.target.closest("[data-details-close]")) {
        closeDetailsModal();
        return;
      }

      const trailerButton = event.target.closest("[data-play-trailer]");

      if (trailerButton) {
        playTrailer(trailerButton);
        return;
      }

      const watchLink = event.target.closest(
        '#titleDetailsModal a[href^="#watch/"]',
      );

      if (watchLink) {
        event.preventDefault();
        event.stopPropagation();
        const previousUrl = window.location.href;
        const targetUrl = new URL(watchLink.getAttribute("href"), previousUrl);

        closeDetailsModal(false, false);
        history.replaceState(stateWithoutModal(), "", targetUrl);
        window.dispatchEvent(
          new HashChangeEvent("hashchange", {
            newURL: targetUrl.href,
            oldURL: previousUrl,
          }),
        );
      }
    });
    document.addEventListener("keydown", trapModalFocus, true);
    window.addEventListener("popstate", () => {
      const modalState = modalHistoryState();
      const { modal } = modalElements();

      if (modalState && !modal?.classList.contains("is-open")) {
        openDetailsModal(modalState.mediaType, modalState.id, false);
      } else if (!modalState && modal?.classList.contains("is-open")) {
        closeDetailsModal(true, false);
      }
    });
  });

  window.RainFlixOpenDetails = openDetailsModal;
  window.RainFlixCloseDetails = closeDetailsModal;
})();
