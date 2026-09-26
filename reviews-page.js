(() => {
  "use strict";

  const config = window.WEBENDRA_REVIEWS_CONFIG || {};
  const client = config.supabaseUrl && config.publishableKey && window.supabase
    ? window.supabase.createClient(config.supabaseUrl, config.publishableKey)
    : null;
  const pageSize = 8;
  const artwork = new URLSearchParams(location.search).get("artwork")?.toLowerCase();
  const character = characters.find((entry) => entry.name.toLowerCase() === artwork);
  const grid = document.querySelector("#artwork-grid");
  const overview = document.querySelector("#reviews-overview");
  const detail = document.querySelector("#artwork-detail");
  const form = document.querySelector("#detail-form");
  const ratingInputs = [...form.querySelectorAll('input[name="rating"]')];
  const nameInput = document.querySelector("#review-name");
  const bodyInput = document.querySelector("#review-body");
  const submitButton = document.querySelector("#review-submit");
  const formStatus = document.querySelector("#form-status");
  const captchaBox = document.querySelector("#review-captcha");
  const reviewList = document.querySelector("#review-list");
  const loadMore = document.querySelector("#load-more");
  const latestButton = document.querySelector("#sort-latest");
  const topButton = document.querySelector("#sort-top");
  let summary = null;
  let ownReview = null;
  let ownLoaded = false;
  let formDirty = false;
  let sort = "latest";
  let offset = 0;
  let listRequest = 0;
  let turnstileLoading = null;

  function stars(value) {
    const filled = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return "★".repeat(filled) + "☆".repeat(5 - filled);
  }

  function ratingText(data) {
    const count = Number(data?.rating_count) || 0;
    return count ? `${Number(data.average_rating).toFixed(1)} / 5 · ${count} rating${count === 1 ? "" : "s"}` : "No ratings yet";
  }

  function setRating(value) {
    const selected = Number(value) || 0;
    ratingInputs.forEach((input) => {
      input.checked = Number(input.value) === selected;
      input.parentElement.classList.toggle("is-selected", Number(input.value) <= selected);
    });
  }

  function makeCard(entry) {
    const link = document.createElement("a");
    link.className = "artwork-card";
    link.href = `/reviews.html?artwork=${entry.name.toLowerCase()}`;
    link.setAttribute("aria-label", `Reviews for ${entry.name}`);
    const image = document.createElement("img");
    image.src = entry.image;
    image.alt = entry.alt;
    image.width = 126;
    image.height = 126;
    image.loading = "lazy";
    const name = document.createElement("strong");
    name.className = "artwork-card-name";
    name.textContent = entry.displayName || entry.name;
    const starLine = document.createElement("span");
    starLine.className = "card-stars";
    starLine.textContent = stars(0);
    starLine.setAttribute("aria-hidden", "true");
    const rating = document.createElement("span");
    rating.className = "card-rating";
    rating.textContent = "Loading ratings…";
    link.append(image, name, starLine, rating);
    grid.append(link);
    return { starLine, rating };
  }

  async function showOverview() {
    detail.hidden = true;
    overview.hidden = false;
    document.querySelector("#overview-count").textContent = `${characters.length} artworks`;
    const cardElements = new Map(characters.map((entry) => [entry.name.toLowerCase(), makeCard(entry)]));
    const status = document.querySelector("#overview-status");
    if (!client) {
      status.textContent = "Ratings are unavailable at the moment.";
      cardElements.forEach(({ rating }) => { rating.textContent = "Ratings unavailable"; });
      return;
    }
    try {
      const { data, error } = await client.from("review_summary")
        .select("character_slug,average_rating,rating_count,review_count");
      if (error) throw error;
      const summaries = new Map((data || []).map((item) => [item.character_slug, item]));
      cardElements.forEach(({ starLine, rating }, slug) => {
        const item = summaries.get(slug);
        starLine.textContent = stars(item?.average_rating);
        rating.textContent = ratingText(item);
      });
      status.textContent = "";
    } catch {
      status.textContent = navigator.onLine ? "Ratings could not be loaded." : "Ratings need a connection.";
      cardElements.forEach(({ rating }) => { rating.textContent = "Ratings unavailable"; });
    }
  }

  function renderDetailSummary() {
    const target = document.querySelector("#detail-summary");
    target.replaceChildren();
    const starLine = document.createElement("span");
    starLine.className = "detail-stars";
    starLine.textContent = stars(summary?.average_rating);
    starLine.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = ratingText(summary);
    target.append(starLine, text);
    const count = Number(summary?.review_count) || 0;
    document.querySelector("#written-count").textContent = count ? `(${count})` : "";
  }

  async function loadSummary() {
    if (!client) return;
    try {
      const { data, error } = await client.from("review_summary")
        .select("average_rating,rating_count,review_count")
        .eq("character_slug", artwork).maybeSingle();
      if (error) throw error;
      summary = data;
      renderDetailSummary();
    } catch {
      document.querySelector("#detail-summary").textContent = navigator.onLine
        ? "Ratings could not be loaded." : "Ratings need a connection.";
    }
  }

  async function loadOwnReview() {
    if (!client) return;
    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (session) {
        const { data, error } = await client.rpc("own_review", { requested_slug: artwork });
        if (error) throw error;
        ownReview = data?.[0] || null;
        if (ownReview && !formDirty) {
          setRating(ownReview.rating);
          nameInput.value = ownReview.nickname || "";
          bodyInput.value = ownReview.review || "";
          submitButton.textContent = "Save changes";
        }
      }
      ownLoaded = true;
      submitButton.disabled = !config.turnstileSiteKey;
    } catch {
      formStatus.textContent = "Your rating could not be loaded. Refresh to try again.";
    }
  }

  function addReview(entry) {
    const article = document.createElement("article");
    article.className = "review-entry";
    const head = document.createElement("div");
    head.className = "entry-head";
    const author = document.createElement("strong");
    author.className = "entry-name";
    author.textContent = entry.nickname;
    const date = document.createElement("span");
    date.className = "entry-date";
    date.textContent = new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric",
    }).format(new Date(entry.created_at));
    head.append(author, date);
    const rating = document.createElement("div");
    rating.className = "entry-stars";
    rating.textContent = stars(entry.rating);
    rating.setAttribute("aria-label", `${entry.rating} out of 5 stars`);
    const body = document.createElement("p");
    body.className = "entry-body";
    body.textContent = entry.review;
    article.append(head, rating, body);
    reviewList.append(article);
  }

  async function loadReviews(reset = false) {
    const request = ++listRequest;
    if (reset) {
      offset = 0;
      reviewList.innerHTML = '<p class="empty-message">Loading reviews…</p>';
    }
    loadMore.disabled = true;
    if (!client) {
      reviewList.innerHTML = '<p class="empty-message">Reviews are unavailable at the moment.</p>';
      loadMore.hidden = true;
      return;
    }
    const requestedOffset = offset;
    try {
      let query = client.from("review_entries")
        .select("id,rating,nickname,review,created_at")
        .eq("character_slug", artwork).not("review", "is", null);
      if (sort === "top") query = query.order("rating", { ascending: false });
      const { data, error } = await query.order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(requestedOffset, requestedOffset + pageSize - 1);
      if (error) throw error;
      if (request !== listRequest) return;
      if (reset) reviewList.replaceChildren();
      (data || []).forEach(addReview);
      offset += data?.length || 0;
      if (!offset) reviewList.innerHTML = '<p class="empty-message">No written reviews yet.</p>';
      loadMore.hidden = (data?.length || 0) < pageSize;
    } catch {
      if (request !== listRequest) return;
      if (reset) reviewList.innerHTML = `<p class="empty-message">${navigator.onLine
        ? "Reviews could not be loaded. Refresh to try again."
        : "Reviews need a connection."}</p>`;
      loadMore.hidden = true;
    } finally {
      if (request === listRequest) loadMore.disabled = false;
    }
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileLoading) return turnstileLoading;
    turnstileLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Verification unavailable."));
      script.onerror = () => reject(new Error("Verification unavailable."));
      document.head.append(script);
    }).catch((error) => { turnstileLoading = null; throw error; });
    return turnstileLoading;
  }

  async function ensureSession() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session) return session;
    const turnstile = await loadTurnstile();
    captchaBox.hidden = false;
    captchaBox.replaceChildren();
    formStatus.textContent = "Complete verification to post.";
    const token = await new Promise((resolve, reject) => {
      turnstile.render(captchaBox, {
        sitekey: config.turnstileSiteKey,
        callback: resolve,
        "error-callback": () => reject(new Error("Verification failed. Try again.")),
      });
    });
    const { data, error: signInError } = await client.auth.signInAnonymously({
      options: { captchaToken: token },
    });
    captchaBox.hidden = true;
    if (signInError) throw signInError;
    return data.session;
  }

  async function submit(event) {
    event.preventDefault();
    if (!client || !ownLoaded || !config.turnstileSiteKey) return;
    const rating = Number(form.elements.rating.value);
    const nickname = nameInput.value.trim();
    const review = bodyInput.value.trim();
    if (!rating) { formStatus.textContent = "Choose a star rating."; return; }
    if (review && (nickname.length < 2 || nickname.length > 30)) {
      formStatus.textContent = "Enter a name of 2–30 characters for a written review.";
      nameInput.focus();
      return;
    }
    submitButton.disabled = true;
    formStatus.textContent = "Saving…";
    try {
      const session = await ensureSession();
      if (!session) throw new Error("Sign-in failed. Try again.");
      const values = { rating, nickname: review ? nickname : null, review: review || null };
      const result = ownReview
        ? await client.from("review_entries").update(values).eq("id", ownReview.id)
        : await client.from("review_entries").insert({ ...values, character_slug: artwork });
      if (result.error) throw result.error;
      formStatus.textContent = review ? "Review saved." : "Rating saved.";
      formDirty = false;
      await Promise.all([loadSummary(), loadOwnReview(), loadReviews(true)]);
    } catch (error) {
      formStatus.textContent = navigator.onLine
        ? (error.message || "Rating could not be saved. Try again.")
        : "Connect to the internet to save your rating.";
    } finally {
      captchaBox.hidden = true;
      submitButton.disabled = !client || !config.turnstileSiteKey || !ownLoaded;
    }
  }

  function showDetail() {
    overview.hidden = true;
    detail.hidden = false;
    document.title = `${character.name} reviews — Webendra`;
    document.querySelector("#detail-title").textContent = character.displayName || character.name;
    const image = document.querySelector("#detail-image");
    image.src = character.image;
    image.alt = character.alt;
    const galleryPath = `/character/${artwork}`;
    document.querySelector("#detail-artwork-link").href = galleryPath;
    document.querySelector("#detail-gallery-link").href = galleryPath;
    renderDetailSummary();
    if (!client) formStatus.textContent = "Reviews are unavailable at the moment.";
    else if (!config.turnstileSiteKey) formStatus.textContent = "Posting is being set up.";
    loadSummary();
    loadOwnReview();
    loadReviews(true);
  }

  ratingInputs.forEach((input) => input.addEventListener("change", () => {
    formDirty = true;
    setRating(input.value);
  }));
  nameInput.addEventListener("input", () => { formDirty = true; });
  bodyInput.addEventListener("input", () => {
    formDirty = true;
    submitButton.textContent = ownReview ? "Save changes" : (bodyInput.value.trim() ? "Post review" : "Post rating");
  });
  form.addEventListener("submit", submit);
  loadMore.addEventListener("click", () => loadReviews());
  for (const [button, selectedSort] of [[latestButton, "latest"], [topButton, "top"]]) {
    button.addEventListener("click", () => {
      if (sort === selectedSort) return;
      sort = selectedSort;
      latestButton.setAttribute("aria-pressed", String(sort === "latest"));
      topButton.setAttribute("aria-pressed", String(sort === "top"));
      loadReviews(true);
    });
  }
  if (character) showDetail();
  else showOverview();
})();
