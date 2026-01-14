#!/usr/bin/env node

// electron/mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// electron/mcp/database.ts
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import Database from "better-sqlite3";
var DEFAULT_DB_PATH = join(
  homedir(),
  "Library/Application Support/Screencap/screencap.db"
);
var cachedDb = null;
function getDbPath() {
  return process.env.SCREENCAP_DB_PATH ?? DEFAULT_DB_PATH;
}
function getDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    throw new Error(
      `Screencap database not found at ${dbPath}. Make sure Screencap is installed and has been run at least once.`
    );
  }
  cachedDb = new Database(dbPath, { readonly: true });
  return cachedDb;
}
function closeDatabase() {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
}
function getDayStart(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function getDayEnd(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function getWeekStart(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function getHoursAgo(hours) {
  return Date.now() - hours * 60 * 60 * 1e3;
}
function getDaysAgo(days) {
  return Date.now() - days * 24 * 60 * 60 * 1e3;
}

// electron/mcp/prompts/dailySummary.ts
import { z } from "zod";

// electron/mcp/formatters.ts
function formatTime(timestamp, includeDate = false) {
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  if (includeDate) {
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
    return `${dateStr}, ${timeStr}`;
  }
  return timeStr;
}
function formatDuration(ms) {
  if (ms < 0) return "0m";
  const hours = Math.floor(ms / (1e3 * 60 * 60));
  const minutes = Math.floor(ms % (1e3 * 60 * 60) / (1e3 * 60));
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
function formatDateShort(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
function formatEventForLLM(event, includeDate = false) {
  const duration = event.end_timestamp && event.timestamp ? formatDuration(event.end_timestamp - event.timestamp) : null;
  const context = event.url_host || truncateWindowTitle(event.window_title);
  return {
    id: event.id,
    time: formatTime(event.timestamp, includeDate),
    duration,
    activity: event.caption || "Unknown activity",
    category: event.category || "Unknown",
    ...event.project && { project: event.project },
    ...event.app_name && { app: event.app_name },
    ...context && { context },
    ...event.project_progress > 0 && { isProgress: true },
    ...event.url_canonical && { url: event.url_canonical }
  };
}
function formatEventsForLLM(events, includeDate = false) {
  return events.map((e) => formatEventForLLM(e, includeDate));
}
function truncateWindowTitle(title, maxLength = 60) {
  if (!title) return null;
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 3)}...`;
}
function formatTimeSummary(categoryStats, periodLabel) {
  const totalMs = categoryStats.reduce((sum, c) => sum + c.totalMs, 0);
  return {
    period: periodLabel,
    totalTime: formatDuration(totalMs),
    breakdown: categoryStats.sort((a, b) => b.totalMs - a.totalMs).map((c) => ({
      category: c.category,
      time: formatDuration(c.totalMs),
      percent: totalMs > 0 ? Math.round(c.totalMs / totalMs * 100) : 0,
      eventCount: c.count
    }))
  };
}
function formatAppUsage(apps, totalMs) {
  return apps.map((a) => ({
    app: a.app,
    time: formatDuration(a.totalMs),
    eventCount: a.count,
    percent: totalMs > 0 ? Math.round(a.totalMs / totalMs * 100) : 0
  }));
}
function formatWebsiteUsage(hosts, totalMs) {
  return hosts.map((h) => ({
    host: h.host,
    time: formatDuration(h.totalMs),
    eventCount: h.count,
    percent: totalMs > 0 ? Math.round(h.totalMs / totalMs * 100) : 0
  }));
}
function formatProject(name, eventCount, progressCount, lastActivityTs, totalMs) {
  return {
    name,
    eventCount,
    progressCount,
    lastActivity: lastActivityTs ? formatTime(lastActivityTs, true) : null,
    totalTime: formatDuration(totalMs)
  };
}
function formatFocusScore(date, focusMs, distractionMs, focusCategories, topDistractions) {
  const totalMs = focusMs + distractionMs;
  const score = totalMs > 0 ? Math.round(focusMs / totalMs * 100) : 0;
  return {
    date: formatDate(date.getTime()),
    score,
    focusTime: formatDuration(focusMs),
    distractionTime: formatDuration(distractionMs),
    focusCategories,
    topDistractions: topDistractions.map(
      (d) => `${d.name} (${formatDuration(d.ms)})`
    )
  };
}
function formatAddictionStats(name, lastIncidentAt, thisWeekCount, lastWeekCount) {
  let trend = "stable";
  if (thisWeekCount > lastWeekCount) trend = "increasing";
  else if (thisWeekCount < lastWeekCount) trend = "decreasing";
  return {
    name,
    lastIncidentAt: lastIncidentAt ? formatTime(lastIncidentAt, true) : null,
    thisWeekCount,
    lastWeekCount,
    trend
  };
}
function formatPeriodComparison(period1Label, period2Label, period1Stats, period2Stats) {
  const p1Total = period1Stats.focusMs + period1Stats.distractionMs;
  const p2Total = period2Stats.focusMs + period2Stats.distractionMs;
  const focusChange = period2Stats.focusMs > 0 ? Math.round(
    (period1Stats.focusMs - period2Stats.focusMs) / period2Stats.focusMs * 100
  ) : 0;
  const distractionChange = period2Stats.distractionMs > 0 ? Math.round(
    (period1Stats.distractionMs - period2Stats.distractionMs) / period2Stats.distractionMs * 100
  ) : 0;
  let productivityTrend = "stable";
  if (focusChange > 10 || distractionChange < -10)
    productivityTrend = "improved";
  else if (focusChange < -10 || distractionChange > 10)
    productivityTrend = "declined";
  return {
    period1Label,
    period2Label,
    period1: {
      totalTime: formatDuration(p1Total),
      focusTime: formatDuration(period1Stats.focusMs),
      distractionTime: formatDuration(period1Stats.distractionMs),
      eventCount: period1Stats.count
    },
    period2: {
      totalTime: formatDuration(p2Total),
      focusTime: formatDuration(period2Stats.focusMs),
      distractionTime: formatDuration(period2Stats.distractionMs),
      eventCount: period2Stats.count
    },
    change: {
      focusTimePercent: focusChange,
      distractionTimePercent: distractionChange,
      productivityTrend
    }
  };
}
function formatMarkdownEventList(events) {
  if (events.length === 0) return "No events found.";
  return events.map((e) => {
    const parts = [`- **${e.time}**`];
    if (e.duration) parts.push(`(${e.duration})`);
    parts.push(`- ${e.activity}`);
    if (e.project) parts.push(`[${e.project}]`);
    if (e.app) parts.push(`(${e.app})`);
    return parts.join(" ");
  }).join("\n");
}
function formatMarkdownTimeSummary(summary) {
  const lines = [`**${summary.period}** - Total: ${summary.totalTime}
`];
  for (const item of summary.breakdown) {
    lines.push(
      `- ${item.category}: ${item.time} (${item.percent}%) - ${item.eventCount} events`
    );
  }
  return lines.join("\n");
}

// electron/mcp/prompts/dailySummary.ts
function registerDailySummaryPrompt(server2) {
  server2.registerPrompt(
    "daily_summary",
    {
      description: "Summarize activity for a specific day",
      argsSchema: {
        date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)")
      }
    },
    async (params) => {
      const db = getDatabase();
      let targetDate;
      if (!params.date) {
        targetDate = /* @__PURE__ */ new Date();
      } else {
        targetDate = new Date(params.date);
      }
      const dayStart = getDayStart(targetDate);
      const dayEnd = getDayEnd(targetDate);
      const events = db.prepare(
        `
          SELECT * FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp ASC
        `
      ).all(dayStart, dayEnd);
      const categoryRows = db.prepare(
        `
          SELECT 
            COALESCE(category, 'Unknown') as category,
            SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
            COUNT(*) as event_count
          FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
          GROUP BY category
          ORDER BY total_duration DESC
        `
      ).all(dayStart, dayEnd);
      const formatted = formatEventsForLLM(events, false);
      const stats = categoryRows.map((r) => ({
        category: r.category,
        totalMs: r.total_duration,
        count: r.event_count
      }));
      const summary = formatTimeSummary(stats, formatDate(dayStart));
      const eventList = formatMarkdownEventList(formatted);
      const statsSummary = formatMarkdownTimeSummary(summary);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Here's my activity data for ${formatDate(dayStart)}:

## Time Breakdown
${statsSummary}

## Activity Timeline (${events.length} events)
${eventList}

Please provide an honest summary of how I spent my time, what I accomplished, and any patterns you notice (good or concerning). Be direct and constructive.`
            }
          }
        ]
      };
    }
  );
}

// electron/mcp/prompts/focusAnalysis.ts
import { z as z2 } from "zod";
function registerFocusAnalysisPrompt(server2) {
  server2.registerPrompt(
    "focus_analysis",
    {
      description: "Analyze focus and distraction patterns",
      argsSchema: {
        period: z2.enum(["today", "week"]).default("today").describe("Analysis period")
      }
    },
    async (params) => {
      const db = getDatabase();
      let startDate;
      let endDate;
      let periodLabel;
      if (params.period === "week") {
        startDate = getWeekStart();
        endDate = Date.now();
        periodLabel = `This week (${formatDateShort(startDate)} - ${formatDateShort(endDate)})`;
      } else {
        startDate = getDayStart();
        endDate = getDayEnd();
        periodLabel = formatDate(startDate);
      }
      const events = db.prepare(
        `
          SELECT * FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
        `
      ).all(startDate, endDate);
      const addictions = db.prepare(`SELECT * FROM memory WHERE type = 'addiction'`).all();
      const focusCategories = ["Work", "Study"];
      const categoryTimes = {};
      const addictionTimes = {};
      let focusMs = 0;
      let distractionMs = 0;
      let otherMs = 0;
      for (const event of events) {
        const duration = (event.end_timestamp || event.timestamp + 6e4) - event.timestamp;
        const category = event.category || "Unknown";
        categoryTimes[category] = (categoryTimes[category] || 0) + duration;
        if (event.tracked_addiction) {
          distractionMs += duration;
          addictionTimes[event.tracked_addiction] = (addictionTimes[event.tracked_addiction] || 0) + duration;
        } else if (focusCategories.includes(category)) {
          focusMs += duration;
        } else {
          otherMs += duration;
        }
      }
      const totalMs = focusMs + distractionMs + otherMs;
      const focusPercent = totalMs > 0 ? Math.round(focusMs / totalMs * 100) : 0;
      const distractionPercent = totalMs > 0 ? Math.round(distractionMs / totalMs * 100) : 0;
      const categoryBreakdown = Object.entries(categoryTimes).sort((a, b) => b[1] - a[1]).map(([cat, ms]) => `- ${cat}: ${formatDuration(ms)}`).join("\n");
      const addictionBreakdown = Object.entries(addictionTimes).sort((a, b) => b[1] - a[1]).map(([name, ms]) => `- ${name}: ${formatDuration(ms)}`).join("\n");
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Here's my focus analysis for ${periodLabel}:

## Summary
- **Total tracked time**: ${formatDuration(totalMs)}
- **Focus time** (Work + Study): ${formatDuration(focusMs)} (${focusPercent}%)
- **Distraction time** (tracked addictions): ${formatDuration(distractionMs)} (${distractionPercent}%)
- **Other activities**: ${formatDuration(otherMs)}

## Category Breakdown
${categoryBreakdown}

## Tracked Distractions
${addictionBreakdown || "No distractions tracked."}

## Tracked Addictions
${addictions.map((a) => `- ${a.content}${a.description ? `: ${a.description}` : ""}`).join("\n") || "None configured."}

Please analyze my focus patterns. Be honest about:
1. How well am I focusing?
2. What are my main distractions?
3. Any concerning patterns?
4. Suggestions for improvement?`
            }
          }
        ]
      };
    }
  );
}

// electron/mcp/prompts/projectStatus.ts
import { z as z3 } from "zod";
function registerProjectStatusPrompt(server2) {
  server2.registerPrompt(
    "project_status",
    {
      description: "Get status summary for a specific project",
      argsSchema: {
        project: z3.string().describe("Project name")
      }
    },
    async (params) => {
      const db = getDatabase();
      const weekAgo = getDaysAgo(7);
      const events = db.prepare(
        `
          SELECT * FROM events
          WHERE project = ? AND timestamp >= ?
            AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
        `
      ).all(params.project, weekAgo);
      const progressEvents = events.filter((e) => e.project_progress > 0);
      const totalMs = events.reduce((sum, e) => {
        const duration = (e.end_timestamp || e.timestamp + 6e4) - e.timestamp;
        return sum + duration;
      }, 0);
      const formatted = formatEventsForLLM(events.slice(0, 20), true);
      const progressFormatted = formatEventsForLLM(
        progressEvents.slice(0, 10),
        true
      );
      const eventList = formatMarkdownEventList(formatted);
      const progressList = formatMarkdownEventList(progressFormatted);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Here's the status for project "${params.project}" over the last 7 days:

## Overview
- Total time spent: ${formatDuration(totalMs)}
- Total events: ${events.length}
- Progress markers: ${progressEvents.length}

## Progress Events
${progressList || "No progress events recorded."}

## Recent Activity
${eventList}

Please provide a summary of the project status: what progress has been made, what seems to be the current focus, and any observations about the work pattern.`
            }
          }
        ]
      };
    }
  );
}

// electron/mcp/prompts/index.ts
function registerPrompts(server2) {
  registerDailySummaryPrompt(server2);
  registerProjectStatusPrompt(server2);
  registerFocusAnalysisPrompt(server2);
}

// electron/mcp/resources/activity.ts
function registerActivityResources(server2) {
  server2.registerResource(
    "activity-today",
    "screencap://activity/today",
    { description: "Today's activity events" },
    async () => {
      const db = getDatabase();
      const dayStart = getDayStart();
      const events = db.prepare(
        `
        SELECT *
        FROM events
        WHERE timestamp >= ? AND dismissed = 0 AND status = 'completed'
        ORDER BY timestamp DESC
      `
      ).all(dayStart);
      const formatted = formatEventsForLLM(events, false);
      return {
        contents: [
          {
            uri: "screencap://activity/today",
            mimeType: "application/json",
            text: JSON.stringify(formatted, null, 2)
          }
        ]
      };
    }
  );
  server2.registerResource(
    "activity-recent",
    "screencap://activity/recent",
    { description: "Recent activity (last 2 hours)" },
    async () => {
      const db = getDatabase();
      const twoHoursAgo = getHoursAgo(2);
      const events = db.prepare(
        `
          SELECT *
          FROM events
          WHERE timestamp >= ? AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
          LIMIT 50
        `
      ).all(twoHoursAgo);
      const formatted = formatEventsForLLM(events, false);
      return {
        contents: [
          {
            uri: "screencap://activity/recent",
            mimeType: "application/json",
            text: JSON.stringify(formatted, null, 2)
          }
        ]
      };
    }
  );
}

// electron/mcp/resources/memories.ts
function registerMemoriesResources(server2) {
  server2.registerResource(
    "memories",
    "screencap://memories",
    { description: "User memories (projects, addictions, preferences)" },
    async () => {
      const db = getDatabase();
      const memories = db.prepare(
        `
        SELECT *
        FROM memory
        ORDER BY updated_at DESC
      `
      ).all();
      const formatted = memories.map((m) => ({
        id: m.id,
        type: m.type,
        name: m.content,
        description: m.description
      }));
      const grouped = {
        projects: formatted.filter((m) => m.type === "project"),
        addictions: formatted.filter((m) => m.type === "addiction"),
        preferences: formatted.filter((m) => m.type === "preference")
      };
      return {
        contents: [
          {
            uri: "screencap://memories",
            mimeType: "application/json",
            text: JSON.stringify(grouped, null, 2)
          }
        ]
      };
    }
  );
  server2.registerResource(
    "eod-today",
    "screencap://eod/today",
    { description: "Today's end-of-day entry" },
    async () => {
      const db = getDatabase();
      const dayStart = getDayStart();
      const dayEnd = getDayEnd();
      const entry = db.prepare(
        `
        SELECT *
        FROM eod_entries
        WHERE day_start >= ? AND day_end <= ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      ).get(dayStart, dayEnd);
      if (!entry) {
        return {
          contents: [
            {
              uri: "screencap://eod/today",
              mimeType: "application/json",
              text: JSON.stringify({
                exists: false,
                message: "No end-of-day entry for today"
              })
            }
          ]
        };
      }
      let parsedContent;
      try {
        parsedContent = JSON.parse(entry.content);
      } catch {
        parsedContent = entry.content;
      }
      return {
        contents: [
          {
            uri: "screencap://eod/today",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                exists: true,
                submitted: entry.submitted_at !== null,
                content: parsedContent
              },
              null,
              2
            )
          }
        ]
      };
    }
  );
}

// electron/mcp/resources/projects.ts
function registerProjectsResources(server2) {
  server2.registerResource(
    "projects-list",
    "screencap://projects",
    { description: "List of all tracked projects" },
    async () => {
      const db = getDatabase();
      const rows = db.prepare(
        `
        SELECT 
          project,
          COUNT(*) as event_count,
          SUM(CASE WHEN project_progress > 0 THEN 1 ELSE 0 END) as progress_count,
          MAX(timestamp) as last_activity,
          SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration
        FROM events
        WHERE project IS NOT NULL AND project != ''
          AND dismissed = 0 AND status = 'completed'
        GROUP BY project
        ORDER BY last_activity DESC
      `
      ).all();
      const projects = rows.map(
        (r) => formatProject(
          r.project,
          r.event_count,
          r.progress_count,
          r.last_activity,
          r.total_duration
        )
      );
      return {
        contents: [
          {
            uri: "screencap://projects",
            mimeType: "application/json",
            text: JSON.stringify(projects, null, 2)
          }
        ]
      };
    }
  );
}

// electron/mcp/resources/stats.ts
function getCategoryStats(startDate, endDate) {
  const db = getDatabase();
  return db.prepare(
    `
      SELECT 
        COALESCE(category, 'Unknown') as category,
        SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
        COUNT(*) as event_count
      FROM events
      WHERE timestamp >= ? AND timestamp <= ?
        AND dismissed = 0 AND status = 'completed'
      GROUP BY category
      ORDER BY total_duration DESC
    `
  ).all(startDate, endDate);
}
function registerStatsResources(server2) {
  server2.registerResource(
    "stats-today",
    "screencap://stats/today",
    { description: "Today's time statistics by category" },
    async () => {
      const dayStart = getDayStart();
      const dayEnd = getDayEnd();
      const rows = getCategoryStats(dayStart, dayEnd);
      const stats = rows.map((r) => ({
        category: r.category,
        totalMs: r.total_duration,
        count: r.event_count
      }));
      const summary = formatTimeSummary(stats, "Today");
      return {
        contents: [
          {
            uri: "screencap://stats/today",
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2)
          }
        ]
      };
    }
  );
  server2.registerResource(
    "stats-week",
    "screencap://stats/week",
    { description: "This week's time statistics by category" },
    async () => {
      const weekStart = getWeekStart();
      const now = Date.now();
      const rows = getCategoryStats(weekStart, now);
      const stats = rows.map((r) => ({
        category: r.category,
        totalMs: r.total_duration,
        count: r.event_count
      }));
      const summary = formatTimeSummary(stats, "This Week");
      return {
        contents: [
          {
            uri: "screencap://stats/week",
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2)
          }
        ]
      };
    }
  );
}

// electron/mcp/resources/stories.ts
function registerStoriesResources(server2) {
  server2.registerResource(
    "stories-latest",
    "screencap://stories/latest",
    { description: "Latest generated stories" },
    async () => {
      const db = getDatabase();
      const stories = db.prepare(
        `
        SELECT *
        FROM stories
        ORDER BY created_at DESC
        LIMIT 5
      `
      ).all();
      const formatted = stories.map((s) => ({
        id: s.id,
        type: s.period_type,
        period: `${formatDateShort(s.period_start)} - ${formatDateShort(s.period_end)}`,
        content: s.content,
        createdAt: formatDateShort(s.created_at)
      }));
      return {
        contents: [
          {
            uri: "screencap://stories/latest",
            mimeType: "application/json",
            text: JSON.stringify(formatted, null, 2)
          }
        ]
      };
    }
  );
}

// electron/mcp/resources/index.ts
function registerResources(server2) {
  registerActivityResources(server2);
  registerStatsResources(server2);
  registerProjectsResources(server2);
  registerStoriesResources(server2);
  registerMemoriesResources(server2);
}

// electron/mcp/tools/analytics.ts
import { z as z4 } from "zod";
function registerAnalyticsTools(server2) {
  server2.registerTool(
    "get_time_summary",
    {
      description: "Get category/time breakdown for a period",
      inputSchema: {
        startDate: z4.number().describe("Start timestamp (ms)"),
        endDate: z4.number().describe("End timestamp (ms)"),
        groupBy: z4.enum(["category", "project"]).default("category").describe("Group by category or project")
      }
    },
    async (params) => {
      const db = getDatabase();
      const groupColumn = params.groupBy === "project" ? "project" : "category";
      const rows = db.prepare(
        `
          SELECT 
            COALESCE(${groupColumn}, 'Unknown') as category,
            SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
            COUNT(*) as event_count
          FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
          GROUP BY ${groupColumn}
          ORDER BY total_duration DESC
        `
      ).all(params.startDate, params.endDate);
      const stats = rows.map((r) => ({
        category: r.category,
        totalMs: r.total_duration,
        count: r.event_count
      }));
      const periodLabel = `${formatDateShort(params.startDate)} - ${formatDateShort(params.endDate)}`;
      const summary = formatTimeSummary(stats, periodLabel);
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
      };
    }
  );
  server2.registerTool(
    "get_app_usage",
    {
      description: "Get app usage statistics",
      inputSchema: {
        startDate: z4.number().optional().describe("Start timestamp (ms)"),
        endDate: z4.number().optional().describe("End timestamp (ms)"),
        limit: z4.number().default(10).describe("Maximum number of apps to return")
      }
    },
    async (params) => {
      const db = getDatabase();
      const conditions = [
        "dismissed = 0",
        "status = 'completed'",
        "app_name IS NOT NULL"
      ];
      const values = [];
      if (params.startDate) {
        conditions.push("timestamp >= ?");
        values.push(params.startDate);
      }
      if (params.endDate) {
        conditions.push("timestamp <= ?");
        values.push(params.endDate);
      }
      const query = `
        SELECT 
          app_name,
          SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
          COUNT(*) as event_count
        FROM events
        WHERE ${conditions.join(" AND ")}
        GROUP BY app_name
        ORDER BY total_duration DESC
        LIMIT ?
      `;
      values.push(params.limit);
      const rows = db.prepare(query).all(...values);
      const totalMs = rows.reduce((sum, r) => sum + r.total_duration, 0);
      const formatted = formatAppUsage(
        rows.map((r) => ({
          app: r.app_name,
          totalMs: r.total_duration,
          count: r.event_count
        })),
        totalMs
      );
      return {
        content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }]
      };
    }
  );
  server2.registerTool(
    "get_website_usage",
    {
      description: "Get website usage statistics",
      inputSchema: {
        startDate: z4.number().optional().describe("Start timestamp (ms)"),
        endDate: z4.number().optional().describe("End timestamp (ms)"),
        limit: z4.number().default(10).describe("Maximum number of websites to return")
      }
    },
    async (params) => {
      const db = getDatabase();
      const conditions = [
        "dismissed = 0",
        "status = 'completed'",
        "url_host IS NOT NULL"
      ];
      const values = [];
      if (params.startDate) {
        conditions.push("timestamp >= ?");
        values.push(params.startDate);
      }
      if (params.endDate) {
        conditions.push("timestamp <= ?");
        values.push(params.endDate);
      }
      const query = `
        SELECT 
          url_host,
          SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
          COUNT(*) as event_count
        FROM events
        WHERE ${conditions.join(" AND ")}
        GROUP BY url_host
        ORDER BY total_duration DESC
        LIMIT ?
      `;
      values.push(params.limit);
      const rows = db.prepare(query).all(...values);
      const totalMs = rows.reduce((sum, r) => sum + r.total_duration, 0);
      const formatted = formatWebsiteUsage(
        rows.map((r) => ({
          host: r.url_host,
          totalMs: r.total_duration,
          count: r.event_count
        })),
        totalMs
      );
      return {
        content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }]
      };
    }
  );
  server2.registerTool(
    "compare_periods",
    {
      description: "Compare productivity across two time periods",
      inputSchema: {
        period1Start: z4.number().describe("Period 1 start timestamp (ms)"),
        period1End: z4.number().describe("Period 1 end timestamp (ms)"),
        period2Start: z4.number().describe("Period 2 start timestamp (ms)"),
        period2End: z4.number().describe("Period 2 end timestamp (ms)")
      }
    },
    async (params) => {
      const db = getDatabase();
      const focusCategories = ["Work", "Study"];
      function getPeriodStats(start, end) {
        const events = db.prepare(
          `
            SELECT 
              category,
              COALESCE(end_timestamp, timestamp + 60000) - timestamp as duration
            FROM events
            WHERE timestamp >= ? AND timestamp <= ?
              AND dismissed = 0 AND status = 'completed'
          `
        ).all(start, end);
        let focusMs = 0;
        let distractionMs = 0;
        for (const e of events) {
          if (e.category && focusCategories.includes(e.category)) {
            focusMs += e.duration;
          } else {
            distractionMs += e.duration;
          }
        }
        return { focusMs, distractionMs, count: events.length };
      }
      const stats1 = getPeriodStats(params.period1Start, params.period1End);
      const stats2 = getPeriodStats(params.period2Start, params.period2End);
      const comparison = formatPeriodComparison(
        `${formatDateShort(params.period1Start)} - ${formatDateShort(params.period1End)}`,
        `${formatDateShort(params.period2Start)} - ${formatDateShort(params.period2End)}`,
        stats1,
        stats2
      );
      return {
        content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }]
      };
    }
  );
}

// electron/mcp/tools/awareness.ts
import { z as z5 } from "zod";
function registerAwarenessTools(server2) {
  server2.registerTool(
    "get_addiction_stats",
    {
      description: "Get addiction tracking statistics",
      inputSchema: {
        name: z5.string().optional().describe("Specific addiction name (optional)"),
        days: z5.number().default(14).describe("Number of days to analyze")
      }
    },
    async (params) => {
      const db = getDatabase();
      const addictions = db.prepare(`SELECT * FROM memory WHERE type = 'addiction'`).all();
      if (addictions.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ message: "No addictions tracked" })
            }
          ]
        };
      }
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1e3;
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1e3;
      const targetAddictions = params.name ? addictions.filter(
        (a) => a.content.toLowerCase().includes(params.name.toLowerCase())
      ) : addictions;
      const stats = targetAddictions.map((addiction) => {
        const thisWeekEvents = db.prepare(
          `
            SELECT COUNT(*) as count FROM events
            WHERE tracked_addiction = ? AND timestamp >= ?
              AND dismissed = 0
          `
        ).get(addiction.content, weekAgo);
        const lastWeekEvents = db.prepare(
          `
            SELECT COUNT(*) as count FROM events
            WHERE tracked_addiction = ? AND timestamp >= ? AND timestamp < ?
              AND dismissed = 0
          `
        ).get(addiction.content, twoWeeksAgo, weekAgo);
        const lastIncident = db.prepare(
          `
            SELECT timestamp FROM events
            WHERE tracked_addiction = ? AND dismissed = 0
            ORDER BY timestamp DESC
            LIMIT 1
          `
        ).get(addiction.content);
        return formatAddictionStats(
          addiction.content,
          lastIncident?.timestamp ?? null,
          thisWeekEvents?.count ?? 0,
          lastWeekEvents?.count ?? 0
        );
      });
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }]
      };
    }
  );
  server2.registerTool(
    "get_focus_score",
    {
      description: "Get focus/distraction score for a day",
      inputSchema: {
        date: z5.string().optional().describe("Date string (YYYY-MM-DD) or 'today'")
      }
    },
    async (params) => {
      const db = getDatabase();
      let targetDate;
      if (!params.date || params.date === "today") {
        targetDate = /* @__PURE__ */ new Date();
      } else {
        targetDate = new Date(params.date);
      }
      const dayStart = getDayStart(targetDate);
      const dayEnd = getDayEnd(targetDate);
      const events = db.prepare(
        `
          SELECT * FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
        `
      ).all(dayStart, dayEnd);
      const focusCategories = ["Work", "Study"];
      let focusMs = 0;
      let distractionMs = 0;
      const distractionCounts = {};
      for (const event of events) {
        const duration = (event.end_timestamp || event.timestamp + 6e4) - event.timestamp;
        if (event.tracked_addiction) {
          distractionMs += duration;
          distractionCounts[event.tracked_addiction] = (distractionCounts[event.tracked_addiction] || 0) + duration;
        } else if (event.category && focusCategories.includes(event.category)) {
          focusMs += duration;
        }
      }
      const topDistractions = Object.entries(distractionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, ms]) => ({ name, ms }));
      const score = formatFocusScore(
        targetDate,
        focusMs,
        distractionMs,
        focusCategories,
        topDistractions
      );
      return {
        content: [{ type: "text", text: JSON.stringify(score, null, 2) }]
      };
    }
  );
}

// electron/mcp/tools/events.ts
import { z as z6 } from "zod";

// electron/mcp/images.ts
import { existsSync as existsSync2, readFileSync } from "fs";
function getImageBase64(imagePath) {
  if (!imagePath || !existsSync2(imagePath)) {
    return null;
  }
  try {
    const buffer = readFileSync(imagePath);
    return buffer.toString("base64");
  } catch {
    return null;
  }
}
function getMimeType(path) {
  if (!path) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

// electron/mcp/tools/events.ts
function registerEventTools(server2) {
  server2.registerTool(
    "query_events",
    {
      description: "Query activity events with flexible filters",
      inputSchema: {
        startDate: z6.number().optional().describe("Start timestamp (ms)"),
        endDate: z6.number().optional().describe("End timestamp (ms)"),
        category: z6.string().optional().describe("Filter by category (Work, Study, Leisure, etc.)"),
        project: z6.string().optional().describe("Filter by project name"),
        app: z6.string().optional().describe("Filter by app name"),
        urlHost: z6.string().optional().describe("Filter by website host"),
        limit: z6.number().default(50).describe("Maximum number of events to return"),
        includeImages: z6.boolean().default(false).describe("Include screenshot images")
      }
    },
    async (params) => {
      const db = getDatabase();
      const conditions = ["dismissed = 0", "status = 'completed'"];
      const values = [];
      if (params.startDate) {
        conditions.push("timestamp >= ?");
        values.push(params.startDate);
      }
      if (params.endDate) {
        conditions.push("timestamp <= ?");
        values.push(params.endDate);
      }
      if (params.category) {
        conditions.push("category = ?");
        values.push(params.category);
      }
      if (params.project) {
        conditions.push("project = ?");
        values.push(params.project);
      }
      if (params.app) {
        conditions.push("app_name LIKE ?");
        values.push(`%${params.app}%`);
      }
      if (params.urlHost) {
        conditions.push("url_host = ?");
        values.push(params.urlHost);
      }
      const query = `
        SELECT * FROM events
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      values.push(params.limit);
      const events = db.prepare(query).all(...values);
      const formatted = formatEventsForLLM(events, true);
      const content = [
        { type: "text", text: JSON.stringify(formatted, null, 2) }
      ];
      if (params.includeImages) {
        for (const event of events) {
          const imagePath = event.original_path || event.thumbnail_path;
          const base64 = getImageBase64(imagePath);
          if (base64) {
            content.push({
              type: "image",
              data: base64,
              mimeType: getMimeType(imagePath)
            });
          }
        }
      }
      return { content };
    }
  );
  server2.registerTool(
    "search_events",
    {
      description: "Full-text search across captions and window titles",
      inputSchema: {
        query: z6.string().describe("Search query"),
        startDate: z6.number().optional().describe("Start timestamp (ms)"),
        endDate: z6.number().optional().describe("End timestamp (ms)"),
        limit: z6.number().default(20).describe("Maximum number of events to return"),
        includeImages: z6.boolean().default(false).describe("Include screenshot images")
      }
    },
    async (params) => {
      const db = getDatabase();
      const conditions = [
        "dismissed = 0",
        "status = 'completed'",
        "(caption LIKE ? OR window_title LIKE ? OR app_name LIKE ?)"
      ];
      const searchPattern = `%${params.query}%`;
      const values = [
        searchPattern,
        searchPattern,
        searchPattern
      ];
      if (params.startDate) {
        conditions.push("timestamp >= ?");
        values.push(params.startDate);
      }
      if (params.endDate) {
        conditions.push("timestamp <= ?");
        values.push(params.endDate);
      }
      const sql = `
        SELECT * FROM events
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      values.push(params.limit);
      const events = db.prepare(sql).all(...values);
      const formatted = formatEventsForLLM(events, true);
      const content = [
        { type: "text", text: JSON.stringify(formatted, null, 2) }
      ];
      if (params.includeImages) {
        for (const event of events) {
          const imagePath = event.original_path || event.thumbnail_path;
          const base64 = getImageBase64(imagePath);
          if (base64) {
            content.push({
              type: "image",
              data: base64,
              mimeType: getMimeType(imagePath)
            });
          }
        }
      }
      return { content };
    }
  );
  server2.registerTool(
    "get_recent_activity",
    {
      description: "Get recent activity events (quick context)",
      inputSchema: {
        hours: z6.number().default(2).describe("Number of hours to look back"),
        limit: z6.number().default(30).describe("Maximum number of events"),
        includeImages: z6.boolean().default(false).describe("Include screenshot images")
      }
    },
    async (params) => {
      const db = getDatabase();
      const since = getHoursAgo(params.hours);
      const events = db.prepare(
        `
          SELECT * FROM events
          WHERE timestamp >= ? AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
          LIMIT ?
        `
      ).all(since, params.limit);
      const formatted = formatEventsForLLM(events, false);
      const content = [
        { type: "text", text: JSON.stringify(formatted, null, 2) }
      ];
      if (params.includeImages) {
        for (const event of events) {
          const imagePath = event.original_path || event.thumbnail_path;
          const base64 = getImageBase64(imagePath);
          if (base64) {
            content.push({
              type: "image",
              data: base64,
              mimeType: getMimeType(imagePath)
            });
          }
        }
      }
      return { content };
    }
  );
  server2.registerTool(
    "get_event_image",
    {
      description: "Get the screenshot image for a specific event",
      inputSchema: {
        eventId: z6.string().describe("The event ID")
      }
    },
    async (params) => {
      const db = getDatabase();
      const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(params.eventId);
      if (!event) {
        return {
          content: [{ type: "text", text: "Event not found" }]
        };
      }
      const imagePath = event.original_path || event.thumbnail_path;
      const base64 = getImageBase64(imagePath);
      if (!base64) {
        return {
          content: [
            {
              type: "text",
              text: "No image available for this event"
            }
          ]
        };
      }
      return {
        content: [
          {
            type: "image",
            data: base64,
            mimeType: getMimeType(imagePath)
          }
        ]
      };
    }
  );
}

// electron/mcp/tools/projects.ts
import { z as z7 } from "zod";
function registerProjectTools(server2) {
  server2.registerTool(
    "get_project_progress",
    {
      description: "Get progress events for a project",
      inputSchema: {
        project: z7.string().describe("Project name"),
        startDate: z7.number().optional().describe("Start timestamp (ms)"),
        endDate: z7.number().optional().describe("End timestamp (ms)"),
        includeImages: z7.boolean().default(false).describe("Include screenshot images")
      }
    },
    async (params) => {
      const db = getDatabase();
      const conditions = [
        "project = ?",
        "project_progress > 0",
        "dismissed = 0",
        "status = 'completed'"
      ];
      const values = [params.project];
      if (params.startDate) {
        conditions.push("timestamp >= ?");
        values.push(params.startDate);
      }
      if (params.endDate) {
        conditions.push("timestamp <= ?");
        values.push(params.endDate);
      }
      const query = `
        SELECT * FROM events
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp DESC
        LIMIT 50
      `;
      const events = db.prepare(query).all(...values);
      const formatted = formatEventsForLLM(events, true);
      const content = [
        { type: "text", text: JSON.stringify(formatted, null, 2) }
      ];
      if (params.includeImages) {
        for (const event of events) {
          const imagePath = event.original_path || event.thumbnail_path;
          const base64 = getImageBase64(imagePath);
          if (base64) {
            content.push({
              type: "image",
              data: base64,
              mimeType: getMimeType(imagePath)
            });
          }
        }
      }
      return { content };
    }
  );
  server2.registerTool(
    "list_projects",
    {
      description: "List all projects with event counts and last activity"
    },
    async () => {
      const db = getDatabase();
      const rows = db.prepare(
        `
          SELECT 
            project,
            COUNT(*) as event_count,
            SUM(CASE WHEN project_progress > 0 THEN 1 ELSE 0 END) as progress_count,
            MAX(timestamp) as last_activity,
            SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration
          FROM events
          WHERE project IS NOT NULL AND project != ''
            AND dismissed = 0 AND status = 'completed'
          GROUP BY project
          ORDER BY last_activity DESC
        `
      ).all();
      const projects = rows.map(
        (r) => formatProject(
          r.project,
          r.event_count,
          r.progress_count,
          r.last_activity,
          r.total_duration
        )
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(projects, null, 2) }
        ]
      };
    }
  );
  server2.registerTool(
    "get_project_stats",
    {
      description: "Get detailed statistics for a project",
      inputSchema: {
        project: z7.string().describe("Project name"),
        days: z7.number().default(7).describe("Number of days to analyze")
      }
    },
    async (params) => {
      const db = getDatabase();
      const since = getDaysAgo(params.days);
      const events = db.prepare(
        `
          SELECT * FROM events
          WHERE project = ? AND timestamp >= ?
            AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
        `
      ).all(params.project, since);
      const progressCount = events.filter((e) => e.project_progress > 0).length;
      const totalMs = events.reduce((sum, e) => {
        const duration = (e.end_timestamp || e.timestamp + 6e4) - e.timestamp;
        return sum + duration;
      }, 0);
      const appCounts = {};
      for (const e of events) {
        if (e.app_name) {
          appCounts[e.app_name] = (appCounts[e.app_name] || 0) + 1;
        }
      }
      const topApps = Object.entries(appCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([app]) => app);
      const recentEvents = formatEventsForLLM(events.slice(0, 10), true);
      const stats = {
        name: params.project,
        period: `Last ${params.days} days`,
        eventCount: events.length,
        progressCount,
        totalTime: formatDuration(totalMs),
        topApps,
        recentActivity: recentEvents
      };
      return {
        content: [
          { type: "text", text: JSON.stringify(stats, null, 2) }
        ]
      };
    }
  );
}

// electron/mcp/tools/index.ts
function registerTools(server2) {
  registerEventTools(server2);
  registerAnalyticsTools(server2);
  registerProjectTools(server2);
  registerAwarenessTools(server2);
}

// electron/mcp/index.ts
var server = new McpServer({
  name: "screencap",
  version: "1.0.0"
});
registerResources(server);
registerTools(server);
registerPrompts(server);
var transport = new StdioServerTransport();
process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});
await server.connect(transport);
//# sourceMappingURL=index.js.map