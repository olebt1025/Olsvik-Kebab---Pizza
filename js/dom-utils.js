export function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

export function safeImageUrl(value) {
    if (typeof value !== "string") return "";

    if (/^data:image\/jpeg;base64,[a-z0-9+/]+=*$/i.test(value)) {
        return value;
    }

    try {
        const url = new URL(value, window.location.href);
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}