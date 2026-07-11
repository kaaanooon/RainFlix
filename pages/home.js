(function () {
  const state = {
    activeSlide: 0,
    browseBuffer: [],
    browseHasMore: true,
    browseItems: [],
    browseLoading: false,
    browseNextPage: 2,
    browseObserver: null,
    browseTotalPages: null,
    catalogFilter: "all",
    carouselChanging: false,
    carouselItems: [],
    carouselLoadId: 0,
    carouselPointerId: null,
    carouselStartX: 0,
    carouselStartY: 0,
    carouselTimer: null,
    carouselTransitionTimer: null,
    newestMovies: [],
    newestSeries: [],
    pendingSlide: 0,
    slideDirection: "left",
    sources: new Set(),
    trending: [],
  };

  const BROWSE_ROWS_PER_BATCH = 5;

  function api() {
    return window.RainFlixApi;
  }

  function escapeHtml(value) {
    return api().escapeHtml(value);
  }

  function imageFallback(title, wide = false) {
    return api().createImageFallback(title, wide);
  }

  function browseColumnCount() {
    if (window.matchMedia("(min-width: 768px)").matches) {
      return 5;
    }

    if (window.matchMedia("(min-width: 640px)").matches) {
      return 3;
    }

    return 2;
  }

  function browseBatchSize() {
    return browseColumnCount() * BROWSE_ROWS_PER_BATCH;
  }

  function ghostCardTemplate() {
    return `
      <div class="overflow-hidden rounded-lg border border-blue-900/60 bg-slate-950 shadow-xl shadow-black/20" aria-hidden="true">
        <div class="aspect-[2/3] animate-pulse bg-blue-950/40"></div>
        <div class="space-y-2 p-3">
          <div class="h-4 w-4/5 animate-pulse rounded bg-blue-950/70"></div>
          <div class="flex gap-2">
            <div class="h-6 w-12 animate-pulse rounded-full bg-blue-950/60"></div>
            <div class="h-6 w-10 animate-pulse rounded-full bg-blue-950/50"></div>
            <div class="h-6 w-16 animate-pulse rounded-full bg-blue-950/50"></div>
          </div>
        </div>
      </div>
    `;
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

  function setSectionVisible(selector, isVisible) {
    document.querySelector(selector)?.classList.toggle("hidden", !isVisible);
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = text;
    }
  }

  function renderFeedMeta() {
    const meta = document.querySelector("#feedMeta");

    if (!meta) {
      return;
    }

    meta.textContent = "";
  }

  function cardTemplate(item) {
    const poster = item.poster || item.backdrop || imageFallback(item.title);
    const watchUrl = api().buildWatchUrl(item);

    return `
      <a
        class="catalog-card group block overflow-hidden rounded-lg border border-blue-900/70 bg-slate-950 outline-none transition hover:-translate-y-1 hover:border-sky-500/70 focus-visible:-translate-y-1 focus-visible:border-sky-500/70 focus-visible:ring-4 focus-visible:ring-sky-400/20"
        href="${watchUrl}"
        aria-label="Watch ${escapeHtml(item.title)}"
      >
        <div class="relative isolate aspect-[2/3] overflow-hidden">
          <img
            class="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-[0.58] group-focus-visible:scale-105 group-focus-visible:brightness-[0.58]"
            src="${poster}"
            alt="${escapeHtml(item.title)} poster"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${imageFallback(item.title)}';"
          />

          <div class="absolute inset-0 flex translate-y-3 flex-col justify-end gap-3 bg-gradient-to-t from-slate-950 via-slate-950/78 to-transparent p-4 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <h3 class="text-xl font-black leading-tight text-slate-50">${escapeHtml(item.title)}</h3>
            <p class="line-clamp-3 text-xs leading-5 text-slate-300 md:line-clamp-4 md:text-sm md:leading-6">${escapeHtml(item.synopsis)}</p>
          </div>
        </div>

        <div class="space-y-2 p-3">
          <h3 class="truncate text-sm font-black text-slate-50">${escapeHtml(item.title)}</h3>
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span class="rounded-full bg-blue-500/20 px-2 py-1 font-black text-sky-200">${escapeHtml(item.rating)}</span>
            <span>${escapeHtml(item.year)}</span>
            <span class="rounded-full bg-sky-400/15 px-2 py-1 font-black uppercase text-sky-300">${api().mediaLabel(item.mediaType)}</span>
          </div>
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

  function browseItemKey(item) {
    return `${item.mediaType}:${item.id}`;
  }

  function resetBrowseState() {
    state.browseBuffer = [];
    state.browseHasMore = true;
    state.browseItems = [];
    state.browseLoading = false;
    state.browseNextPage = 2;
    state.browseTotalPages = null;
  }

  function renderBrowseGrid(ghostCount = 0) {
    const grid = document.querySelector("#browseGrid");
    const sentinel = document.querySelector("#browseSentinel");

    if (!grid) {
      return;
    }

    grid.setAttribute("aria-busy", state.browseLoading ? "true" : "false");

    if (!state.browseItems.length && !ghostCount) {
      grid.innerHTML = `
        <p class="col-span-full rounded-lg border border-blue-900/70 bg-blue-950/30 p-7 text-slate-400">
          No browse titles found.
        </p>
      `;
    } else {
      grid.innerHTML = [
        ...state.browseItems.map(cardTemplate),
        ...Array.from({ length: ghostCount }, ghostCardTemplate),
      ].join("");
    }

    sentinel?.classList.toggle("hidden", !state.browseHasMore);
  }

  async function fetchBrowseBatch(targetCount) {
    const results = [];
    const loadedKeys = new Set(state.browseItems.map(browseItemKey));

    while (results.length < targetCount && state.browseHasMore) {
      while (state.browseBuffer.length && results.length < targetCount) {
        const item = state.browseBuffer.shift();
        const key = browseItemKey(item);

        if (!loadedKeys.has(key)) {
          loadedKeys.add(key);
          results.push(item);
        }
      }

      if (results.length >= targetCount || !state.browseHasMore) {
        break;
      }

      if (
        !state.browseBuffer.length &&
        state.browseTotalPages &&
        state.browseNextPage > state.browseTotalPages
      ) {
        state.browseHasMore = false;
        break;
      }

      const feed = await api().getTrending({
        filter: state.catalogFilter,
        page: state.browseNextPage,
        limit: 20,
      });
      const items = feed.items || [];

      if (feed.source) {
        state.sources.add(feed.source);
      }

      state.browseNextPage += 1;
      state.browseTotalPages = feed.totalPages || state.browseTotalPages;

      if (!items.length) {
        state.browseHasMore = false;
        break;
      }

      state.browseBuffer.push(...items);

      if (feed.totalPages && state.browseNextPage > feed.totalPages) {
        state.browseHasMore = state.browseBuffer.length > 0;
      }
    }

    return results;
  }

  async function loadMoreBrowseItems() {
    if (state.browseLoading || !state.browseHasMore) {
      return;
    }

    state.browseLoading = true;
    const targetCount = browseBatchSize();
    renderBrowseGrid(targetCount);

    try {
      const nextItems = await fetchBrowseBatch(targetCount);
      state.browseItems.push(...nextItems);

      if (nextItems.length < targetCount && !state.browseBuffer.length) {
        state.browseHasMore = false;
      }
    } catch (error) {
      console.warn(error);
      state.browseHasMore = false;
    } finally {
      state.browseLoading = false;
      renderBrowseGrid();
      renderFeedMeta();
    }
  }

  function setupBrowseObserver() {
    state.browseObserver?.disconnect();

    const sentinel = document.querySelector("#browseSentinel");

    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    state.browseObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreBrowseItems();
        }
      },
      { rootMargin: "600px 0px" },
    );
    state.browseObserver.observe(sentinel);
  }

  function carouselSlideTemplate(item, animationClass = "") {
    const image = item.backdrop || item.poster || imageFallback(item.title, true);
    const watchUrl = api().buildWatchUrl(item);

    return `
      <article class="absolute inset-0 h-full overflow-hidden ${animationClass}">
        <img
          class="absolute inset-0 h-full w-full object-cover opacity-85"
          src="${image}"
          alt=""
          onerror="this.onerror=null;this.src='${imageFallback(item.title, true)}';"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20"></div>
        <div class="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 to-transparent"></div>

        <div class="relative z-10 flex h-full max-w-4xl flex-col justify-end p-5 md:p-8">
          <div class="mb-4 flex items-center gap-3 text-sm text-slate-300">
            <span class="rounded-full bg-sky-400/15 px-3 py-1 font-black uppercase text-sky-300">${api().mediaLabel(item.mediaType)}</span>
            <span>${escapeHtml(item.year)}</span>
            <span class="rounded-full bg-blue-500/20 px-3 py-1 font-black text-sky-200">${escapeHtml(item.rating)}</span>
          </div>

          <h2 class="max-w-3xl text-4xl font-black leading-none text-slate-50 md:text-6xl">
            ${
              item.logo
                ? `<img class="title-logo max-h-20 w-auto max-w-[min(28rem,78vw)] object-contain object-left md:max-h-28" src="${item.logo}" alt="${escapeHtml(item.title)}" decoding="async" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');" /><span class="hidden">${escapeHtml(item.title)}</span>`
                : escapeHtml(item.title)
            }
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

  function attachCarouselSwipe(carousel) {
    if (carousel.dataset.swipeReady === "true") {
      return;
    }

    carousel.dataset.swipeReady = "true";

    const resetSwipe = () => {
      state.carouselPointerId = null;
      state.carouselStartX = 0;
      state.carouselStartY = 0;
    };

    carousel.addEventListener("pointerdown", (event) => {
      if (
        !event.isPrimary ||
        state.carouselChanging ||
        event.target.closest("a, button, input, select, textarea")
      ) {
        return;
      }

      state.carouselPointerId = event.pointerId;
      state.carouselStartX = event.clientX;
      state.carouselStartY = event.clientY;
      window.clearTimeout(state.carouselTimer);
      carousel.setPointerCapture?.(event.pointerId);
    });

    carousel.addEventListener("pointerup", (event) => {
      if (state.carouselPointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - state.carouselStartX;
      const deltaY = event.clientY - state.carouselStartY;
      const isSwipe =
        Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

      resetSwipe();

      if (isSwipe) {
        changeSlide(state.activeSlide + (deltaX < 0 ? 1 : -1));
      } else {
        startCarouselTimer();
      }
    });

    carousel.addEventListener("pointercancel", () => {
      if (state.carouselPointerId === null) {
        return;
      }

      resetSwipe();
      startCarouselTimer();
    });
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

    attachCarouselSwipe(carousel);
  }

  function changeSlide(nextIndex) {
    if (!state.carouselItems.length || state.carouselChanging) {
      return;
    }

    const normalizedIndex =
      (nextIndex + state.carouselItems.length) % state.carouselItems.length;

    if (normalizedIndex === state.activeSlide) {
      startCarouselTimer();
      return;
    }

    state.pendingSlide = normalizedIndex;
    state.slideDirection = normalizedIndex > state.activeSlide ? "left" : "right";
    state.carouselChanging = true;
    renderCarousel();

    window.clearTimeout(state.carouselTransitionTimer);
    state.carouselTransitionTimer = window.setTimeout(() => {
      state.activeSlide = normalizedIndex;
      state.pendingSlide = normalizedIndex;
      state.carouselChanging = false;
      renderCarousel();
      startCarouselTimer();
    }, 540);
  }

  function startCarouselTimer() {
    window.clearTimeout(state.carouselTimer);

    if (!state.carouselItems.length || document.hidden) {
      return;
    }

    state.carouselTimer = window.setTimeout(() => {
      changeSlide(state.activeSlide + 1);
    }, 8000);
  }

  function configureHomeSections() {
    const isHome = state.catalogFilter === "all";
    const isMovies = state.catalogFilter === "movie";
    const page = document.querySelector("#catalogPage");
    const carousel = document.querySelector("#trendingCarousel");

    page?.setAttribute(
      "aria-label",
      isHome ? "RainFlix home" : isMovies ? "Movies catalog" : "Series catalog",
    );
    carousel?.setAttribute(
      "aria-label",
      isHome ? "Featured movies" : isMovies ? "Featured movies" : "Featured series",
    );

    setSectionVisible("#trendingSection", true);
    setSectionVisible("#newestMoviesSection", isHome || isMovies);
    setSectionVisible("#newestSeriesSection", isHome || !isMovies);
    setSectionVisible("#browseSection", true);

    setText(
      "#trendingTitle",
      isHome ? "Trending this week" : isMovies ? "Trending movies" : "Trending series",
    );
    setText("#newestMoviesTitle", "Newest movies");
    setText("#newestSeriesTitle", "Newest series");
    setText(
      "#browseTitle",
      isHome ? "Browse" : isMovies ? "Browse movies" : "Browse series",
    );
  }

  function renderVisibleSkeletons() {
    renderSkeleton("#trendingGrid");
    renderSkeleton("#newestMoviesGrid");
    renderSkeleton("#newestSeriesGrid");
    renderBrowseGrid(browseBatchSize());
  }

  async function loadHomeFeeds(loadId) {
    configureHomeSections();
    renderCarousel();
    renderVisibleSkeletons();

    let carouselFeed;
    let trendingFeed;
    let movieFeed = { items: [] };
    let seriesFeed = { items: [] };

    if (state.catalogFilter === "all") {
      [carouselFeed, trendingFeed, movieFeed, seriesFeed] = await Promise.all([
        api().getTrendingMovies(api().PAGE_SIZE),
        api().getTrendingThisWeek(api().PAGE_SIZE),
        api().getNewestMovies(api().PAGE_SIZE),
        api().getNewestSeries(api().PAGE_SIZE),
      ]);
    } else if (state.catalogFilter === "movie") {
      [trendingFeed, movieFeed] = await Promise.all([
        api().getTrending({ filter: "movie", page: 1, limit: api().PAGE_SIZE }),
        api().getNewestMovies(api().PAGE_SIZE),
      ]);
      carouselFeed = trendingFeed;
    } else {
      [trendingFeed, seriesFeed] = await Promise.all([
        api().getTrending({ filter: "tv", page: 1, limit: api().PAGE_SIZE }),
        api().getNewestSeries(api().PAGE_SIZE),
      ]);
      carouselFeed = trendingFeed;
    }

    if (
      loadId !== state.carouselLoadId ||
      !document.querySelector("#trendingCarousel")
    ) {
      return;
    }

    state.carouselItems = carouselFeed.items || carouselFeed || [];
    state.trending = trendingFeed.items || [];
    state.newestMovies = movieFeed.items || [];
    state.newestSeries = seriesFeed.items || [];

    const visibleFeeds = [carouselFeed, trendingFeed, movieFeed, seriesFeed];

    state.sources = new Set(visibleFeeds.map((feed) => feed.source).filter(Boolean));
    state.activeSlide = 0;
    state.carouselChanging = false;
    state.pendingSlide = 0;
    state.slideDirection = "left";

    const featuredItem = state.carouselItems[0];

    if (featuredItem) {
      window.RainFlixSetBackdrop?.(
        featuredItem.backdrop ||
          featuredItem.poster ||
          imageFallback(featuredItem.title, true),
      );
    }

    renderCarousel();
    renderFeedMeta();
    renderGrid("#trendingGrid", state.trending, "No trending titles found.");
    renderGrid("#newestMoviesGrid", state.newestMovies, "No titles found.");
    renderGrid("#newestSeriesGrid", state.newestSeries, "No newest series found.");
    startCarouselTimer();
    setupBrowseObserver();
    await loadMoreBrowseItems();

    api()
      .getTitleLogos(state.carouselItems)
      .then((items) => {
        if (loadId !== state.carouselLoadId || !items.length) {
          return;
        }

        state.carouselItems = items;
        renderCarousel();
        startCarouselTimer();
      })
      .catch(() => {});
  }

  window.initHomePage = function initHomePage(context = {}) {
    state.catalogFilter =
      context.routeName === "movies"
        ? "movie"
        : context.routeName === "series"
          ? "tv"
          : "all";
    document.title =
      state.catalogFilter === "movie"
        ? "Movies | RainFlix"
        : state.catalogFilter === "tv"
          ? "Series | RainFlix"
          : "RainFlix";
    window.clearTimeout(state.carouselTimer);
    window.clearTimeout(state.carouselTransitionTimer);

    state.activeSlide = 0;
    state.browseObserver?.disconnect();
    state.carouselChanging = false;
    state.carouselItems = [];
    state.carouselPointerId = null;
    state.carouselStartX = 0;
    state.carouselStartY = 0;
    state.newestMovies = [];
    state.newestSeries = [];
    state.trending = [];
    state.sources = new Set();
    resetBrowseState();

    const loadId = ++state.carouselLoadId;

    return loadHomeFeeds(loadId).catch(() => {
      if (loadId !== state.carouselLoadId) {
        return;
      }

      renderFeedMeta();
      renderGrid("#trendingGrid", [], "Trending titles could not load.");
      renderGrid("#newestMoviesGrid", [], "Titles could not load.");
      renderGrid("#newestSeriesGrid", [], "Newest series could not load.");
      state.browseHasMore = false;
      state.browseLoading = false;
      renderBrowseGrid();
    });
  };

  window.destroyHomePage = function destroyHomePage() {
    state.carouselLoadId += 1;
    state.browseObserver?.disconnect();
    state.carouselItems = [];
    window.clearTimeout(state.carouselTimer);
    window.clearTimeout(state.carouselTransitionTimer);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearTimeout(state.carouselTimer);
    } else {
      renderCarousel();
      startCarouselTimer();
    }
  });
})();
