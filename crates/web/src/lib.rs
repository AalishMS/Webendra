//! Client-side hydration for Webendra, compiled to WebAssembly.
//!
//! The server already renders the correct character for the initial
//! request, so this module doesn't re-render on load. It attaches the
//! interactive behavior on top of that server-rendered markup: arrow/keyboard
//! navigation with crossfade transitions, `pushState`/`popstate` routing,
//! neighbor image preloading, and per-page SEO tag updates for client-side
//! navigations — all a straight port of the original `app.js`.

use std::cell::Cell;
use std::rc::Rc;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{
    Document, Element, HtmlElement, HtmlImageElement, KeyboardEvent, MediaQueryList,
    PopStateEvent, Window,
};

use webendra_shared::{character_path, index_from_slug, wrap_index, CHARACTERS, SITE_URL};

fn window() -> Window {
    web_sys::window().expect("no window")
}

fn document() -> Document {
    window().document().expect("no document")
}

fn query(selector: &str) -> Option<Element> {
    document().query_selector(selector).ok().flatten()
}

fn set_meta(selector: &str, value: &str) {
    if let Some(el) = query(selector) {
        let _ = el.set_attribute("content", value);
    }
}

fn get_index_from_path() -> usize {
    let path = window().location().pathname().unwrap_or_default();
    let prefix = "/character/";
    if let Some(rest) = path.strip_prefix(prefix) {
        // Mirror the original's `^\/character\/([^/]+)\/?$`: at most one
        // trailing slash, and no embedded slash in the slug itself.
        let slug_part = rest.strip_suffix('/').unwrap_or(rest);
        if !slug_part.is_empty() && !slug_part.contains('/') {
            if let Some(index) = index_from_slug(slug_part) {
                return index;
            }
        }
    }
    0
}

fn update_seo(index: usize) {
    let character = &CHARACTERS[index];
    let path = character_path(index);
    let url = format!("{SITE_URL}{path}");
    let image_url = format!("{SITE_URL}{}", character.image);
    let is_home = index == 0;

    let title = if is_home {
        "Webendra".to_string()
    } else {
        format!("{} — Webendra", character.name)
    };
    let description = if is_home {
        "A small collection of things with -endra at the end.".to_string()
    } else {
        format!(
            "{} — A small collection of things with -endra at the end.",
            character.name
        )
    };

    document().set_title(&title);

    if let Some(link) = query(r#"link[rel="canonical"]"#) {
        let _ = link.set_attribute("href", &url);
    }

    set_meta(r#"meta[name="description"]"#, &description);
    set_meta(r#"meta[property="og:title"]"#, &title);
    set_meta(r#"meta[property="og:description"]"#, &description);
    set_meta(r#"meta[property="og:url"]"#, &url);
    set_meta(r#"meta[property="og:image"]"#, &image_url);
    set_meta(r#"meta[property="og:image:alt"]"#, character.alt);
    set_meta(r#"meta[name="twitter:title"]"#, &title);
    set_meta(r#"meta[name="twitter:description"]"#, &description);
    set_meta(r#"meta[name="twitter:image"]"#, &image_url);
    set_meta(r#"meta[name="twitter:image:alt"]"#, character.alt);

    if let Some(structured) = query("#structured-data") {
        let json = if is_home {
            collection_structured_data_json()
        } else {
            character_structured_data_json(index, &description, &url, &image_url)
        };
        structured.set_text_content(Some(&json));
    }
}

/// Escape a string for embedding inside a JSON string literal.
fn escape_json(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            other => out.push(other),
        }
    }
    out
}

fn collection_structured_data_json() -> String {
    let items: Vec<String> = CHARACTERS
        .iter()
        .enumerate()
        .map(|(i, c)| {
            format!(
                r#"{{"@type":"ListItem","position":{},"name":"{}","url":"{}{}"}}"#,
                i + 1,
                escape_json(c.name),
                SITE_URL,
                character_path(i)
            )
        })
        .collect();

    format!(
        r#"{{"@context":"https://schema.org","@type":"CollectionPage","name":"Webendra","url":"{SITE_URL}/","description":"A small collection of things with -endra at the end.","mainEntity":{{"@type":"ItemList","numberOfItems":{},"itemListElement":[{}]}}}}"#,
        CHARACTERS.len(),
        items.join(",")
    )
}

fn character_structured_data_json(index: usize, description: &str, url: &str, image_url: &str) -> String {
    let character = &CHARACTERS[index];
    format!(
        r#"{{"@context":"https://schema.org","@type":"ImageObject","name":"{}","description":"{}","url":"{}","contentUrl":"{}","caption":"{}","isPartOf":{{"@type":"CollectionPage","name":"Webendra","url":"{SITE_URL}/"}}}}"#,
        escape_json(character.name),
        escape_json(description),
        escape_json(url),
        escape_json(image_url),
        escape_json(character.alt),
    )
}

fn preload_character(index: isize) {
    let index = wrap_index(index);
    let character = &CHARACTERS[index];
    if let Ok(img) = HtmlImageElement::new() {
        img.set_src(character.image);
    }
}

/// Build a two-keyframe opacity/transform animation object for
/// `Element::animate`, matching the original's inline JS keyframe objects.
fn keyframes(from_opacity: f64, from_transform: &str, to_opacity: f64, to_transform: &str) -> js_sys::Array {
    let make = |opacity: f64, transform: &str| -> js_sys::Object {
        let obj = js_sys::Object::new();
        let _ = js_sys::Reflect::set(&obj, &"opacity".into(), &JsValue::from_f64(opacity));
        let _ = js_sys::Reflect::set(&obj, &"transform".into(), &JsValue::from_str(transform));
        obj
    };
    let arr = js_sys::Array::new();
    arr.push(&make(from_opacity, from_transform));
    arr.push(&make(to_opacity, to_transform));
    arr
}

fn animate(el: &Element, frames: &js_sys::Array, duration: f64, easing: &str) -> web_sys::Animation {
    let opts = web_sys::KeyframeAnimationOptions::new();
    opts.set_duration(duration);
    opts.set_easing(easing);
    opts.set_fill(web_sys::FillMode::Forwards);
    el.animate_with_keyframe_animation_options(Some(frames.unchecked_ref()), &opts)
}

fn style_of(el: &Element) -> web_sys::CssStyleDeclaration {
    el.unchecked_ref::<HtmlElement>().style()
}

/// Cancel any in-flight animations on all layers matching `selector` inside
/// `container` except the last (topmost) one, remove the stale ones, and
/// return the surviving layer with its computed opacity/transform frozen as
/// inline styles so the next transition can read a stable starting point.
fn clear_previous_transition(container: &Element, selector: &str, incoming_class: &str) -> Element {
    let list = container.query_selector_all(selector).unwrap();
    let len = list.length();
    let mut layers = Vec::with_capacity(len as usize);
    for i in 0..len {
        if let Some(node) = list.get(i) {
            if let Ok(el) = node.dyn_into::<Element>() {
                layers.push(el);
            }
        }
    }

    let visible = layers.last().cloned().expect("at least one layer");
    let computed = window()
        .get_computed_style(&visible)
        .ok()
        .flatten()
        .expect("computed style");
    let opacity = computed.get_property_value("opacity").unwrap_or_else(|_| "1".into());
    let transform = computed
        .get_property_value("transform")
        .unwrap_or_else(|_| "none".into());

    for layer in &layers {
        for anim in layer.get_animations().iter() {
            if let Ok(anim) = anim.dyn_into::<web_sys::Animation>() {
                anim.cancel();
            }
        }
        if layer != &visible {
            layer.remove();
        }
    }

    let _ = visible.class_list().remove_1(incoming_class);
    let _ = visible.remove_attribute("aria-hidden");
    let _ = style_of(&visible).set_property("opacity", &opacity);
    let _ = style_of(&visible).set_property("transform", &transform);

    visible
}

struct AppState {
    current_index: Cell<usize>,
    transition_id: Cell<u64>,
    reduce_motion: MediaQueryList,
    image_frame: Element,
    name_container: Element,
}

async fn show_character(state: Rc<AppState>, index: isize, update_history: bool) {
    let next_index = wrap_index(index);
    let current = state.current_index.get();
    if next_index == current {
        return;
    }

    let character = &CHARACTERS[next_index];
    let len = CHARACTERS.len();
    let direction: f64 = if next_index == (current + len - 1) % len { -1.0 } else { 1.0 };

    let this_transition = state.transition_id.get() + 1;
    state.transition_id.set(this_transition);
    state.current_index.set(next_index);

    let path = character_path(next_index);
    if update_history {
        let loc_path = window().location().pathname().unwrap_or_default();
        if loc_path != path {
            let _ = window()
                .history()
                .unwrap()
                .push_state_with_url(&JsValue::NULL, "", Some(&path));
        }
    }
    update_seo(next_index);

    let previous_image = clear_previous_transition(&state.image_frame, "img", "character-image--incoming");

    let next_image = HtmlImageElement::new_with_width_and_height(1254, 1254).unwrap();
    next_image.set_src(character.image);
    next_image.set_alt(character.alt);
    next_image.set_class_name("character-image character-image--incoming");

    let decode_result = wasm_bindgen_futures::JsFuture::from(next_image.decode()).await;
    let _ = decode_result; // load event still paints the image if decode is unavailable

    if state.transition_id.get() != this_transition {
        return;
    }

    let _ = previous_image.remove_attribute("id");
    let _ = previous_image.set_attribute("aria-hidden", "true");
    next_image.set_id("character-image");
    let _ = state.image_frame.append_child(&next_image);

    let previous_name = clear_previous_transition(&state.name_container, ".character-name", "character-name--incoming");
    let next_name = previous_name.clone_node_with_deep(false).unwrap().dyn_into::<Element>().unwrap();
    next_name.set_class_name("character-name character-name--incoming");
    next_name.set_text_content(Some(character.name));
    let _ = previous_name.set_attribute("aria-hidden", "true");
    let _ = state.name_container.append_child(&next_name);

    if state.reduce_motion.matches() {
        previous_image.remove();
        let _ = next_image.class_list().remove_1("character-image--incoming");
        let _ = next_image.remove_attribute("style");
        previous_name.remove();
        let _ = next_name.class_list().remove_1("character-name--incoming");
        let _ = next_name.remove_attribute("style");
        preload_character(next_index as isize - 1);
        preload_character(next_index as isize + 1);
        return;
    }

    let duration = 600.0;
    let easing = "cubic-bezier(0.16, 1, 0.3, 1)";

    let prev_opacity = style_of(&previous_image).get_property_value("opacity").unwrap_or_default();
    let prev_opacity = if prev_opacity.is_empty() { "1".to_string() } else { prev_opacity };
    let prev_transform = style_of(&previous_image).get_property_value("transform").unwrap_or_default();
    let prev_transform = if prev_transform.is_empty() { "none".to_string() } else { prev_transform };

    let outgoing_frames = keyframes(
        prev_opacity.parse().unwrap_or(1.0),
        &prev_transform,
        0.0,
        &format!("translateX({}px) scale(0.992)", direction * -5.0),
    );
    let incoming_frames = keyframes(
        0.0,
        &format!("translateX({}px) scale(1.012)", direction * 8.0),
        1.0,
        "translateX(0) scale(1)",
    );

    let outgoing_anim = animate(&previous_image, &outgoing_frames, duration, easing);
    let incoming_anim = animate(&next_image, &incoming_frames, duration, easing);

    let prev_name_opacity = style_of(&previous_name).get_property_value("opacity").unwrap_or_default();
    let prev_name_opacity = if prev_name_opacity.is_empty() { "1".to_string() } else { prev_name_opacity };
    let prev_name_transform = style_of(&previous_name).get_property_value("transform").unwrap_or_default();
    let prev_name_transform = if prev_name_transform.is_empty() { "none".to_string() } else { prev_name_transform };

    let outgoing_name_frames = keyframes(
        prev_name_opacity.parse().unwrap_or(1.0),
        &prev_name_transform,
        0.0,
        &format!("translateX({}px) scale(0.992)", direction * -5.0),
    );
    let incoming_name_frames = keyframes(
        0.0,
        &format!("translateX({}px) scale(1.012)", direction * 8.0),
        1.0,
        "translateX(0) scale(1)",
    );

    let outgoing_name_anim = animate(&previous_name, &outgoing_name_frames, duration, easing);
    let _incoming_name_anim = animate(&next_name, &incoming_name_frames, duration, easing);

    let finished = wasm_bindgen_futures::JsFuture::from(incoming_anim.finished().unwrap()).await;
    let _ = finished;

    if state.transition_id.get() == this_transition {
        outgoing_anim.cancel();
        outgoing_name_anim.cancel();
        previous_image.remove();
        previous_name.remove();
        for anim in next_image.get_animations().iter() {
            if let Ok(anim) = anim.dyn_into::<web_sys::Animation>() {
                anim.cancel();
            }
        }
        for anim in next_name.get_animations().iter() {
            if let Ok(anim) = anim.dyn_into::<web_sys::Animation>() {
                anim.cancel();
            }
        }
        let _ = next_image.class_list().remove_1("character-image--incoming");
        let _ = next_name.class_list().remove_1("character-name--incoming");
        let _ = next_image.remove_attribute("style");
        let _ = next_name.remove_attribute("style");
        preload_character(next_index as isize - 1);
        preload_character(next_index as isize + 1);
    }
}

fn spawn_show_character(state: &Rc<AppState>, index: isize, update_history: bool) {
    let state = state.clone();
    wasm_bindgen_futures::spawn_local(async move {
        show_character(state, index, update_history).await;
    });
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook_set();

    let win = window();
    let doc = document();

    let image_frame = query(".image-frame").expect("missing .image-frame");
    let name_container = query("#character-name").expect("missing #character-name");
    let previous_button = query(".arrow--previous").expect("missing .arrow--previous");
    let next_button = query(".arrow--next").expect("missing .arrow--next");
    let reduce_motion = win
        .match_media("(prefers-reduced-motion: reduce)")
        .ok()
        .flatten()
        .expect("matchMedia unsupported");

    let current_index = get_index_from_path();
    let expected_path = character_path(current_index);
    let actual_path = win.location().pathname().unwrap_or_default();
    if actual_path != expected_path {
        let _ = win
            .history()
            .unwrap()
            .replace_state_with_url(&JsValue::NULL, "", Some(&expected_path));
    }

    let state = Rc::new(AppState {
        current_index: Cell::new(current_index),
        transition_id: Cell::new(0),
        reduce_motion,
        image_frame,
        name_container,
    });

    // Preload neighboring characters once the page settles, mirroring the
    // original's `load` + `requestIdleCallback` (falling back to a timeout).
    {
        let state = state.clone();
        let idle_closure = Closure::once(Box::new(move || {
            preload_character(state.current_index.get() as isize - 1);
            preload_character(state.current_index.get() as isize + 1);
        }) as Box<dyn FnOnce()>);

        let load_closure = Closure::once(Box::new(move |_: web_sys::Event| {
            let win = window();
            if js_sys::Reflect::has(&win, &"requestIdleCallback".into()).unwrap_or(false) {
                let _ = win.request_idle_callback(idle_closure.as_ref().unchecked_ref());
                idle_closure.forget();
            } else {
                let _ = win.set_timeout_with_callback_and_timeout_and_arguments_0(
                    idle_closure.as_ref().unchecked_ref(),
                    200,
                );
                idle_closure.forget();
            }
        }) as Box<dyn FnOnce(web_sys::Event)>);

        let listener_opts = web_sys::AddEventListenerOptions::new();
        listener_opts.set_once(true);
        let _ = win.add_event_listener_with_callback_and_add_event_listener_options(
            "load",
            load_closure.as_ref().unchecked_ref(),
            &listener_opts,
        );
        load_closure.forget();
    }

    {
        let state = state.clone();
        let closure = Closure::wrap(Box::new(move |_: web_sys::Event| {
            let idx = state.current_index.get() as isize - 1;
            spawn_show_character(&state, idx, true);
        }) as Box<dyn FnMut(web_sys::Event)>);
        let _ = previous_button.add_event_listener_with_callback("click", closure.as_ref().unchecked_ref());
        closure.forget();
    }

    {
        let state = state.clone();
        let closure = Closure::wrap(Box::new(move |_: web_sys::Event| {
            let idx = state.current_index.get() as isize + 1;
            spawn_show_character(&state, idx, true);
        }) as Box<dyn FnMut(web_sys::Event)>);
        let _ = next_button.add_event_listener_with_callback("click", closure.as_ref().unchecked_ref());
        closure.forget();
    }

    {
        let state = state.clone();
        let closure = Closure::wrap(Box::new(move |_: PopStateEvent| {
            let index = get_index_from_path();
            if index != state.current_index.get() {
                spawn_show_character(&state, index as isize, false);
            }
        }) as Box<dyn FnMut(PopStateEvent)>);
        let _ = win.add_event_listener_with_callback("popstate", closure.as_ref().unchecked_ref());
        closure.forget();
    }

    {
        let state = state.clone();
        let closure = Closure::wrap(Box::new(move |event: KeyboardEvent| {
            if event.repeat() || event.alt_key() || event.ctrl_key() || event.meta_key() {
                return;
            }
            if let Some(target) = event.target() {
                if let Ok(el) = target.dyn_into::<Element>() {
                    if el.matches("input, textarea, select, [contenteditable=true]").unwrap_or(false) {
                        return;
                    }
                }
            }

            let key = event.key();
            if key == "ArrowLeft" || key == "ArrowRight" {
                event.prevent_default();
            }
            if key == "ArrowLeft" {
                let idx = state.current_index.get() as isize - 1;
                spawn_show_character(&state, idx, true);
            } else if key == "ArrowRight" {
                let idx = state.current_index.get() as isize + 1;
                spawn_show_character(&state, idx, true);
            }
        }) as Box<dyn FnMut(KeyboardEvent)>);
        let _ = doc.add_event_listener_with_callback("keydown", closure.as_ref().unchecked_ref());
        closure.forget();
    }
}

fn console_error_panic_hook_set() {
    std::panic::set_hook(Box::new(|info| {
        web_sys::console::error_1(&format!("{info}").into());
    }));
}
