import type { Credentials } from "@/lib/config/pending";
import { missingNames } from "@/lib/config/pending";
import type { Overrides } from "@/lib/control/overrides";
import type { EditorialDecision, Importance, IncomingEvent, TruthStatus } from "@/lib/domain/types";
import { CADENCE } from "@/lib/engines/cadence";
import { composeDraft, expressionFile, pickExpression, type Draft } from "@/lib/engines/copy";
import { buildFlash, type FlashCard } from "@/lib/engines/flash";
import { classifyImportance, importanceRank } from "@/lib/engines/importance";
import { resolveStory, storyKeyFor } from "@/lib/engines/story";
import { claimStatusFromTruth, classifyTruth } from "@/lib/engines/truth";

const SENSITIVE = ["muerte", "suicidio", "autolesion", "autolesión", "enfermedad grave", "accidente grave", "tragedia"];

export type PipelineResult = {
  idempotencyKey: string;
  truth: TruthStatus;
  claimStatus: string;
  story: { key: string; action: "create" | "update" | "attach_source" };
  importance: Importance;
  cooldown: "allow" | "group" | "suppress";
  decision: EditorialDecision;
  reason: string;
  flash: FlashCard | null;
  draft: Draft | null;
  context: { run: boolean; waitsForBrightData: boolean; instruction: string };
  visual: { mode: string; reference: string | null; expression: string };
  jobs: Array<{ type: "FLASH" | "CONTEXT"; priority: number; status: string; idempotencyKey: string }>;
  publication: { status: "not_requested" | "pending_credentials" | "paused" | "queued" | "blocked_incomplete"; missing: string[] };
  tone: "normal" | "informar_sin_humor";
  americaTag: boolean;
  checks: { cierto: boolean; aporta: boolean; voz: "pendiente" | "lista" };
};

function idempotencyKey(event: IncomingEvent): string {
  if (event.apiEventId) return `api:${event.apiEventId}`;
  return ["fx", event.fixtureId, event.eventType, event.minute ?? "x", event.player ?? "x", event.team ?? "x"].join(":");
}

function sensitive(event: IncomingEvent): boolean {
  const blob = `${event.text ?? ""} ${(event.topics ?? []).join(" ")}`.toLowerCase();
  return SENSITIVE.some((topic) => blob.includes(topic));
}

function blocked(event: IncomingEvent, overrides: Overrides): string | null {
  const sourceNames = event.sources.map((source) => source.name.toLowerCase());
  const hitSource = overrides.blockedSources.find((source) => sourceNames.includes(source.toLowerCase()));
  if (hitSource) return `Fuente bloqueada: ${hitSource}`;
  const topics = (event.topics ?? []).map((topic) => topic.toLowerCase());
  const blob = `${event.text ?? ""} ${event.player ?? ""} ${event.team ?? ""} ${topics.join(" ")}`.toLowerCase();
  const hitTopic = overrides.blockedTopics.find((topic) => topic && blob.includes(topic.toLowerCase()));
  if (hitTopic) return `Tema bloqueado: ${hitTopic}`;
  const hitWord = overrides.blockedWords.find((word) => word && blob.includes(word.toLowerCase()));
  if (hitWord) return `Palabra bloqueada: ${hitWord}`;
  const hitPerson = overrides.blockedPeople.find((person) => person && blob.includes(person.toLowerCase()));
  if (hitPerson) return `Persona bloqueada: ${hitPerson}`;
  return null;
}

export function runPipeline(event: IncomingEvent, input: { credentials: Credentials; overrides: Overrides; now: Date }): PipelineResult {
  const key = idempotencyKey(event);
  const truth = classifyTruth({ origin: event.origin, sources: event.sources });
  const claimStatus = claimStatusFromTruth(truth, event.sources.length);
  const causeTruth = event.cause ? classifyTruth({ origin: "claim", sources: event.cause.sources }) : null;
  const causeStatus = causeTruth ? claimStatusFromTruth(causeTruth, event.cause?.sources.length ?? 0) : null;
  const storyKey = storyKeyFor(event, event.existingStories);
  const story = resolveStory(event, storyKey);
  const importance = classifyImportance(event);
  const tone = input.overrides.safeMode || sensitive(event) ? "informar_sin_humor" : "normal";
  const americaTag = [event.homeTeam, event.awayTeam, event.team ?? ""].some((name) => name.toLowerCase().includes("américa") || name.toLowerCase().includes("america"));
  const flash = ["GOAL", "RED_CARD", "PENALTY", "MISSED_PENALTY", "VAR", "HALFTIME", "FULL_TIME", "SUSPENDED"].includes(event.eventType)
    ? buildFlash(event, causeStatus)
    : null;

  const block = blocked(event, input.overrides);
  const burstPosts = event.recentPosts.filter((post) => {
    return post.fixtureId === event.fixtureId && input.now.getTime() - new Date(post.createdAt).getTime() <= CADENCE.editorialBurstMs;
  });
  const lastRank = burstPosts.reduce((max, post) => Math.max(max, importanceRank(post.importance)), 0);
  let cooldown: PipelineResult["cooldown"] = "allow";
  if (story.action === "attach_source") cooldown = "suppress";
  else if (burstPosts.length > 0 && !story.scoreChanged && importanceRank(importance) <= lastRank && story.action !== "create") cooldown = "group";

  let decision: EditorialDecision = "DISCARD";
  let reason = "Sin valor editorial.";
  const cierto = truth === "DATO_CONFIRMADO" || truth === "DATO_PROBABLE" || event.origin === "api_event";

  if (block) {
    decision = "DISCARD";
    reason = block;
  } else if (importance === "BAJO" || importance === "IGNORAR") {
    decision = "DISCARD";
    reason = "Evento sin impacto narrativo.";
  } else if (truth === "CONTRADICCION" && event.eventType !== "SUSPENDED") {
    decision = "MONITOR";
    reason = "Hay contradicción. No se presenta como hecho.";
  } else if (truth === "AFIRMACION_DE_UNA_FUENTE" || truth === "INFORMACION_NO_CONFIRMADA") {
    decision = "MONITOR";
    reason = "Una publicación social no se convierte sola en un hecho.";
  } else if (cooldown === "suppress") {
    decision = "DISCARD";
    reason = "Información repetida. No existe contexto nuevo.";
  } else if (cooldown === "group") {
    decision = "UPDATE_EXISTING_STORY";
    reason = "Los eventos del mismo partido se agrupan. Esto no amerita otra publicación.";
  } else if (flash && !flash.valid) {
    decision = "WAIT";
    reason = `Faltan datos obligatorios: ${flash.missing.join(", ")}. El marcador no lo inventa el modelo.`;
  } else if (importance === "MEDIO") {
    decision = truth === "DATO_CONFIRMADO" ? "PUBLISH_CONTEXT" : "WAIT";
    reason = decision === "PUBLISH_CONTEXT" ? "Dato confirmado de valor medio. Sale como contexto, no como flash." : "Puede esperar. Todavía no aporta lo suficiente.";
  } else if (cierto) {
    decision = "PUBLISH_NOW";
    reason = event.eventType === "SUSPENDED"
      ? "La suspensión está confirmada. El motivo solo entra si queda resuelto."
      : "Dato confirmado que aporta. Primero el hecho, después la voz.";
  }

  const wantsPost = decision === "PUBLISH_NOW" || decision === "PUBLISH_CONTEXT";
  const missing = wantsPost
    ? missingNames(input.credentials, ["database", "openai", "zernio"])
    : [];
  let publication: PipelineResult["publication"];
  if (!wantsPost) publication = { status: "not_requested", missing: [] };
  else if (flash && !flash.valid) publication = { status: "blocked_incomplete", missing: flash.missing };
  else if (input.overrides.pauseAll || input.overrides.pausePublishing) publication = { status: "paused", missing };
  else if (missing.length > 0) publication = { status: "pending_credentials", missing };
  else publication = { status: "queued", missing: [] };

  const runContext = !input.overrides.pauseContext && !input.overrides.pauseAll && (wantsPost || event.eventType === "SUSPENDED" || decision === "MONITOR");
  const jobs: PipelineResult["jobs"] = [];
  if (wantsPost && decision === "PUBLISH_NOW") {
    jobs.push({
      type: "FLASH",
      priority: 100,
      status: publication.status === "queued" ? "queued" : publication.status,
      idempotencyKey: `flash:${key}`,
    });
  }
  if (runContext && decision !== "DISCARD") {
    jobs.push({
      type: "CONTEXT",
      priority: 50,
      status: input.credentials.brightData || event.origin === "api_event" ? "queued" : "pending_credentials",
      idempotencyKey: `context:${key}`,
    });
  }

  const botImage = Boolean(event.botIsProtagonist || event.meme);
  const expression = pickExpression({ eventType: event.eventType, tone, meme: event.meme });
  const draft = flash?.valid && (decision === "PUBLISH_NOW" || decision === "PUBLISH_CONTEXT")
    ? composeDraft({
        eventType: event.eventType,
        lockedLines: flash.lockedLines,
        tone,
        america: americaTag,
        minute: event.minute,
        detail: event.detail,
        seed: `${event.fixtureId}:${event.eventType}:${event.minute ?? "x"}:${event.detail ?? ""}`,
      })
    : null;
  return {
    idempotencyKey: key,
    truth,
    claimStatus,
    story: { key: story.key, action: story.action },
    importance,
    cooldown,
    decision,
    reason,
    flash,
    draft,
    context: {
      run: runContext && decision !== "DISCARD",
      waitsForBrightData: !input.credentials.brightData,
      instruction: event.eventType === "SUSPENDED"
        ? "Investigar el motivo. No afirmar una causa sin confirmación."
        : "Buscar en las páginas contexto del partido. No tiene que ser un dato nuevo del evento. Si no regresan nada del partido, no hay segundo post.",
    },
    visual: {
      ...(botImage
        ? { mode: input.overrides.pauseImages ? "pausada" : "bot_generada", reference: expressionFile(expression) }
        : { mode: event.hasRealImage ? "fotografia_real" : "texto", reference: null }),
      expression,
    },
    jobs,
    publication,
    tone,
    americaTag,
    checks: {
      cierto: truth === "DATO_CONFIRMADO" || (event.eventType === "SUSPENDED" && event.origin === "api_event"),
      aporta: wantsPost,
      voz: input.credentials.openai ? "lista" : "pendiente",
    },
  };
}
