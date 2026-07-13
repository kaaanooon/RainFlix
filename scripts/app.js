(function () {
  const LOADER_POSTER_CACHE_KEY = "rainflix:loader-posters:v1";
  const loadedScripts = new Set();
  let activeRouteRequest = 0;
  let hasBootCompleted = false;
  let loaderFallbackTimer;
  let loaderHideTimer;
  let loaderShownAt = 0;

  const routes = {
    home: {
      html: "./pages/home.html",
      script: "./pages/home.js",
      init: "initHomePage",
      destroy: "destroyHomePage",
    },
    movies: {
      html: "./pages/home.html",
      script: "./pages/home.js",
      init: "initHomePage",
      destroy: "destroyHomePage",
    },
    series: {
      html: "./pages/home.html",
      script: "./pages/home.js",
      init: "initHomePage",
      destroy: "destroyHomePage",
    },
    genre: {
      html: "./pages/home.html",
      script: "./pages/home.js",
      init: "initHomePage",
      destroy: "destroyHomePage",
    },
    watch: {
      html: "./pages/watch.html",
      script: "./pages/watch.js",
      init: "initWatchPage",
    },
  };

  function getRoute(hashValue = window.location.hash) {
    const hash = (hashValue || "#home").replace(/^#/, "");
    const [path] = hash.split("?");
    const parts = path.split("/").filter(Boolean);
    const routeName = routes[parts[0]] ? parts[0] : "home";

    return {
      routeName,
      params: {
        mediaType: parts[1] || "",
        id: parts[2] || "",
        season: parts[3] || "1",
        episode: parts[4] || "1",
        genre: routeName === "genre" ? parts[1] || "" : "",
      },
    };
  }

  function shouldScrollToTop(nextRoute) {
    const previousRoute = window.RainFlixCurrentRoute;

    if (!previousRoute) {
      return true;
    }

    const sameWatchTitle =
      previousRoute.routeName === "watch" &&
      nextRoute.routeName === "watch" &&
      previousRoute.params.mediaType === nextRoute.params.mediaType &&
      previousRoute.params.id === nextRoute.params.id;

    return !sameWatchTitle;
  }

  function scrollToTopNow() {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function loaderTimeout() {
    return Math.max(
      3000,
      Number(window.RAINFLIX_CONFIG?.appReadyTimeoutMs) || 3500,
    );
  }

  function loaderMinimumDuration() {
    return Math.max(
      1200,
      Number(window.RAINFLIX_CONFIG?.appReadyMinimumMs) || 2400,
    );
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function cachedLoaderPosters() {
    try {
      const posters = JSON.parse(
        window.localStorage.getItem(LOADER_POSTER_CACHE_KEY) || "[]",
      );
      return Array.isArray(posters) ? posters : [];
    } catch (error) {
      return [];
    }
  }

  function cacheLoaderPosters(posters) {
    try {
      window.localStorage.setItem(
        LOADER_POSTER_CACHE_KEY,
        JSON.stringify([...new Set(posters.filter(Boolean))].slice(0, 35)),
      );
    } catch (error) {
      // Poster caching is optional when storage is unavailable.
    }
  }

  function populateAppLoader(posters = [], options = {}) {
    const wall = document.querySelector("#appLoaderWall");
    const uniquePosters = [...new Set(posters.filter(Boolean))];

    if (options.cache !== false && uniquePosters.length) {
      cacheLoaderPosters(uniquePosters);
    }

    if (
      !wall ||
      hasBootCompleted ||
      wall.dataset.populated === "true" ||
      !uniquePosters.length
    ) {
      return;
    }

    wall.dataset.populated = "true";
    const columnCount = 7;
    const cardsPerColumn = 5;
    wall.innerHTML = Array.from({ length: columnCount }, (_, columnIndex) => {
      const cards = Array.from({ length: cardsPerColumn }, (_, cardIndex) => {
        const posterIndex =
          (columnIndex * cardsPerColumn + cardIndex * 3) % uniquePosters.length;
        return `
          <div class="app-loader-card">
            <img src="${escapeAttribute(uniquePosters[posterIndex])}" alt="" loading="eager" decoding="async" draggable="false" />
          </div>
        `;
      }).join("");
      const direction = columnIndex % 2 === 0 ? "up" : "down";

      return `
        <div class="app-loader-column app-loader-column-${direction}">
          <div class="app-loader-column-track">
            <div class="app-loader-sequence">${cards}</div>
            <div class="app-loader-sequence" aria-hidden="true">${cards}</div>
          </div>
        </div>
      `;
    }).join("");

    const images = [...wall.querySelectorAll("img")];
    Promise.all(
      images.map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
      ),
    ).then(() => {
      if (!hasBootCompleted) {
        wall.classList.add("is-ready");
      }
    });
  }

  function hideAppLoader(requestId, force = false) {
    const loader = document.querySelector("#appLoader");

    if (
      !loader ||
      hasBootCompleted ||
      (!force && String(requestId) !== loader.dataset.requestId)
    ) {
      return;
    }

    const finish = () => {
      hasBootCompleted = true;
      document.documentElement.classList.remove("app-is-loading");
      loader.classList.add("is-hidden");
      loader.setAttribute("aria-hidden", "true");
    };
    const elapsed = performance.now() - loaderShownAt;
    const remaining = force
      ? 0
      : Math.max(0, loaderMinimumDuration() - elapsed);

    window.clearTimeout(loaderFallbackTimer);
    window.clearTimeout(loaderHideTimer);

    if (remaining > 0) {
      loaderHideTimer = window.setTimeout(finish, remaining);
    } else {
      finish();
    }
  }

  function showAppLoader(requestId) {
    const loader = document.querySelector("#appLoader");

    if (!loader || hasBootCompleted) {
      return;
    }

    window.clearTimeout(loaderFallbackTimer);
    window.clearTimeout(loaderHideTimer);
    loaderShownAt ||= performance.now();
    document.documentElement.classList.add("app-is-loading");
    loader.dataset.requestId = String(requestId);
    loader.classList.remove("is-hidden");
    loader.setAttribute("aria-hidden", "false");
    loaderFallbackTimer = window.setTimeout(
      () => hideAppLoader(requestId),
      loaderTimeout(),
    );
  }

  function setAmbientBackdrop(imageUrl) {
    const backdrop = document.querySelector("#ambientBackdrop");

    if (!backdrop || !imageUrl) {
      return;
    }

    backdrop.style.backgroundImage = `url("${String(imageUrl).replace(/"/g, "%22")}")`;
    backdrop.classList.add("is-visible");
  }

  function handleImmediateTitleScroll(event) {
    const link = event.target.closest('a[href^="#watch/"]');

    if (
      !link ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (shouldScrollToTop(getRoute(link.getAttribute("href")))) {
      scrollToTopNow();
    }
  }

  async function injectHtml(selector, path, requestId = 0) {
    const container = document.querySelector(selector);

    if (!container) {
      return;
    }

    const response = await fetch(path, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }

    const html = await response.text();

    if (requestId && requestId !== activeRouteRequest) {
      return false;
    }

    container.innerHTML = html;
    return true;
  }

  function loadScript(path) {
    if (loadedScripts.has(path)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = path;
      script.defer = true;
      script.onload = () => {
        loadedScripts.add(path);
        resolve();
      };
      script.onerror = () => reject(new Error(`Unable to load ${path}`));
      document.body.appendChild(script);
    });
  }

  async function loadShell() {
    await injectHtml("#site-header", "./components/header.html");
    await loadScript("./components/header.js");
    window.initHeader?.();

    await injectHtml("#site-footer", "./components/footer.html");
  }

  async function loadRoute() {
    const requestId = ++activeRouteRequest;
    if (!hasBootCompleted) {
      showAppLoader(requestId);
    }
    const currentRoute = getRoute();
    const { routeName, params } = currentRoute;
    const route = routes[routeName];
    const scrollToTop = shouldScrollToTop(currentRoute);
    const previousRouteName = window.RainFlixCurrentRoute?.routeName;

    window.updateHeaderRoute?.(routeName, params);

    if (previousRouteName && previousRouteName !== routeName) {
      const destroyName = routes[previousRouteName]?.destroy;
      window[destroyName]?.();
    }

    if (scrollToTop) {
      scrollToTopNow();
    }

    const appView = document.querySelector("#app-view");
    appView?.setAttribute("aria-busy", "true");

    const routeInjected = await injectHtml("#app-view", route.html, requestId);

    if (!routeInjected) {
      return;
    }

    await loadScript(route.script);

    if (requestId !== activeRouteRequest) {
      return;
    }

    window.RainFlixCurrentRoute = currentRoute;

    const initResult = window[route.init]?.({
      routeName,
      params,
      isCurrent: () => requestId === activeRouteRequest,
    });

    if (initResult && typeof initResult.then === "function") {
      await initResult;
    }

    if (requestId !== activeRouteRequest) {
      return;
    }

    appView?.setAttribute("aria-busy", "false");
    hideAppLoader(requestId);

    appView?.focus({ preventScroll: true });
  }

  function renderLoadError(error) {
    const appView = document.querySelector("#app-view");

    if (appView) {
      appView.setAttribute("aria-busy", "false");
      appView.innerHTML = `
        <section class="mx-auto my-20 w-[min(680px,calc(100%-2rem))] rounded-lg border border-blue-900/70 bg-blue-950/30 p-7 text-slate-400">
          <h1 class="m-0 mb-3 text-2xl font-black text-slate-50">RainFlix could not load this view.</h1>
          <p class="mt-2">${error.message}</p>
          <p class="mt-2">Serve the folder with a local web server and open the localhost URL.</p>
        </section>
      `;
    }

    hideAppLoader(activeRouteRequest, true);
  }

  async function initApp() {
    showAppLoader("boot");
    const savedPosters = cachedLoaderPosters();
    populateAppLoader(
      savedPosters.length
        ? savedPosters
        : window.RainFlixApi?.getLoaderPosters?.(28),
      { cache: false },
    );

    try {
      await loadShell();
      await loadRoute();
      document.addEventListener("click", handleImmediateTitleScroll);

      window.addEventListener("hashchange", () => {
        loadRoute().catch(renderLoadError);
      });
      document.addEventListener("dragstart", (event) => {
        if (event.target instanceof HTMLImageElement) {
          event.preventDefault();
        }
      });
    } catch (error) {
      renderLoadError(error);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
  window.RainFlixSetBackdrop = setAmbientBackdrop;
  window.RainFlixPopulateLoader = populateAppLoader;
})();
