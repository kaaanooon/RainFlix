(function () {
  const state = {
    activeSlide: 0,
    carouselChanging: false,
    carouselItems: [],
    carouselTimer: null,
    newestMovies: [],
    newestSeries: [],
    pendingSlide: 0,
    slideDirection: "left",
    sources: new Set(),
    trending: [],
  };

  function api() {
    return window.RainFlixApi;
  }

  function escapeHtml(value) {
    return api().escapeHtml(value);
  }

  function imageFallback(title, wide = false) {
    return api().createImageFallback(title, wide);
  }

  function renderSkeleton(selector) {
    const grid = document.querySelector(selector);

    if (!grid) {
      return;
    }

    grid.innerHTML = Array.from({ length: api().PAGE_SIZE }, () => (
      '<div class="aspect-[2/3] animate-pulse rounded-lg border border-blue-900/60 bg-blue-950/30"></div>'
    )).join("");
  }

  function renderFeedMeta() {
    const meta = document.querySelector("#feedMeta");

    if (!meta) {
      return;
    }

    meta.textContent = state.sources.has("tmdb")
      ? "Live TMDb feeds. Each section shows up to 10 titles."
      : "Demo feeds shown. Add TMDb credentials in scripts/config.js for live TMDb results.";
  }

  function cardTemplate(item) {
    const poster = item.poster || item.backdrop || imageFallback(item.title);
    const watchUrl = api().buildWatchUrl(item);

    return `
      <a
        class="group relative isolate aspect-[2/3] overflow-hidden rounded-lg border border-blue-900/70 bg-slate-950 shadow-xl shadow-black/30 outline-none transition hover:-translate-y-1 hover:border-sky-500/70 focus-visible:-translate-y-1 focus-visible:border-sky-500/70 focus-visible:ring-4 focus-visible:ring-sky-400/20"
        href="${watchUrl}"
        aria-label="Watch ${escapeHtml(item.title)}"
      >
        <img
          class="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-[0.58] group-focus-visible:scale-105 group-focus-visible:brightness-[0.58]"
          src="${poster}"
          alt="${escapeHtml(item.title)} poster"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${imageFallback(item.title)}';"
        />

        <div class="absolute inset-0 flex translate-y-3 flex-col justify-end gap-3 bg-gradient-to-t from-slate-950 via-slate-950/78 to-transparent p-4 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span class="rounded-full bg-sky-400/15 px-2 py-1 font-black uppercase text-sky-300">${api().mediaLabel(item.mediaType)}</span>
            <span>${escapeHtml(item.year)}</span>
          </div>

          <h3 class="text-xl font-black leading-tight text-slate-50">${escapeHtml(item.title)}</h3>

          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-300" aria-label="Rating ${escapeHtml(item.rating)}">
            <span class="rounded-full bg-blue-500/20 px-2 py-1 font-black text-sky-200">${escapeHtml(item.rating)}</span>
            <span>Rating</span>
          </div>

          <p class="line-clamp-3 text-xs leading-5 text-slate-300 md:line-clamp-4 md:text-sm md:leading-6">${escapeHtml(item.synopsis)}</p>
        </div>
      </a>
    `;
  }

  function renderGrid(selector, items, emptyText) {
    const grid = document.querySelector(selector);

    if (!grid) {
      return;
    }

    if (!items.length) {
      grid.innerHTML = `
        <p class="col-span-full rounded-lg border border-blue-900/70 bg-blue-950/30 p-7 text-slate-400">
          ${escapeHtml(emptyText)}
        </p>
      `;
      return;
    }

    grid.innerHTML = items.slice(0, api().PAGE_SIZE).map(cardTemplate).join("");
  }

  function carouselSlideTemplate(item, animationClass = "") {
    const image = item.backdrop || item.poster || imageFallback(item.title, true);
    const watchUrl = api().buildWatchUrl(item);

    return `
      <article class="absolute inset-0 h-full overflow-hidden ${animationClass}">
        <img
          class="absolute inset-0 h-full w-full object-cover opacity-55"
          src="${image}"
          alt=""
          onerror="this.onerror=null;this.src='${imageFallback(item.title, true)}';"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20"></div>
        <div class="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 to-transparent"></div>

        <div class="relative z-10 flex h-full max-w-4xl flex-col justify-end p-5 md:p-8">
          <div class="mb-4 flex items-center gap-3 text-sm text-slate-300">
            <span class="rounded-full bg-sky-400/15 px-3 py-1 font-black uppercase text-sky-300">Trending movie</span>
            <span>${escapeHtml(item.year)}</span>
            <span class="rounded-full bg-blue-500/20 px-3 py-1 font-black text-sky-200">${escapeHtml(item.rating)}</span>
          </div>

          <h2 class="max-w-3xl text-4xl font-black leading-none text-slate-50 md:text-6xl">
            ${escapeHtml(item.title)}
          </h2>

          <p class="mt-4 line-clamp-3 max-w-2xl text-sm leading-6 text-slate-300 md:mt-5 md:line-clamp-4 md:text-base md:leading-7">
            ${escapeHtml(item.synopsis)}
          </p>

          <a
            class="mt-5 w-fit rounded-lg bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-sky-500/20 transition hover:bg-sky-300 focus-visible:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/25 md:px-6"
            href="${watchUrl}"
          >
            Watch now
          </a>
        </div>
      </article>
    `;
  }

  function renderCarousel() {
    const carousel = document.querySelector("#trendingCarousel");

    if (!carousel) {
      return;
    }

    if (!state.carouselItems.length) {
      carousel.innerHTML = `
        <div class="relative grid h-full place-items-center overflow-hidden">
          <div class="absolute inset-0 animate-pulse bg-gradient-to-r from-blue-950/30 via-sky-500/10 to-blue-950/30"></div>
          <div class="relative z-10 text-sm font-bold text-slate-400">Loading trending movies...</div>
        </div>
      `;
      return;
    }

    const item = state.carouselItems[state.activeSlide] || state.carouselItems[0];
    const pendingItem =
      state.carouselItems[state.pendingSlide] || state.carouselItems[0];
    const currentClass = state.carouselChanging
      ? state.slideDirection === "left"
        ? "rainflix-current-left"
        : "rainflix-current-right"
      : "";
    const nextClass = state.carouselChanging
      ? state.slideDirection === "left"
        ? "rainflix-next-left"
        : "rainflix-next-right"
      : "";

    carousel.innerHTML = `
      <div class="relative h-full overflow-hidden">
        <div class="absolute left-0 right-0 top-0 z-10 h-1 bg-blue-950/80">
          <div class="h-full bg-sky-400 ${state.carouselChanging ? "w-full animate-pulse" : "rainflix-progress"}"></div>
        </div>

        ${carouselSlideTemplate(item, currentClass)}
        ${state.carouselChanging ? carouselSlideTemplate(pendingItem, nextClass) : ""}

        <div class="absolute left-8 top-8 z-10 flex gap-2">
          ${state.carouselItems
            .map(
              (_, index) => `
                <button
                  class="h-2.5 rounded-full transition ${index === state.activeSlide ? "w-9 bg-sky-400" : "w-2.5 bg-slate-500/70 hover:bg-slate-300"}"
                  type="button"
                  data-slide="${index}"
                  aria-label="Show slide ${index + 1}"
                ></button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;

    carousel.querySelectorAll("[data-slide]").forEach((button) => {
      button.addEventListener("click", () => {
        changeSlide(Number.parseInt(button.getAttribute("data-slide"), 10) || 0);
      });
    });
  }

  function changeSlide(nextIndex) {
    if (!state.carouselItems.length || state.carouselChanging) {
      return;
    }

    const normalizedIndex =
      (nextIndex + state.carouselItems.length) % state.carouselItems.length;

    if (normalizedIndex === state.activeSlide) {
      return;
    }

    state.pendingSlide = normalizedIndex;
    state.slideDirection = normalizedIndex > state.activeSlide ? "left" : "right";
    state.carouselChanging = true;
    renderCarousel();

    window.setTimeout(() => {
      state.activeSlide = normalizedIndex;
      state.pendingSlide = normalizedIndex;
      state.carouselChanging = false;
      renderCarousel();
      startCarouselTimer();
    }, 540);
  }

  function startCarouselTimer() {
    window.clearInterval(state.carouselTimer);
    state.carouselTimer = window.setInterval(() => {
      changeSlide(state.activeSlide + 1);
    }, 8000);
  }

  async function loadHomeFeeds() {
    renderCarousel();
    renderSkeleton("#trendingGrid");
    renderSkeleton("#newestMoviesGrid");
    renderSkeleton("#newestSeriesGrid");

    const [carousel, trending, newestMovies, newestSeries] = await Promise.all([
      api().getTrendingMovies(api().PAGE_SIZE),
      api().getTrendingThisWeek(api().PAGE_SIZE),
      api().getNewestMovies(api().PAGE_SIZE),
      api().getNewestSeries(api().PAGE_SIZE),
    ]);

    state.carouselItems = carousel.items || carousel;
    state.trending = trending.items || [];
    state.newestMovies = newestMovies.items || [];
    state.newestSeries = newestSeries.items || [];
    state.sources = new Set([
      carousel.source || "demo",
      trending.source || "demo",
      newestMovies.source || "demo",
      newestSeries.source || "demo",
    ]);
    state.activeSlide = 0;
    state.carouselChanging = false;
    state.pendingSlide = 0;
    state.slideDirection = "left";

    renderCarousel();
    renderFeedMeta();
    renderGrid("#trendingGrid", state.trending, "No weekly trends found.");
    renderGrid("#newestMoviesGrid", state.newestMovies, "No newest movies found.");
    renderGrid("#newestSeriesGrid", state.newestSeries, "No newest series found.");
    startCarouselTimer();
  }

  window.initHomePage = function initHomePage() {
    window.clearInterval(state.carouselTimer);

    state.activeSlide = 0;
    state.carouselChanging = false;
    state.carouselItems = [];
    state.newestMovies = [];
    state.newestSeries = [];
    state.trending = [];
    state.sources = new Set();

    loadHomeFeeds().catch(() => {
      renderFeedMeta();
      renderGrid("#trendingGrid", [], "Trending titles could not load.");
      renderGrid("#newestMoviesGrid", [], "Newest movies could not load.");
      renderGrid("#newestSeriesGrid", [], "Newest series could not load.");
    });
  };
})();
