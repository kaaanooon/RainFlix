(function () {
  const state = {
    details: null,
    episode: 1,
    playerSource: "vidsrc",
    season: 1,
    seasonDetails: null,
    similarItems: [],
  };

  const PLAYER_STORAGE_KEY = "rainflix:player-source";

  function api() {
    return window.RainFlixApi;
  }

  function escapeHtml(value) {
    return api().escapeHtml(value);
  }

  function imageFallback(title, wide = false) {
    return api().createImageFallback(title, wide);
  }

  function selectedEpisode() {
    return state.seasonDetails?.episodes?.find(
      (episode) => episode.episodeNumber === state.episode,
    );
  }

  function showLoading() {
    const loading = document.querySelector("#watchLoading");
    const content = document.querySelector("#watchContent");

    if (loading) {
      loading.innerHTML = `
        <div class="space-y-5">
          <div class="aspect-video w-full animate-pulse rounded-xl bg-blue-950/50"></div>
          <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_360px]">
            <div class="space-y-3">
              <div class="h-6 w-48 animate-pulse rounded bg-blue-950/60"></div>
              <div class="h-20 animate-pulse rounded-lg bg-blue-950/40"></div>
              <div class="h-20 animate-pulse rounded-lg bg-blue-950/40"></div>
            </div>
            <div class="h-40 animate-pulse rounded-xl bg-blue-950/40"></div>
          </div>
        </div>
      `;
      loading.classList.remove("hidden");
    }

    content?.classList.add("hidden");
  }

  function showContent() {
    document.querySelector("#watchLoading")?.classList.add("hidden");
    document.querySelector("#watchContent")?.classList.remove("hidden");
  }

  function renderError(message) {
    const loading = document.querySelector("#watchLoading");

    if (loading) {
      loading.innerHTML = `
        <h1 class="mb-2 text-2xl font-black text-slate-50">Title unavailable</h1>
        <p>${escapeHtml(message)}</p>
      `;
      loading.classList.remove("hidden");
    }

    document.querySelector("#watchContent")?.classList.add("hidden");
  }

  function renderHero() {
    const hero = document.querySelector("#watchHero");
    const details = state.details;

    if (!hero || !details) {
      return;
    }

    const image = details.backdrop || details.poster || imageFallback(details.title, true);
    let startText = "Start watching movie";

    window.RainFlixSetBackdrop?.(image);

    if (details.mediaType === "tv") {
      startText = `Start watching S${state.season}:E${state.episode}`;
    }

    hero.innerHTML = `
      <article class="relative h-[28rem] overflow-hidden">
        <img
          class="absolute inset-0 h-full w-full object-cover opacity-85"
          src="${image}"
          alt=""
          onerror="this.onerror=null;this.src='${imageFallback(details.title, true)}';"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-950/20"></div>
        <div class="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 to-transparent"></div>

        <div class="relative z-10 flex h-full max-w-4xl flex-col justify-end p-8">
          <div class="mb-4 flex items-center gap-3 text-sm text-slate-300">
            <span class="rounded-full bg-sky-400/15 px-3 py-1 font-black uppercase text-sky-300">${api().mediaLabel(details.mediaType)}</span>
            <span>${escapeHtml(details.year)}</span>
            <span class="rounded-full bg-blue-500/20 px-3 py-1 font-black text-sky-200">${escapeHtml(details.rating)}</span>
            ${details.runtime ? `<span>${escapeHtml(details.runtime)}</span>` : ""}
          </div>

          <h1 class="max-w-3xl text-5xl font-black leading-none text-slate-50 lg:text-6xl">
            ${
              details.logo
                ? `<img class="title-logo max-h-24 w-auto max-w-[min(30rem,78vw)] object-contain object-left lg:max-h-32" src="${details.logo}" alt="${escapeHtml(details.title)}" decoding="async" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');" /><span class="hidden">${escapeHtml(details.title)}</span>`
                : escapeHtml(details.title)
            }
          </h1>

          <p class="mt-5 line-clamp-4 max-w-2xl text-base leading-7 text-slate-300">
            ${escapeHtml(details.synopsis)}
          </p>

          <button
            class="mt-5 w-fit rounded-lg bg-sky-400 px-6 py-3 text-sm font-black text-slate-950 shadow-xl shadow-sky-500/20 transition hover:bg-sky-300 focus-visible:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/25"
            type="button"
            data-scroll-player
          >
            ${escapeHtml(startText)}
          </button>
        </div>
      </article>
    `;

    hero.querySelector("[data-scroll-player]")?.addEventListener("click", () => {
      document.querySelector("#playerShell")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function renderDetailsPanel() {
    const panel = document.querySelector("#detailsPanel");
    const details = state.details;
    const episode = selectedEpisode();

    if (!panel || !details) {
      return;
    }

    panel.innerHTML = `
      <div class="flex gap-4">
        <img
          class="h-32 w-24 shrink-0 rounded-lg object-cover"
          src="${details.poster || details.backdrop || imageFallback(details.title)}"
          alt=""
          onerror="this.onerror=null;this.src='${imageFallback(details.title)}';"
        />
        <div class="min-w-0">
          <p class="text-xs font-black uppercase tracking-wider text-sky-300">${api().mediaLabel(details.mediaType)}</p>
          <h2 class="mt-1 text-xl font-black leading-tight text-slate-50">${escapeHtml(details.title)}</h2>
          <p class="mt-2 text-sm text-slate-400">${escapeHtml(details.year)} &middot; ${escapeHtml(details.rating)} rating</p>
        </div>
      </div>

      <div class="mt-5 border-t border-blue-900/70 pt-5">
        <h3 class="text-sm font-black uppercase tracking-wider text-slate-300">Synopsis</h3>
        <p class="mt-3 text-sm leading-6 text-slate-400">${escapeHtml(details.synopsis)}</p>
      </div>

      ${
        details.mediaType === "tv" && episode
          ? `
            <div class="mt-5 border-t border-blue-900/70 pt-5">
              <h3 class="text-sm font-black uppercase tracking-wider text-slate-300">Current episode</h3>
              <p class="mt-3 font-bold text-slate-100">S${state.season}:E${state.episode} ${escapeHtml(episode.title)}</p>
              <p class="mt-2 text-sm leading-6 text-slate-400">${escapeHtml(episode.synopsis)}</p>
            </div>
          `
          : ""
      }
    `;
  }

  function similarCardTemplate(item) {
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

  function renderSimilarSection() {
    const section = document.querySelector("#similarSection");
    const grid = document.querySelector("#similarGrid");

    if (!section || !grid) {
      return;
    }

    if (!state.similarItems.length) {
      section.classList.add("hidden");
      grid.innerHTML = "";
      return;
    }

    section.classList.remove("hidden");
    grid.innerHTML = state.similarItems
      .slice(0, api().PAGE_SIZE)
      .map(similarCardTemplate)
      .join("");
  }

  function currentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function syncFullscreenButton() {
    const frame = document.querySelector("[data-player-frame]");
    const button = document.querySelector("[data-player-fullscreen]");

    if (!frame || !button) {
      return;
    }

    const isFullscreen = currentFullscreenElement() === frame;
    const label = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", String(isFullscreen));
  }

  async function togglePlayerFullscreen() {
    const frame = document.querySelector("[data-player-frame]");

    if (!frame) {
      return;
    }

    try {
      if (currentFullscreenElement()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } else if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      } else if (frame.webkitRequestFullscreen) {
        frame.webkitRequestFullscreen();
      }
    } catch (error) {
      // Providers can still expose their own fullscreen control.
    }
  }

  function renderPlayer() {
    const shell = document.querySelector("#playerShell");
    const sourceShell = document.querySelector("#playerSourceShell");
    const details = state.details;

    if (!shell || !sourceShell || !details) {
      return;
    }

    const sources = api().buildStreamSources({
      mediaType: details.mediaType,
      id: details.id,
      season: state.season,
      episode: state.episode,
    });
    const activeSource =
      sources.find((source) => source.id === state.playerSource) || sources[0];

    if (!activeSource) {
      shell.innerHTML = `
        <div class="aspect-video w-full bg-black p-6 text-sm text-slate-400">
          No streaming sources are configured.
        </div>
      `;
      sourceShell.innerHTML = "";
      return;
    }

    state.playerSource = activeSource.id;

    shell.innerHTML = `
      <div class="player-frame group relative aspect-video w-full overflow-hidden bg-black" data-player-frame>
        <div class="absolute inset-0 grid place-items-center bg-slate-950" data-player-loading aria-hidden="true">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-blue-950 border-t-sky-400"></div>
        </div>
        <button
          class="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-lg border border-white/15 bg-black/70 text-xl text-white opacity-0 shadow-xl backdrop-blur transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/90 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          type="button"
          data-player-fullscreen
          aria-label="Enter fullscreen"
          aria-pressed="false"
          title="Enter fullscreen"
        >
          <span aria-hidden="true">&#x26F6;</span>
        </button>
        <iframe
          class="absolute inset-0 h-full w-full bg-black"
          src="${escapeHtml(activeSource.url)}"
          title="${escapeHtml(details.title)} ${escapeHtml(activeSource.label)} player"
          allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true"
          frameborder="0"
          loading="eager"
          referrerpolicy="origin"
        ></iframe>
      </div>
    `;

    shell.querySelector("iframe")?.addEventListener("load", () => {
      shell.querySelector("[data-player-loading]")?.classList.add("hidden");
    });
    shell
      .querySelector("[data-player-fullscreen]")
      ?.addEventListener("click", togglePlayerFullscreen);
    syncFullscreenButton();

    sourceShell.innerHTML = `
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs font-black uppercase tracking-wider text-slate-400">Players</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Streaming source">
          ${sources
            .map((source) => {
              const isActive = source.id === activeSource.id;

              return `
                <button
                  class="rounded-lg border px-3 py-2 text-xs font-black transition ${isActive ? "border-sky-400 bg-sky-400 text-slate-950" : "border-blue-900/70 bg-slate-950/45 text-slate-300 hover:border-sky-500/70 hover:bg-sky-400/10 hover:text-sky-200"}"
                  type="button"
                  data-player-source="${escapeHtml(source.id)}"
                  aria-pressed="${isActive}"
                >
                  ${escapeHtml(source.label)}
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    sourceShell.querySelectorAll("[data-player-source]").forEach((button) => {
      button.addEventListener("click", () => {
        state.playerSource = button.getAttribute("data-player-source") || "vidsrc";
        try {
          window.localStorage.setItem(PLAYER_STORAGE_KEY, state.playerSource);
        } catch (error) {
          // Remembering a preference is optional when storage is unavailable.
        }
        renderPlayer();
      });
    });
  }

  function syncWatchHash() {
    if (!state.details) {
      return;
    }

    const hash = api().buildWatchUrl(state.details, state.season, state.episode);

    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }

  async function selectEpisode(episodeNumber) {
    state.episode = Number.parseInt(episodeNumber, 10) || 1;
    syncWatchHash();
    renderHero();
    renderDetailsPanel();
    renderEpisodeSection();
    renderPlayer();
  }

  async function loadSeason(seasonNumber) {
    state.season = Number.parseInt(seasonNumber, 10) || 1;
    state.episode = 1;
    state.seasonDetails = await api().getSeasonDetails(state.details.id, state.season);

    renderHero();
    renderDetailsPanel();
    renderEpisodeSection();

    renderPlayer();
  }

  function renderEpisodeSection() {
    const section = document.querySelector("#episodeSection");
    const details = state.details;

    if (!section || !details || details.mediaType !== "tv") {
      section?.classList.add("hidden");
      return;
    }

    const episodes = state.seasonDetails?.episodes || [];

    section.classList.remove("hidden");
    section.innerHTML = `
      <div class="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="episodesTitle" class="text-2xl font-black text-slate-50">
            Episodes
          </h2>
          ${
            state.seasonDetails?.synopsis
              ? `
                <p class="mt-2 text-sm text-slate-400">
                  ${escapeHtml(state.seasonDetails.synopsis)}
                </p>
              `
              : ""
          }
        </div>

        <label class="flex items-center gap-3 text-sm font-bold text-slate-300">
          Season
          <select
            id="seasonSelect"
            class="h-10 rounded-lg border border-blue-900/70 bg-blue-950/30 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10"
          >
            ${details.seasons
              .map(
                (season) => `
                  <option value="${season.seasonNumber}" ${season.seasonNumber === state.season ? "selected" : ""}>
                    ${escapeHtml(season.name)} (${season.episodeCount})
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
      </div>

      <div class="max-h-[24rem] overflow-y-auto rounded-xl border border-blue-900/70 bg-blue-950/20 p-2 md:max-h-[32rem]">
        <div class="grid grid-cols-1 gap-2">
        ${episodes
          .map((episode) => {
            const isActive = episode.episodeNumber === state.episode;

            return `
              <button
                class="group flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${isActive ? "border-sky-400 bg-sky-400/10" : "border-blue-900/60 bg-slate-950/35 hover:border-sky-500/70 hover:bg-sky-400/10"}"
                type="button"
                data-episode="${episode.episodeNumber}"
              >
                <span class="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-sky-400/15 text-xs font-black text-sky-300">
                  EP ${episode.episodeNumber}
                </span>
                <span class="min-w-0 truncate font-black text-slate-50">
                  ${escapeHtml(episode.title)}
                </span>
              </button>
            `;
          })
          .join("")}
        </div>
      </div>
    `;

    section.querySelector("#seasonSelect")?.addEventListener("change", (event) => {
      showLoading("Loading season...");
      loadSeason(event.target.value)
        .then(showContent)
        .catch(() => {
          showContent();
          renderEpisodeSection();
        });
    });

    section.querySelectorAll("[data-episode]").forEach((button) => {
      button.addEventListener("click", () => {
        selectEpisode(button.getAttribute("data-episode"));
      });
    });
  }

  window.initWatchPage = async function initWatchPage(context = {}) {
    const { mediaType, id, season, episode } = context.params || {};
    const isCurrent = context.isCurrent || (() => true);

    showLoading();

    if (!mediaType || !id) {
      renderError("Choose a movie or series from the catalog first.");
      return;
    }

    const normalizedType = api().normalizeMediaType(mediaType);
    const detailsPromise = api().getDetails(normalizedType, id);
    const similarPromise = api().getSimilar(
      normalizedType,
      id,
      api().PAGE_SIZE,
    );
    const details = await detailsPromise;

    if (!isCurrent()) {
      return;
    }

    if (!details) {
      renderError("RainFlix could not find metadata for this title.");
      return;
    }

    state.details = details;
    document.title = `${details.title} | RainFlix`;

    try {
      state.playerSource =
        window.localStorage.getItem(PLAYER_STORAGE_KEY) || state.playerSource;
    } catch (error) {
      // Keep the default source when storage is unavailable.
    }
    state.season = Number.parseInt(season, 10) || 1;
    state.episode = Number.parseInt(episode, 10) || 1;
    state.seasonDetails = null;
    state.similarItems = [];

    if (details.mediaType === "tv") {
      const seasonExists = details.seasons.some(
        (item) => item.seasonNumber === state.season,
      );
      state.season = seasonExists ? state.season : details.seasons[0]?.seasonNumber || 1;
      state.seasonDetails = await api().getSeasonDetails(details.id, state.season);

      if (!isCurrent()) {
        return;
      }

      const episodeExists = state.seasonDetails.episodes.some(
        (item) => item.episodeNumber === state.episode,
      );
      state.episode = episodeExists ? state.episode : 1;
    }

    const similarFeed = await similarPromise;

    if (!isCurrent()) {
      return;
    }

    state.similarItems = similarFeed.items || [];

    renderHero();
    renderPlayer();
    renderDetailsPanel();
    renderEpisodeSection();
    renderSimilarSection();
    showContent();
  };

  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
})();
