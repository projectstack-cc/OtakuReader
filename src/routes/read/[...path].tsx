import { Component, createEffect } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { legacyConsumetQuery } from "~/lib/utils/helpers";

// Catch-all for legacy multi-segment Consumet reader links (the unencoded
// "/" in old ids produced /read/<mangaId>/<chapterId>-style URLs with too
// many segments for [mangaId]/[chapterId]). Send them to a title search
// instead of a 404. Well-formed two-segment links still match the real
// reader route, which takes priority over a wildcard in the router.
const LegacyReadLink: Component = () => {
  const params = useParams<{ path: string }>();
  const navigate = useNavigate();

  createEffect(() => {
    // The trailing segment is the chapterId; the manga slug comes before it.
    const withoutChapter =
      params.path.lastIndexOf("/") > 0
        ? params.path.slice(0, params.path.lastIndexOf("/"))
        : params.path;
    const query = legacyConsumetQuery(withoutChapter);
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  });

  return null;
};

export default LegacyReadLink;
