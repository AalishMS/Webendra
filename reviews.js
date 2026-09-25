(() => {
  const config = window.WEBENDRA_REVIEWS_CONFIG || {};
  const client = config.supabaseUrl && config.publishableKey && window.supabase
    ? window.supabase.createClient(config.supabaseUrl, config.publishableKey)
    : null;
  const submissionsReady = Boolean(config.turnstileSiteKey);
  const pageSize = 8;
  const summaryButton = document.querySelector("#review-summary");
  const summaryStars = summaryButton.querySelector(".review-summary-stars");
  const summaryText = document.querySelector("#review-summary-text");
  const dialog = document.querySelector("#review-dialog");
  const title = document.querySelector("#review-title");
  const dialogSummary = document.querySelector("#review-dialog-summary");
  const closeButton = document.querySelector("#review-close");
  const form = document.querySelector("#review-form");
  const nicknameInput = document.querySelector("#review-nickname");
  const reviewInput = document.querySelector("#review-text");
  const formStatus = document.querySelector("#review-form-status");
  const submitButton = document.querySelector("#review-submit");
  const captchaBox = document.querySelector("#review-captcha");
  const list = document.querySelector("#review-list");
  const listCount = document.querySelector("#review-list-count");
  const moreButton = document.querySelector("#review-more");
  const ratingInputs = [...form.querySelectorAll('input[name="rating"]')];
  let slug = currentSlug();
  let characterName = currentName();
  let generation = 0;
  let reviewOffset = 0;
  let knownReviewCount = 0;
  let ownReview = null;
  let ownLoaded = false;
  let formDirty = false;
  let listRequest = 0;
  let turnstileLoading = null;
  let pendingCaptchaReject = null;

  function currentSlug() {
    const match = location.pathname.match(/^\/character\/([a-z]+)\/?$/i);
    return match && characters.some((character) => character.name.toLowerCase() === match[1].toLowerCase())
      ? match[1].toLowerCase() : characters[0].name.toLowerCase();
  }

  function currentName() {
    return characters.find((character) => character.name.toLowerCase() === slug)?.name || characters[0].name;
  }

  function status(message) {
    formStatus.textContent = message;
  }

  function setRating(value) {
    const rating = Number(value) || 0;
    ratingInputs.forEach((input) => {
      input.checked = Number(input.value) === rating;
      input.parentElement.classList.toggle("is-selected", Number(input.value) <= rating);
    });
  }

  function stars(value) {
    const filled = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return "★".repeat(filled) + "☆".repeat(5 - filled);
  }

  function displaySummary(data) {
    const count = Number(data?.rating_count) || 0;
    knownReviewCount = Number(data?.review_count) || 0;
    summaryStars.textContent = stars(data?.average_rating);
    summaryText.textContent = count
      ? `${Number(data.average_rating).toFixed(1)} / 5 · ${count} rating${count === 1 ? "" : "s"} · ${knownReviewCount} review${knownReviewCount === 1 ? "" : "s"}`
      : `Rate ${characterName}`;
    dialogSummary.textContent = count
      ? `${Number(data.average_rating).toFixed(1)} / 5 from ${count} rating${count === 1 ? "" : "s"}`
      : "No ratings yet.";
    listCount.textContent = knownReviewCount ? String(knownReviewCount) : "";
  }

  async function loadSummary(requestGeneration = generation) {
    if (!client) {
      summaryStars.textContent = "☆☆☆☆☆";
      summaryText.textContent = "Reviews unavailable";
      dialogSummary.textContent = "Reviews are not configured yet.";
      return;
    }
    summaryText.textContent = "Loading reviews…";
    try {
      const { data, error } = await client.from("review_summary")
        .select("average_rating,rating_count,review_count")
        .eq("character_slug", slug).maybeSingle();
      if (error) throw error;
      if (requestGeneration === generation) displaySummary(data);
    } catch {
      if (requestGeneration !== generation) return;
      summaryText.textContent = navigator.onLine ? "Reviews unavailable" : "Reviews offline";
      dialogSummary.textContent = navigator.onLine
        ? "Reviews could not be loaded. Try again later."
        : "Reviews need a connection.";
    }
  }

  async function loadOwnReview(requestGeneration = generation) {
    ownReview = null;
    if (!client) return;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (requestGeneration !== generation) return;
      if (!session) {
        ownLoaded = true;
        submitButton.disabled = !submissionsReady;
        return;
      }
      const { data, error } = await client.rpc("own_review", { requested_slug: slug });
      if (error) throw error;
      if (requestGeneration !== generation) return;
      ownReview = data?.[0] || null;
      if (ownReview && !formDirty) {
        setRating(ownReview.rating);
        nicknameInput.value = ownReview.nickname || "";
        reviewInput.value = ownReview.review || "";
        submitButton.textContent = "Save changes";
      }
      ownLoaded = true;
      submitButton.disabled = !submissionsReady;
    } catch {
      if (requestGeneration === generation) {
        status("Your previous rating could not be loaded. Close and reopen to try again.");
        ownLoaded = false;
        submitButton.disabled = true;
      }
    }
  }

  function addReview(entry) {
    const article = document.createElement("article");
    article.className = "review-entry";
    const head = document.createElement("div");
    head.className = "review-entry-head";
    const author = document.createElement("strong");
    author.textContent = entry.nickname;
    const rating = document.createElement("span");
    rating.className = "review-entry-stars";
    rating.textContent = stars(entry.rating);
    rating.setAttribute("aria-label", `${entry.rating} out of 5 stars`);
    head.append(author, rating);
    const date = document.createElement("p");
    date.className = "review-entry-date";
    date.textContent = new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric",
    }).format(new Date(entry.created_at));
    const body = document.createElement("p");
    body.className = "review-entry-text";
    body.textContent = entry.review;
    article.append(head, date, body);
    list.append(article);
  }

  async function loadReviews({ reset = false } = {}) {
    const requestGeneration = generation;
    const request = ++listRequest;
    if (reset) {
      reviewOffset = 0;
      list.replaceChildren();
    }
    if (!client) {
      list.innerHTML = '<p class="review-empty">Reviews are not configured yet.</p>';
      moreButton.hidden = true;
      return;
    }
    const offset = reviewOffset;
    moreButton.disabled = true;
    if (reset) list.innerHTML = '<p class="review-empty">Loading reviews…</p>';
    try {
      const { data, error } = await client.from("review_entries")
        .select("id,rating,nickname,review,created_at")
        .eq("character_slug", slug).not("review", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (requestGeneration !== generation || request !== listRequest || offset !== reviewOffset) return;
      if (reset) list.replaceChildren();
      data.forEach(addReview);
      reviewOffset += data.length;
      if (!reviewOffset) {
        list.innerHTML = '<p class="review-empty">No written reviews yet.</p>';
      }
      moreButton.hidden = data.length < pageSize;
    } catch {
      if (requestGeneration !== generation || request !== listRequest) return;
      if (reset) list.innerHTML = `<p class="review-empty">${navigator.onLine
        ? "Reviews could not be loaded. Close and reopen to try again."
        : "Reviews need a connection."}</p>`;
      else status("More reviews could not be loaded. Try again.");
      moreButton.hidden = reset;
    } finally {
      if (request === listRequest) moreButton.disabled = false;
    }
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileLoading) return turnstileLoading;
    turnstileLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Verification unavailable"));
      script.onerror = () => reject(new Error("Verification unavailable"));
      document.head.append(script);
    }).catch((error) => {
      turnstileLoading = null;
      throw error;
    });
    return turnstileLoading;
  }

  async function captchaToken() {
    if (!config.turnstileSiteKey) throw new Error("Verification is not configured.");
    const turnstile = await loadTurnstile();
    captchaBox.hidden = false;
    status("Complete verification to post.");
    return new Promise((resolve, reject) => {
      pendingCaptchaReject = reject;
      captchaBox.replaceChildren();
      turnstile.render(captchaBox, {
        sitekey: config.turnstileSiteKey,
        callback: (token) => { pendingCaptchaReject = null; resolve(token); },
        "error-callback": () => { pendingCaptchaReject = null; reject(new Error("Verification failed. Try again.")); },
      });
    });
  }

  async function ensureSession() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session) return session;
    const token = await captchaToken();
    const { data, error: signInError } = await client.auth.signInAnonymously({
      options: { captchaToken: token },
    });
    captchaBox.hidden = true;
    if (signInError) throw signInError;
    return data.session;
  }

  async function submit(event) {
    event.preventDefault();
    if (!client) return;
    if (!submissionsReady) { status("Rating is not available yet."); return; }
    if (!ownLoaded) { status("Your rating is still loading."); return; }
    const rating = Number(form.elements.rating.value);
    const review = reviewInput.value.trim();
    const nickname = nicknameInput.value.trim();
    if (!rating) { status("Choose a star rating."); return; }
    if (review && (nickname.length < 2 || nickname.length > 30)) {
      status("Enter a name of 2–30 characters for a written review.");
      nicknameInput.focus();
      return;
    }
    if (review.length > 500) { status("Keep the review under 500 characters."); return; }
    const requestedSlug = slug;
    submitButton.disabled = true;
    status("Saving…");
    try {
      const session = await ensureSession();
      if (!session || requestedSlug !== slug || !dialog.open) return;
      const values = { rating, nickname: review ? nickname : null, review: review || null };
      const result = ownReview
        ? await client.from("review_entries").update(values).eq("id", ownReview.id)
        : await client.from("review_entries").insert({ ...values, character_slug: requestedSlug });
      if (result.error) throw result.error;
      status(review ? "Review saved." : "Rating saved.");
      formDirty = false;
      await Promise.all([loadSummary(), loadOwnReview(), loadReviews({ reset: true })]);
    } catch (error) {
      if (dialog.open && requestedSlug === slug) {
        status(navigator.onLine
          ? (error.message || "Rating could not be saved. Try again.")
          : "Connect to the internet to save your rating.");
      }
    } finally {
      captchaBox.hidden = true;
      submitButton.disabled = !submissionsReady;
    }
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function changeCharacter(nextSlug, nextName) {
    generation += 1;
    closeDialog();
    ownLoaded = false;
    slug = nextSlug;
    characterName = nextName;
    title.textContent = characterName;
    summaryButton.setAttribute("aria-label", `Read and write reviews for ${characterName}`);
    displaySummary(null);
    loadSummary();
  }

  summaryButton.addEventListener("click", () => {
    dialog.showModal();
    form.reset();
    formDirty = false;
    ownLoaded = false;
    setRating(0);
    submitButton.textContent = "Post rating";
    submitButton.disabled = true;
    status("");
    title.textContent = characterName;
    if (!client) {
      submitButton.disabled = true;
      status("Reviews are not configured yet.");
    } else if (!submissionsReady) {
      status("Ratings can be read now. Posting is being set up.");
    }
    loadOwnReview();
    loadReviews({ reset: true });
  });
  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("close", () => {
    if (pendingCaptchaReject) {
      pendingCaptchaReject(new Error("Verification cancelled."));
      pendingCaptchaReject = null;
    }
    captchaBox.hidden = true;
    summaryButton.focus();
  });
  ratingInputs.forEach((input) => input.addEventListener("change", () => {
    formDirty = true;
    setRating(input.value);
  }));
  nicknameInput.addEventListener("input", () => { formDirty = true; });
  reviewInput.addEventListener("input", () => {
    formDirty = true;
    submitButton.textContent = reviewInput.value.trim()
      ? (ownReview ? "Save changes" : "Post review")
      : (ownReview ? "Save changes" : "Post rating");
  });
  form.addEventListener("submit", submit);
  moreButton.addEventListener("click", () => loadReviews());
  window.addEventListener("webendra:characterchange", (event) => {
    changeCharacter(event.detail.slug, event.detail.name);
  });
  window.addEventListener("online", () => loadSummary());
  title.textContent = characterName;
  summaryButton.setAttribute("aria-label", `Read and write reviews for ${characterName}`);
  loadSummary();
})();
