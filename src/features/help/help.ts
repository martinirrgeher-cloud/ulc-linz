import helpContent from "@/features/help/help-content.json";

export type HelpSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
  tip?: string;
  warning?: string;
};

export type HelpTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  sections: HelpSection[];
  availability?: string;
};

export type HelpChapter = {
  id: string;
  title: string;
  description: string;
  topicIds: string[];
};

type HelpContent = {
  chapters: HelpChapter[];
  topics: HelpTopic[];
};

const data = helpContent as HelpContent;
const topicById = new Map(data.topics.map((topic) => [topic.id, topic]));

export const HELP_CHAPTERS = data.chapters;
export const HELP_TOPICS = data.topics;

export function getHelpTopic(topicId: string | undefined): HelpTopic | undefined {
  return topicId ? topicById.get(topicId) : undefined;
}

export function topicSearchText(topic: HelpTopic): string {
  return [
    topic.title,
    topic.summary,
    ...topic.keywords,
    topic.availability ?? "",
    ...topic.sections.flatMap((section) => [
      section.title,
      ...(section.paragraphs ?? []),
      ...(section.steps ?? []),
      ...(section.bullets ?? []),
      section.tip ?? "",
      section.warning ?? "",
    ]),
  ].join(" ").toLocaleLowerCase("de");
}
