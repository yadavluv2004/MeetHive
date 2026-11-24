import { useEffect } from "react";

export const SITE_URL = "https://meethivefrontend.onrender.com";
export const DEFAULT_TITLE = "MeetHive – Free Online Video Meetings & Video Calls in Your Browser";
export const DEFAULT_DESCRIPTION =
    "MeetHive is a free video conferencing app. Start secure HD video meetings, share your screen and chat right in your browser – no downloads, guests join with just a code.";

function setMeta(attr, key, content) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute("content", content);
}

function setCanonical(href) {
    let el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", "canonical");
        document.head.appendChild(el);
    }
    el.setAttribute("href", href);
}

/**
 * Per-route title, description, canonical URL and robots directive.
 * Private/app pages (meetings, dashboard, 404) pass noindex so only public pages show in search.
 */
export default function useSeo({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION, path = "/", noindex = false } = {}) {
    useEffect(() => {
        const url = SITE_URL + path;
        document.title = title;
        setMeta("name", "description", description);
        setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
        setMeta("property", "og:title", title);
        setMeta("property", "og:description", description);
        setMeta("property", "og:url", url);
        setMeta("name", "twitter:title", title);
        setMeta("name", "twitter:description", description);
        setCanonical(url);
    }, [title, description, path, noindex]);
}
