(function () {
  const loadedScripts = new Set();
  let activeRouteRequest = 0;

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

    window.RainFlixCurrentRoute = currentRoute;
    appView?.setAttribute("aria-busy", "false");

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
  }

  async function initApp() {
    try {
      await loadShell();
      await loadRoute();
      document.addEventListener("click", handleImmediateTitleScroll);

      window.addEventListener("hashchange", () => {
        loadRoute().catch(renderLoadError);
      });
    } catch (error) {
      renderLoadError(error);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
  window.RainFlixSetBackdrop = setAmbientBackdrop;
})();
