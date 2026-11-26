(() => {
  async function requestJson(fetchImpl, url) {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  }

  function createEventLoader({ fetchImpl = globalThis.fetch.bind(globalThis), normalize = (item) => item, now = () => new Date() } = {}) {
    return async function loadEvents() {
      const healthRequest = requestJson(fetchImpl, "/api/v1/health").catch(() => null);
      const firstUrl = "/api/v1/editions?size=100&page=1";
      const head = await requestJson(fetchImpl, firstUrl);
      if (!head || !Array.isArray(head.items)) throw new Error("Invalid editions response");
      const total = Number(head.total);
      const pages = Math.max(1, Number(head.pages) || 1);
      if (!Number.isInteger(total) || total < 0 || !Number.isInteger(pages)) throw new Error("Invalid editions pagination");

      const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => {
        const url = `/api/v1/editions?size=100&page=${index + 2}`;
        return requestJson(fetchImpl, url);
      }));
      if (rest.some((page) => !page || !Array.isArray(page.items))) throw new Error("Invalid editions page");

      const rawItems = [head, ...rest].flatMap((page) => page.items);
      if (rawItems.length !== total) throw new Error(`Incomplete editions result: ${rawItems.length}/${total}`);
      const health = await healthRequest;
      return {
        items: rawItems.map(normalize),
        fetchedAt: new Date(now()).toISOString(),
        lastRefresh: typeof health?.last_refresh === "string" ? health.last_refresh : null,
      };
    };
  }

  globalThis.ContestEventSync = { createEventLoader };
})();
