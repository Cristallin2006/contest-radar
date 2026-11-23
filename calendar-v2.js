import { allPublishedForCalendar, CATEGORY_LABELS, REGION_LABELS } from "./events.js";
import { escIcs } from "./util.js";

function compactDate(value) {
  return String(value).slice(0, 10).replace(/-/g, "");
}

function plusOneDay(value) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function utcStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function line(name, value) {
  return `${name}:${String(value ?? "").replace(/\r?\n/g, "\\n")}`;
}

function textLine(name, value) {
  return `${name}:${escIcs(String(value ?? "").replace(/\r?\n/g, "\n"))}`;
}

function eventForStage(edition, stage, stamp) {
  const cancelled = edition.lifecycle === "cancelled" || edition.status_override === "cancelled";
  const lines = [
    "BEGIN:VEVENT",
    line("UID", `stage-${stage.id}@contest-radar`),
    line("DTSTAMP", stamp),
    line("LAST-MODIFIED", utcStamp(stage.updated_at || stamp) || stamp),
    line("SEQUENCE", Number(stage.ics_sequence || 0)),
    textLine("SUMMARY", `${edition.title} · ${stage.name}`),
    textLine("DESCRIPTION", [
      edition.organizer ? `主办：${edition.organizer}` : "",
      `类别：${CATEGORY_LABELS[edition.category] || edition.category}`,
      `地区：${REGION_LABELS[edition.region] || edition.region}`,
      stage.note || "",
      edition.source_url || edition.signup_url || "",
    ].filter(Boolean).join("\n")),
    line("URL", edition.signup_url || edition.source_url || ""),
    line("CATEGORIES", [CATEGORY_LABELS[edition.category] || edition.category, ...(edition.tag_names || [])].join(",")),
  ];
  if (cancelled) lines.push("STATUS:CANCELLED");

  if (stage.deadline_at && !stage.starts_at && !stage.ends_at) {
    if (isDateOnly(stage.deadline_at)) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(stage.deadline_at)}`);
    } else {
      const dt = utcStamp(stage.deadline_at);
      if (dt) lines.push(`DTSTART:${dt}`);
    }
    if (stage.time_status === "confirmed" && !cancelled) {
      lines.push(
        "BEGIN:VALARM",
        "TRIGGER:-P7D",
        "ACTION:DISPLAY",
        textLine("DESCRIPTION", `7 天后截止：${edition.title} · ${stage.name}`),
        "END:VALARM",
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        textLine("DESCRIPTION", `明天截止：${edition.title} · ${stage.name}`),
        "END:VALARM",
      );
    }
  } else if (stage.starts_at) {
    if (isDateOnly(stage.starts_at) || stage.is_all_day) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(stage.starts_at)}`);
      if (stage.ends_at) lines.push(`DTEND;VALUE=DATE:${compactDate(plusOneDay(stage.ends_at))}`);
    } else {
      const start = utcStamp(stage.starts_at);
      const end = stage.ends_at ? utcStamp(stage.ends_at) : null;
      if (start) lines.push(`DTSTART:${start}`);
      if (end) lines.push(`DTEND:${end}`);
    }
  } else if (stage.ends_at) {
    const end = isDateOnly(stage.ends_at) ? `DTSTART;VALUE=DATE:${compactDate(stage.ends_at)}` : `DTSTART:${utcStamp(stage.ends_at)}`;
    lines.push(end);
  } else {
    return null;
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar({ region = "", category = "" } = {}) {
  const filters = {};
  if (region === "cn" || region === "intl") filters.region = region;
  if (category) filters.category = category;
  const editions = allPublishedForCalendar(filters);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const suffix = [
    region === "cn" ? "国内" : region === "intl" ? "国外" : "",
    category ? CATEGORY_LABELS[category] || category : "",
  ].filter(Boolean).join(" · ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Contest Radar//Anonymous v0.2//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    textLine("X-WR-CALNAME", `竞赛雷达${suffix ? `（${suffix}）` : ""}`),
    "X-WR-TIMEZONE:Asia/Shanghai",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const edition of editions) {
    for (const stage of edition.stages) {
      const eventLines = eventForStage(edition, stage, stamp);
      if (eventLines) lines.push(...eventLines);
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function escapeCalendarText(input) {
  return escIcs(input);
}
