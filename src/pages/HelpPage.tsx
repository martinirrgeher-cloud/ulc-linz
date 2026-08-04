import {
  ArrowLeft,
  BookOpenText,
  ChevronRight,
  CircleAlert,
  Lightbulb,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  HELP_CHAPTERS,
  HELP_TOPICS,
  getHelpTopic,
  topicSearchText,
  type HelpSection,
} from "@/features/help/help";
import { buildHelpTopicHref, safeHelpReturnPath } from "@/features/help/help-context";
import "@/styles/help.css";

function HelpSectionContent({ section }: { section: HelpSection }) {
  return (
    <section className="help-section" id={section.id} tabIndex={-1}>
      <h2>{section.title}</h2>
      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.steps && (
        <ol className="help-list help-steps">
          {section.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}
      {section.bullets && (
        <ul className="help-list">
          {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      )}
      {section.tip && (
        <div className="help-callout help-tip">
          <Lightbulb aria-hidden="true" />
          <div><strong>Tipp</strong><p>{section.tip}</p></div>
        </div>
      )}
      {section.warning && (
        <div className="help-callout help-warning">
          <CircleAlert aria-hidden="true" />
          <div><strong>Wichtig</strong><p>{section.warning}</p></div>
        </div>
      )}
    </section>
  );
}

export function HelpPage() {
  const { topicId } = useParams<{ topicId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const activeTopic = getHelpTopic(topicId);
  const returnPath = safeHelpReturnPath(new URLSearchParams(location.search).get("from"));
  const normalizedSearch = search.trim().toLocaleLowerCase("de");

  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return HELP_TOPICS.filter((topic) => topicSearchText(topic).includes(normalizedSearch));
  }, [normalizedSearch]);

  useEffect(() => {
    if (!activeTopic || !location.hash) return;
    const sectionId = decodeURIComponent(location.hash.slice(1));
    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      target?.scrollIntoView({ block: "start" });
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTopic, location.hash]);

  const topicHref = (nextTopicId: string, sectionId?: string) =>
    buildHelpTopicHref(nextTopicId, sectionId, returnPath);

  return (
    <section className="help-page">
      <div className="page-heading help-heading">
        <div>
          <p className="eyebrow">Hilfe</p>
          <h1>{activeTopic?.title ?? "Handbuch"}</h1>
          <p>{activeTopic?.summary ?? "Kapitel und Anleitungen für alle Bereiche der ULC-Linz-App."}</p>
        </div>
        <div className="help-heading-actions">
          {activeTopic && (
            <Link className="secondary-button" to={returnPath ? `/hilfe?from=${encodeURIComponent(returnPath)}` : "/hilfe"}>
              <BookOpenText aria-hidden="true" />
              Ganzes Handbuch
            </Link>
          )}
          {returnPath && (
            <button type="button" className="secondary-button" onClick={() => navigate(returnPath)}>
              <ArrowLeft aria-hidden="true" />
              Zurück zur Seite
            </button>
          )}
        </div>
      </div>

      <label className="help-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Handbuch durchsuchen</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hilfe durchsuchen"
          autoComplete="off"
        />
      </label>

      {normalizedSearch ? (
        <div className="help-search-results" aria-live="polite">
          <p className="help-search-count">
            {searchResults.length} {searchResults.length === 1 ? "Treffer" : "Treffer"}
          </p>
          {searchResults.length > 0 ? (
            <div className="help-topic-grid">
              {searchResults.map((topic) => (
                <Link className="help-topic-card" to={topicHref(topic.id)} key={topic.id}>
                  <span><strong>{topic.title}</strong><small>{topic.summary}</small></span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <Search aria-hidden="true" />
              <h2>Kein Hilfethema gefunden</h2>
              <p>Probiere einen kürzeren oder allgemeineren Suchbegriff.</p>
            </div>
          )}
        </div>
      ) : activeTopic ? (
        <div className="help-layout">
          <nav className="help-topic-navigation" aria-label="Kapitel dieses Hilfethemas">
            <strong>In diesem Kapitel</strong>
            {activeTopic.sections.map((section) => (
              <Link to={topicHref(activeTopic.id, section.id)} key={section.id}>{section.title}</Link>
            ))}
          </nav>

          <article className="help-article">
            {activeTopic.availability && (
              <div className="help-availability">
                <ShieldCheck aria-hidden="true" />
                <span>{activeTopic.availability}</span>
              </div>
            )}
            {activeTopic.sections.map((section) => (
              <HelpSectionContent section={section} key={section.id} />
            ))}
          </article>
        </div>
      ) : (
        <div className="help-chapters">
          <div className="help-intro-card">
            <BookOpenText aria-hidden="true" />
            <div>
              <h2>ULC-Linz-App Handbuch</h2>
              <p>Öffne ein Kapitel oder suche oben direkt nach einer Funktion.</p>
            </div>
          </div>

          {HELP_CHAPTERS.map((chapter, chapterIndex) => (
            <details className="help-chapter" open={chapterIndex === 0} key={chapter.id}>
              <summary>
                <span><strong>{chapter.title}</strong><small>{chapter.description}</small></span>
                <ChevronRight aria-hidden="true" />
              </summary>
              <div className="help-topic-grid">
                {chapter.topicIds.map((chapterTopicId) => {
                  const topic = getHelpTopic(chapterTopicId);
                  if (!topic) return null;
                  return (
                    <Link className="help-topic-card" to={topicHref(topic.id)} key={topic.id}>
                      <span><strong>{topic.title}</strong><small>{topic.summary}</small></span>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
